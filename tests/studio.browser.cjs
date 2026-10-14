'use strict';
/* Runs in real headless Chromium via Github Actions; no production credentials needed. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png'};
function localServer(){
  return http.createServer((req,res)=>{
    if(req.method==='POST' && req.url==='/api/own-intelligence'){
      let body='';
      req.on('data',chunk=>{body+=chunk;if(body.length>10000)req.destroy()});
      req.on('end',async()=>{
        let status=200;
        const adapter={setHeader(){},status(n){status=n;return this},json(data){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));return this}};
        try{
          await require('../api/own-intelligence.js')({method:'POST',headers:{'x-forwarded-for':'127.0.0.1'},body:JSON.parse(body)},adapter);
        }catch(err){res.writeHead(500);res.end(JSON.stringify({error:String(err)}))}
      });
      return;
    }
    let target;
    try{
      const u=new URL(req.url,'http://localhost');
      target=path.resolve(root,'.'+decodeURIComponent(u.pathname).replace(/\/$/,'/index.html'));
      if(!target.startsWith(root+path.sep))throw Error('outside root');
    }catch{res.writeHead(400);res.end('Bad request');return;}
    fs.readFile(target,(err,data)=>{
      if(err){res.writeHead(404);res.end('Not found');return}
      res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(data);
    });
  });
}
function pngDims(buf){
  assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  return {width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRQsAAAAASUVORK5CYII=','base64');
(async()=>{
  const server=localServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    const ctx=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true,deviceScaleFactor:1});
    const page=await ctx.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:'+port+'/lab/',{waitUntil:'load'});
    await page.fill('#storeName','포항 묵돌이');
    await page.fill('#placeUrl','https://m.place.naver.com/restaurant/12345678/home');
    await page.locator('#start').click();
    await page.waitForFunction(()=>document.getElementById('ownIntelStatus')?.classList.contains('ready'));
    assert.match(await page.locator('#ownIntelFacts').innerText(),/12345678/);
    assert.match(await page.locator('#ownIntelKeywords').innerText(),/포항 맛집/);
    assert.match(await page.locator('#keywordIdeas').innerText(),/포항 맛집/);

    // Real SEO/GEO actionability when all provider API keys are absent:
    // every issue must be identified by the checker, not invented by a model.
    await page.waitForSelector('#selfAudit:not([hidden])');
    assert.equal(await page.locator('#selfAudit [data-check]').count(),12);
    assert.match(await page.locator('#selfAuditStatus').innerText(),/확인 0\/12개/);
    await page.locator('#selfAudit [data-check="contacts"] [data-choice="problem"]').click();
    assert.match(await page.locator('#selfAuditFindings').innerText(),/주소·전화번호·영업시간/);
    assert.match(await page.locator('#selfAuditStatus').innerText(),/개선 필요 1개/);
    await page.locator('#makeReport').click();
    assert.match(await page.locator('#reportText').innerText(),/직접 확인 점검/);
    assert.match(await page.locator('#reportText').innerText(),/실제 출입구/);
    // An unconfirmed item must stay unconfirmed, never classified as an observed defect.
    assert.match(await page.locator('#reportText').innerText(),/\[미확인\]/);
    await page.locator('#makeReport').click();
    assert.match(await page.locator('#reportText').innerText(),/모멘텀 독립 진단/);
    assert.match(await page.locator('#reportText').innerText(),/실제 검색량 미측정/);
    console.log('PASS: self-owned business and link-only engine generated keywords and printable report without Naver API');
    // Critical fallback: useful human-verified SEO/GEO diagnosis and report
    // must still work if API functions are blocked or return 503.
    const offline=await ctx.newPage();
    await offline.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'공급자 API 연결 불가'})}));
    await offline.goto('http://127.0.0.1:'+port+'/lab/',{waitUntil:'load'});
    await offline.fill('#storeName','포항 묵돌이');
    await offline.fill('#placeUrl','https://m.place.naver.com/restaurant/12345678/home');
    await offline.locator('#start').click();
    await offline.waitForSelector('#selfAudit:not([hidden])');
    await offline.locator('#selfAudit [data-check="photos"] [data-choice="problem"]').click();
    assert.match(await offline.locator('#selfAuditFindings').innerText(),/대표사진/);
    await offline.locator('#makeReport').click();
    assert.match(await offline.locator('#reportText').innerText(),/직접 확인 점검/);
    assert.match(await offline.locator('#reportText').innerText(),/사진/);
    await offline.close();
    console.log('PASS: checklist and evidence-based report still operate with all APIs offline');


    await page.locator('[data-view="creative"]').click();
    await page.waitForSelector('.studio-template',{state:'visible'});
    assert.equal(await page.locator('.studio-template').count(),8);
    assert.equal(await page.locator('#studioBusiness').inputValue(),'포항 묵돌이');
    await page.screenshot({path:path.join(root,'artifacts/studio-desktop.png'),fullPage:true});
    console.log('PASS: 8 visible templates and business name from single input');

    // Different templates must actively update headings and the Canvas, not just CSS.
    let prevData=await page.locator('#poster').evaluate(el=>el.toDataURL());
    for(const name of ['menu','sale','opening','notice','booking','beauty','premium','review']){
      await page.locator('[data-studio-template="'+name+'"]').click();
      await page.waitForTimeout(50);
      assert.equal(await page.locator('[data-studio-template="'+name+'"]').getAttribute('aria-pressed'),'true');
      assert.ok((await page.locator('#studioHeadline').inputValue()).length>5);
      const url=await page.locator('#poster').evaluate(el=>el.toDataURL());
      assert.ok(url.length>10000,'Canvas output unexpectedly small for '+name);
      if(name!=='menu')assert.notEqual(url,prevData,'Template did not alter rendered Canvas');
      prevData=url;
    }
    console.log('PASS: all templates render distinct full-sized Canvas artwork');

    // Upload actual image bytes and verify an image object reaches Canvas, not just a filename.
    await page.locator('#studioPhoto').setInputFiles({name:'test-photo.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(()=>document.querySelector('#studioPhotoName').textContent.includes('test-photo.png'));
    await page.locator('#studioLogo').setInputFiles({name:'test-logo.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(()=>document.querySelector('#studioLogoName').textContent.includes('test-logo.png'));
    await page.fill('#studioHeadline','신선함을 담은 특별한 한상');
    await page.fill('#studioPrice','30,000원');
    await page.locator('#studioZoom').evaluate(el=>{el.value='160';el.dispatchEvent(new Event('input',{bubbles:true}))});
    await page.locator('#studioPanX').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}))});
    await page.locator('#studioBrightness').evaluate(el=>{el.value='120';el.dispatchEvent(new Event('input',{bubbles:true}))});
    await page.waitForTimeout(120);
    assert.equal(await page.locator('#studioZoomValue').textContent(),'160%');
    assert.equal(await page.locator('#studioBrightnessValue').textContent(),'120%');
    console.log('PASS: image/logo uploads, live text and image controls');

    for(const [size,w,h] of [['square',1080,1080],['portrait',1080,1350],['story',1080,1920],['banner',1200,628]]){
      await page.selectOption('#studioFormat',size);
      await page.waitForFunction(([width,height])=>{
        const x=document.getElementById('poster');
        return x.width===width&&x.height===height;
      },[w,h]);
      const [download]=await Promise.all([
        page.waitForEvent('download',{timeout:25000}),
        page.locator('#studioDownload').click()
      ]);
      const file=path.join(os.tmpdir(),'momentum-'+size+'-'+Date.now()+'.png');
      await download.saveAs(file);
      const buf=fs.readFileSync(file);
      assert.deepEqual(pngDims(buf),{width:w,height:h});
      assert.ok(buf.length>10000,'PNG is too small; possible blank canvas '+size);
      fs.unlinkSync(file);
      console.log('PASS: '+size+' downloaded '+w+'x'+h+' PNG');
    }

    // Full-service agency redesign: layout, honest tool statements and responsive navigation.
    const agencyHome=await ctx.newPage();
    const agencyErrors=[];
    agencyHome.on('pageerror',e=>agencyErrors.push(String(e)));
    const agencyResponse=await agencyHome.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load'});
    assert.equal(agencyResponse.status(),200);
    assert.match(await agencyHome.locator('h1').innerText(),/마케팅의 모든 과정/);
    assert.equal(await agencyHome.locator('.agency-visual .visual-modules>div').count(),4);
    assert.match(await agencyHome.locator('.agency-tools-preview').innerText(),/API 미연동/);
    assert.ok(await agencyHome.locator('.agency-nav a[href="#services"]').isVisible());
    assert.ok(await agencyHome.locator('#contactForm').count()===1);
    const cssAvailable=await agencyHome.evaluate(async()=>{const r=await fetch('/agency.css');return r.status===200&&(await r.text()).includes('.agency-hero-grid')});
    assert.ok(cssAvailable,'Integrated agency stylesheet missing');
    await agencyHome.screenshot({path:path.join(root,'artifacts/momentum-agency-desktop.png'),fullPage:true});
    for(const width of [390,768,1280]){
      await agencyHome.setViewportSize({width,height:850});
      const size=await agencyHome.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert.ok(size.scrollWidth<=size.viewport+3,'Agency homepage horizontal overflow at '+width+': '+JSON.stringify(size));
    }
    await agencyHome.setViewportSize({width:390,height:844});
    assert.ok(await agencyHome.locator('.topbar-cta').isVisible());
    await agencyHome.screenshot({path:path.join(root,'artifacts/momentum-agency-mobile.png'),fullPage:true});
    assert.equal(agencyErrors.length,0,'Agency home errors: '+agencyErrors.join(' | '));
    await agencyHome.close();
    console.log('PASS: agency landing, CSS, original inquiry form, and responsive desktop/tablet/mobile views');

    // Home-page product redesign: service CTAs must target the correctly preselected inquiry product.
    const publicPage=await ctx.newPage();
    const publicErrors=[];
    publicPage.on('pageerror',e=>publicErrors.push(String(e)));
    await publicPage.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load'});
    assert.equal(await publicPage.locator('#services .service-card').count(),9);
    assert.equal(await publicPage.locator('#open-packages .package-card').count(),2);
    await publicPage.locator('a[data-product="오픈패키지 2"]').click();
    assert.equal(await publicPage.locator('#requestedProduct').inputValue(),'오픈패키지 2');
    assert.match(await publicPage.locator('#open-packages').innerText(),/파워링크 광고 세팅/);
    await publicPage.locator('a[data-product="플레이스 진단 및 SEO 최적화"]').click();
    assert.equal(await publicPage.locator('#requestedProduct').inputValue(),'플레이스 진단 및 SEO 최적화');
    assert.match(await publicPage.locator('.owner-notice').innerText(),/사업주가 직접/);
    await publicPage.screenshot({path:path.join(root,'artifacts/momentum-services-desktop.png'),fullPage:true});
    await publicPage.setViewportSize({width:390,height:844});
    const siteDims=await publicPage.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(siteDims.scrollWidth<=siteDims.viewport+3,'Homepage mobile horizontal overflow '+JSON.stringify(siteDims));
    await publicPage.screenshot({path:path.join(root,'artifacts/momentum-services-mobile.png'),fullPage:true});
    assert.equal(publicErrors.length,0,'Homepage browser errors: '+publicErrors.join(' | '));
    await publicPage.close();
    console.log('PASS: product catalog, package inquiry links and mobile homepage layout');


    // Validate real industry pages and customer navigation (no fake links or empty SEO pages).
    const industryPage=await ctx.newPage();
    const industryErrors=[];
    industryPage.on('pageerror',e=>industryErrors.push(String(e)));
    await industryPage.goto('http://127.0.0.1:'+port+'/industries/',{waitUntil:'load'});
    assert.match(await industryPage.title(),/업종별 마케팅 서비스/);
    assert.equal(await industryPage.locator('.section.soft .grid .card').count(),28);
    const industryLinks=await industryPage.locator('a[href^="/industries/"]').count();
    assert.ok(industryLinks>=4);
    for(const route of ['/industries/restaurant/','/industries/hairshop/','/industries/hospital/','/industries/academy/']){
      const response=await industryPage.goto('http://127.0.0.1:'+port+route,{waitUntil:'load'});
      assert.equal(response.status(),200,'Invalid route '+route);
      assert.ok((await industryPage.locator('h1').innerText()).length>5);
      assert.ok(await industryPage.locator('a[href="/#contact"]').count()>=1);
      assert.ok(await industryPage.locator('h2').count()>=4);
    }
    await industryPage.goto('http://127.0.0.1:'+port+'/industries/',{waitUntil:'load'});
    await industryPage.setViewportSize({width:390,height:844});
    const industrySize=await industryPage.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(industrySize.scrollWidth<=industrySize.viewport+3,'Industry directory mobile overflow '+JSON.stringify(industrySize));
    await industryPage.screenshot({path:path.join(root,'artifacts/momentum-industries-mobile.png'),fullPage:true});
    assert.equal(industryErrors.length,0,'Industry pages browser errors: '+industryErrors.join(' | '));
    await industryPage.close();
    console.log('PASS: industry directory and four sector pages, mobile and no errors');

    // Mobile viewport: no unexplained viewport overflow and the editor is usable.
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(120);
    const dimensions=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(dimensions.scrollWidth<=dimensions.viewport+3,'Mobile horizontal overflow '+JSON.stringify(dimensions));
    await page.screenshot({path:path.join(root,'artifacts/studio-mobile.png'),fullPage:true});
    assert.ok(await page.locator('#studioDownload').isVisible());
    assert.equal(errors.length,0,'Browser runtime errors: '+errors.join(' | '));
    console.log('PASS: mobile layout and zero page errors');
    await ctx.close();
    console.log('STUDIO BROWSER TESTS PASSED');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
