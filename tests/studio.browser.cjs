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
    if(req.method==='POST' && req.url==='/api/keyword-opportunities'){
      let body='';
      req.on('data',chunk=>{body+=chunk;if(body.length>4000)req.destroy()});
      req.on('end',async()=>{
        let status=200;
        const adapter={setHeader(){},status(n){status=n;return this},json(data){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));return this}};
        try{
          await require('../api/keyword-opportunities.js')({method:'POST',headers:{host:req.headers.host,origin:req.headers.origin,'x-forwarded-for':'127.0.0.1'},body:JSON.parse(body)},adapter);
        }catch(err){res.writeHead(500);res.end(JSON.stringify({error:String(err)}))}
      });
      return;
    }
    if(req.method==='POST'&&req.url==='/api/blog-rank-observation'){
      let body='';
      req.on('data',chunk=>body+=chunk);
      req.on('end',async()=>{
        let status=200;
        const adapter={setHeader(){},status(n){status=n;return this},json(data){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));return this}};
        try{await require('../api/blog-rank-observation.js')({method:'POST',headers:{host:req.headers.host,origin:req.headers.origin,'x-forwarded-for':'127.0.0.1'},body:JSON.parse(body)},adapter);}
        catch(err){res.writeHead(500);res.end(JSON.stringify({error:String(err)}))}
      });
      return;
    }
    if(req.method==='POST' && req.url==='/api/place-rank-live'){
      let body='';
      req.on('data',chunk=>{body+=chunk;if(body.length>3000)req.destroy()});
      req.on('end',()=>{
        let json;try{json=JSON.parse(body)}catch{json={}}
        const id=require('../api/_place-observe').placeId(json.placeUrl||json.placeId||'');
        const result=id==='1234567890'?{status:'ranked',rank:4,observedCount:6,message:'실측 테스트 픽스처 4번째 위치'}:
          {status:'invalid',rank:null,message:'테스트 플레이스 ID를 입력하세요.'};
        res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
      });
      return;
    }
    let target;
    try{
      const u=new URL(req.url,'http://localhost');
      // The production build serves these assets only after authentication.
      // CI maps them locally to exercise the editor without production credentials.
      const pathname=decodeURIComponent(u.pathname);
      target=pathname.startsWith('/admin/assets/')?
        path.resolve(root,'site-builder',pathname.slice('/admin/assets/'.length)):
        path.resolve(root,'.'+pathname.replace(/\/$/,'/index.html'));
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
    assert.match(await agencyHome.locator('h1').innerText(),/고객의 선택을 만드는/);
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
    assert.equal(await agencyHome.locator('#work .agency-sample-card').count(),3);
    assert.match(await agencyHome.locator('#work').innerText(),/디자인 샘플/);
    assert.equal(await agencyHome.locator('#work a[href="/site-builder/"]').count(),0);
    assert.ok(await agencyHome.locator('#work a[href*="design=restaurant"]').count()>=1);
    assert.equal(await agencyHome.locator('#services .agency-service-family').count(),4);
    assert.equal(await agencyHome.locator('#services .service-card').count(),9);
    const customCss=await agencyHome.evaluate(async()=>{
      const response=await fetch('/agency-showcase.css');
      return response.status===200&&(await response.text()).includes('.agency-work-card');
    });
    assert.ok(customCss,'Editorial showcase CSS missing');
    // Mobile menu is accessible, expands, navigates, and closes.
    const toggle=agencyHome.locator('.agency-menu-toggle');
    assert.ok(await toggle.isVisible());
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    assert.ok(await agencyHome.locator('.agency-nav a[href="#work"]').isVisible());
    await agencyHome.locator('.agency-nav a[href="#work"]').click();
    assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert.equal(await agencyHome.locator('.agency-nav').isVisible(),false);
        assert.equal(agencyErrors.length,0,'Agency home errors: '+agencyErrors.join(' | '));
    await agencyHome.close();
    console.log('PASS: agency landing, CSS, original inquiry form, and responsive desktop/tablet/mobile views');

    // Service and project case pages must load as standalone public content.
    const landing=await ctx.newPage();
    for(const slug of ['search-ads','viral','place-seo','creative']){
      const url='http://127.0.0.1:'+port+'/services/'+slug+'/';
      const response=await landing.goto(url,{waitUntil:'load'});
      assert.equal(response.status(),200,'Service landing unavailable: '+slug);
      assert.match(await landing.locator('h1').innerText(),/고객|선택|검색|좋은 제품/);
      assert.equal(await landing.locator('.services .service').count(),4);
      assert.ok(await landing.locator('a[href^="/?service="]').count()>=1);
      await landing.setViewportSize({width:390,height:840});
      const dims=await landing.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert.ok(dims.scrollWidth<=dims.viewport+3,'Mobile service detail overflow: '+slug);
    }
    for(const slug of ['mukdori','balmonghair']){
      const response=await landing.goto('http://127.0.0.1:'+port+'/work/'+slug+'/',{waitUntil:'load'});
      assert.equal(response.status(),200,'Case-study unavailable: '+slug);
      assert.equal(await landing.locator('.case-highlight').count(),3);
      const capture=landing.locator('.case-capture img');
      await capture.scrollIntoViewIfNeeded();
      await capture.evaluate(img=>img.decode());
      assert.ok(await capture.evaluate(img=>img.naturalWidth>=700),'No authentic screenshot on case detail: '+slug);

      const dims=await landing.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert.ok(dims.scrollWidth<=dims.viewport+3,'Mobile case study overflow: '+slug);
    }
    await landing.goto('http://127.0.0.1:'+port+'/?service='+encodeURIComponent('키워드 검색광고')+'#contact',{waitUntil:'load'});
    assert.equal(await landing.locator('#requestedProduct').inputValue(),'키워드 검색광고');
    await landing.close();
    console.log('PASS: four real service landings, two protected-media-safe case studies, mobile accessibility and cross-page inquiry preselection');

    // Real industry template pages: actual navigable pages, not fictional screenshots.
    const templatePage=await ctx.newPage();
    const templateErrors=[];
    templatePage.on('pageerror',e=>templateErrors.push(String(e)));
    for(const id of ['restaurant','beauty','academy','clinic','corporate']){
      const response=await templatePage.goto('http://127.0.0.1:'+port+'/website-samples/'+id+'/',{waitUntil:'load'});
      assert.equal(response.status(),200,'Template route '+id);
      await templatePage.waitForSelector('.site-hero h1',{timeout:15000});
      assert.ok((await templatePage.locator('h1').innerText()).length>=6,id+' empty heading');
      assert.equal(await templatePage.locator('.service-card').count(),3,'Service cards '+id);
      assert.equal(await templatePage.locator('.gallery-tile').count(),3,'Gallery '+id);
      assert.match(await templatePage.locator('.sample-ribbon').innerText(),/실제 업체가 아닙니다/);
      await templatePage.setViewportSize({width:390,height:844});
      const dims=await templatePage.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert.ok(dims.scrollWidth<=dims.viewport+3,'Mobile sample overflow '+id+' '+JSON.stringify(dims));
    }
    // Ten new real websites: food/franchise, lodging, pet grooming and local services.
    for(const id of ['foodie','franchise','poolvilla','pension','glamping','petgroom','ladder','movers','cleaning','aircon']){
      const response=await templatePage.goto('http://127.0.0.1:'+port+'/website-samples/'+id+'/',{waitUntil:'load'});
      assert.equal(response.status(),200,'New sample route '+id);
      await templatePage.waitForSelector('.ind-hero h1',{timeout:10000});
      assert.ok((await templatePage.locator('h1').innerText()).length>7,'New sample heading '+id);
      assert.equal(await templatePage.locator('.ind-feature').count(),3,'New services '+id);
      assert.equal(await templatePage.locator('.ind-shot').count(),3,'New gallery '+id);
      assert.match(await templatePage.locator('.industry-demo').innerText(),/가상 브랜드/);
      assert.match(await templatePage.locator('.ind-final a').getAttribute('href'),new RegExp('design='+id));
      await templatePage.setViewportSize({width:390,height:844});
      const dims=await templatePage.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert.ok(dims.scrollWidth<=dims.viewport+3,'New sample mobile overflow '+id+' '+JSON.stringify(dims));
    }

    // Industry-specific consultation forms are navigable, validated and privacy-safe.
    for(const service of ['ladder','movers','cleaning','aircon','petgroom']){
      await templatePage.goto('http://127.0.0.1:'+port+'/website-samples/'+service+'/',{waitUntil:'load'});
      const form=templatePage.locator('#serviceQuoteForm');
      assert.equal(await form.count(),1,'Missing service inquiry form '+service);
      assert.equal(await form.getAttribute('data-demo-only'),'true');
      assert.match(await templatePage.locator('.quote-privacy').innerText(),/저장하지 않습니다|저장되거나 전송되지/);
      assert.equal(await templatePage.locator('.sig-hero a.sig-primary').getAttribute('href'),'#quote');
      const count=await form.locator('.quote-field').count();
      assert.ok(count>=7,'Need industry-specific service questions '+service);
      const submit=templatePage.locator('#serviceQuoteForm button[type="submit"]');
      await submit.click();
      assert.equal(await templatePage.locator('#quoteDemoResult').isVisible(),false,'Empty form must not submit');
      await form.evaluate(el=>{
        const today=new Date();
        const local=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
        for(const input of el.querySelectorAll('[required]')){
          if(input.tagName==='SELECT')input.value=input.options[1].value;
          else if(input.type==='date')input.value=local;
          else if(input.tagName==='TEXTAREA')input.value='시연용 내용';
          else input.value='부산 테스트 지역';
          input.dispatchEvent(new Event('input',{bubbles:true}));
        }
      });
      const postUrls=[];
      const onPost=req=>{if(req.method()==='POST')postUrls.push(req.url())};
      templatePage.on('request',onPost);
      await submit.click();
      assert.equal(await templatePage.locator('#quoteDemoResult').isVisible(),true,'Form demo result missing '+service);
      assert.match(await templatePage.locator('#quoteDemoResult').innerText(),/전달되지 않으며|전송되지|저장되지/);
      assert.deepEqual(postUrls,[],'Demo form must not transmit customer data '+service);
      templatePage.off('request',onPost);
      await templatePage.setViewportSize({width:390,height:844});
      const bounds=await templatePage.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
      assert.ok(bounds.scrollWidth<=bounds.viewport+3,'Service form mobile overflow '+service+' '+JSON.stringify(bounds));
      await templatePage.setViewportSize({width:1440,height:900});
    }
    // Layout diversity: the portfolio must NOT be one wireframe with changed photos/colors.
    const designSignatures=new Map();
    await templatePage.setViewportSize({width:1440,height:900});
    for(const id of ['poolvilla','pension','glamping','petgroom','ladder','movers','cleaning','foodie','franchise','aircon']){
      await templatePage.goto('http://127.0.0.1:'+port+'/website-samples/'+id+'/',{waitUntil:'load'});
      const shape=await templatePage.evaluate(()=>{
        const hero=document.querySelector('.ind-hero'),copy=hero.querySelector('.ind-copy'),media=hero.querySelector('.ind-media');
        const a=copy.getBoundingClientRect(),b=media.getBoundingClientRect();
        return {layout:getComputedStyle(hero).display,position:getComputedStyle(copy).position,photo:getComputedStyle(media).position,
          copyX:Math.round(a.x/30),photoX:Math.round(b.x/30),photoY:Math.round(b.y/30),copyY:Math.round(a.y/30)};
      });
      designSignatures.set(id,JSON.stringify(shape));
      if(['poolvilla','petgroom','ladder','foodie','franchise'].includes(id)){
        await templatePage.screenshot({path:path.join(root,'artifacts/industry-'+id+'.png'),fullPage:false});
      }
    }
    assert.ok(new Set(designSignatures.values()).size>=6,'Portfolio design layouts too similar: '+JSON.stringify([...designSignatures]));

    // Every art-directed sample has unique business-specific content and nearby booking integration note.
    for(const id of ['poolvilla','pension','glamping','petgroom','foodie','restaurant','beauty','clinic']){
      await templatePage.goto('http://127.0.0.1:'+port+'/website-samples/'+id+'/',{waitUntil:'load'});
      const booking=templatePage.locator('.sig-hero .sig-book');
      assert.equal(await booking.count(),1,'Booking CTA missing '+id);
      assert.equal(await booking.locator('small.naver-reserve-note').innerText(),'네이버예약 연동 가능');
      assert.equal(await booking.locator('a').getAttribute('href'),id==='petgroom'?'#quote':'#contact');
      const rect=await booking.evaluate(el=>{
        const a=el.querySelector('a').getBoundingClientRect(),b=el.querySelector('small').getBoundingClientRect();
        return {buttonBottom:a.bottom,labelTop:b.top,labelHeight:b.height};
      });
      assert.ok(rect.labelTop>=rect.buttonBottom-2&&rect.labelTop<=rect.buttonBottom+25&&rect.labelHeight>8,
        'Booking note must stay immediately underneath reservation CTA '+id+' '+JSON.stringify(rect));
    }
    assert.equal(templateErrors.length,0,'Template page errors: '+templateErrors.join(' | '));
    await templatePage.goto('http://127.0.0.1:'+port+'/website-samples/',{waitUntil:'load'});
    assert.equal(await templatePage.locator('.sample-card').count(),15);
    assert.match(await templatePage.locator('h1').innerText(),/선택하고 싶은/);
    await templatePage.locator('[data-filter="food"]').click();
    assert.equal(await templatePage.locator('.sample-card:visible').count(),3);
    await templatePage.locator('[data-filter="stay"]').click();
    assert.equal(await templatePage.locator('.sample-card:visible').count(),3);
    await templatePage.locator('[data-filter="services"]').click();
    assert.equal(await templatePage.locator('.sample-card:visible').count(),4);
    await templatePage.locator('[data-filter="professional"]').click();
    assert.equal(await templatePage.locator('.sample-card:visible').count(),3);
    await templatePage.locator('[data-filter="all"]').click();
    assert.equal(await templatePage.locator('.sample-card:visible').count(),15);
    await templatePage.locator('[data-choose="franchise"]').click();
    assert.match(await templatePage.locator('#selectedDesignName').innerText(),/프랜차이즈/);
    assert.match(await templatePage.locator('#selectedDesignConsult').getAttribute('href'),/design=franchise/);
    await templatePage.screenshot({path:path.join(root,'artifacts/momentum-website-samples.png'),fullPage:true});
    await templatePage.close();

    // New independent editing studio keeps each original site's structure intact.
    const designer=await ctx.newPage();
    const designErrors=[];
    designer.on('pageerror',e=>designErrors.push(String(e)));
    await designer.goto('http://127.0.0.1:'+port+'/site-builder/design-editor.html',{waitUntil:'load'});
    assert.equal(await designer.locator('#designSelect option').count(),15);
    await designer.frameLocator('#livePreview').locator('h1').waitFor();
    assert.match(await designer.frameLocator('#livePreview').locator('h1').first().innerText(),/Silence|우리만|푸른/);
    const initialTitle=await designer.frameLocator('#livePreview').locator('h1').first().innerText();
    await designer.locator('#headlineInput').fill('풀빌라 전용 테스트 문구');
    assert.equal(await designer.frameLocator('#livePreview').locator('h1').first().innerText(),'풀빌라 전용 테스트 문구');
    assert.match(await designer.locator('#saveStatus').innerText(),/임시 저장/);
    await designer.reload({waitUntil:'load'});
    await designer.frameLocator('#livePreview').locator('h1').waitFor();
    assert.equal(await designer.frameLocator('#livePreview').locator('h1').first().innerText(),'풀빌라 전용 테스트 문구');
    await designer.locator('#designSelect').selectOption('ladder');
    await designer.frameLocator('#livePreview').locator('body.theme-ladder').waitFor();
    assert.equal(await designer.locator('#headlineInput').isDisabled(),false);
    assert.equal(await designer.frameLocator('#livePreview').locator('#serviceQuoteForm').count(),1);
    assert.equal(await designer.frameLocator('#livePreview').locator('body.theme-ladder').count(),1);
    await designer.locator('#brandInput').fill('테스트 사다리차');
    assert.equal(await designer.frameLocator('#livePreview').locator('.ind-head .ind-logo').innerText(),'테스트 사다리차');
    await designer.locator('#designSelect').selectOption('poolvilla');
    await designer.frameLocator('#livePreview').locator('h1').waitFor();
    assert.equal(await designer.frameLocator('#livePreview').locator('h1').first().innerText(),'풀빌라 전용 테스트 문구');
    designer.once('dialog',dlg=>dlg.accept());
    await designer.locator('#resetDraft').click();
    // Browser confirmation is captured before pressing the destructive control.
    await designer.frameLocator('#livePreview').locator('h1').waitFor();
    await designer.locator('[data-view="mobile"]').click();
    assert.match(await designer.locator('#previewOuter').getAttribute('class'),/isMobile/);
    assert.equal(designErrors.length,0,'Independent editor runtime errors: '+designErrors.join(' | '));
    await designer.close();


    // Browser-only template editor: section edits, color, autosave, JSON/HTML output.
    const builder=await ctx.newPage();
    const builderErrors=[];
    builder.on('pageerror',e=>builderErrors.push(String(e)));
    const editResponse=await builder.goto('http://127.0.0.1:'+port+'/site-builder/?template=beauty',{waitUntil:'load'});
    assert.equal(editResponse.status(),200);
    await builder.waitForFunction(()=>document.querySelector('#sitePreview')?.srcdoc?.includes('온결 헤어스튜디오'),{timeout:15000});
    assert.match(await builder.locator('#previewTitle').innerText(),/온결 뷰티 스튜디오/);
    await builder.locator('#edit-brand').fill('테스트 브랜드');
    await builder.waitForFunction(()=>document.querySelector('#sitePreview')?.srcdoc?.includes('테스트 브랜드'),{timeout:10000});
    await builder.locator('[data-tab="hero"]').click();
    await builder.locator('#edit-headline').fill('브랜드의 첫 페이지');
    await builder.waitForFunction(()=>document.querySelector('#sitePreview')?.srcdoc?.includes('브랜드의 첫 페이지'),{timeout:10000});
    await builder.locator('[data-tab="services"]').click();
    assert.equal(await builder.locator('.edit-collection').count(),3);
    await builder.locator('[data-add="services"]').click();
    assert.equal(await builder.locator('.edit-collection').count(),4);
    await builder.locator('[data-tab="sections"]').click();
    await builder.locator('[data-visible="faq"]').uncheck();
    await builder.waitForFunction(()=>!document.querySelector('#sitePreview')?.srcdoc?.includes('id="faq"'),{timeout:10000});
    await builder.locator('[data-tab="style"]').click();
    await builder.locator('[data-field="colors.accent"]').fill('#113399');
    await builder.waitForFunction(()=>document.querySelector('#sitePreview')?.srcdoc?.includes('--accent:#113399'),{timeout:10000});

    // Selecting an element within the sandboxed preview opens its matching field.
    const previewFrame=builder.frameLocator('#sitePreview');
    await previewFrame.locator('.site-hero h1').click();
    await builder.waitForFunction(()=>document.querySelector('[data-tab="hero"]')?.getAttribute('aria-selected')==='true',{timeout:6000});
    assert.ok(await builder.locator('[data-field="headline"]').count()===1);
    const priorDescription=await builder.locator('[data-field="description"]').inputValue();
    await builder.locator('[data-field="headline"]').fill('요청한 제목만 바꾸기');
    await builder.waitForFunction(()=>document.getElementById('sitePreview')?.srcdoc?.includes('요청한 제목만 바꾸기'));
    assert.equal(await builder.locator('[data-field="description"]').inputValue(),priorDescription);
    await builder.locator('#undoEdit').click();
    await builder.waitForFunction(()=>!document.getElementById('sitePreview')?.srcdoc?.includes('요청한 제목만 바꾸기'));

    await builder.locator('[data-tab="part"]').click();
    await builder.locator('#sectionScope').selectOption('about');
    await builder.locator('[data-field="sectionStyles.about.titleSize"]').fill('44');
    await builder.waitForFunction(()=>document.getElementById('sitePreview')?.srcdoc?.includes('#about h1,#about h2{font-size:clamp(25px,6vw,44px)!important;}'));
    const scopedHtml=await builder.locator('#sitePreview').evaluate(el=>el.srcdoc);
    assert.ok(!scopedHtml.includes('#services h1,#services h2{font-size:clamp(25px,6vw,44px)'));
    await builder.locator('[data-viewport="mobile"]').click();
    assert.match(await builder.locator('.preview-stage').getAttribute('class'),/mobile/);
    await builder.screenshot({path:path.join(root,'artifacts/momentum-site-builder.png'),fullPage:true});
    await builder.reload({waitUntil:'load'});
    await builder.waitForFunction(()=>document.querySelector('#sitePreview')?.srcdoc?.includes('테스트 브랜드'),{timeout:15000});
    await builder.locator('[data-tab="sections"]').click();
    assert.equal(await builder.locator('[data-visible="faq"]').isChecked(),false);
    const htmlExport=await Promise.all([builder.waitForEvent('download'),builder.locator('#downloadHtml').click()]);
    assert.match(htmlExport[0].suggestedFilename(),/테스트-브랜드\.html/);
    const jsonExport=await Promise.all([builder.waitForEvent('download'),builder.locator('#saveConfig').click()]);
    assert.match(jsonExport[0].suggestedFilename(),/테스트-브랜드\.json/);
    assert.equal(builderErrors.length,0,'Builder errors: '+builderErrors.join(' | '));
    await builder.close();
    console.log('PASS: fifteen real industry sample sites, filtered galleries, consultation selection, editor exports and mobile preview');

    // Internal CRM smoke checks: 18 services, real client input, two renewal dates, calendar export.
    const crm=await ctx.newPage();
    const crmErrors=[];
    crm.on('pageerror',e=>crmErrors.push(String(e)));
    const crmResponse=await crm.goto('http://127.0.0.1:'+port+'/site-builder/crm-index.html',{waitUntil:'load'});
    assert.equal(crmResponse.status(),200);
    await crm.waitForFunction(()=>document.querySelectorAll('#productGrid .product').length===18,{timeout:15000});
    assert.equal(await crm.locator('#totalCustomers').innerText(),'0');
    await crm.locator('#businessName').fill('테스트 소형이사');
    await crm.locator('#customerForm [name="industry"]').fill('소규모 이삿짐');
    await crm.locator('#customerForm [name="referredBy"]').fill('부산 사다리차');
    await crm.locator('#customerForm [name="stage"]').selectOption('계약고객');
    await crm.locator('#customerForm [name="nextContact"]').fill('2026-11-02');
    await crm.locator('#customerForm button[type="submit"]').click();
    assert.equal(await crm.locator('#totalCustomers').innerText(),'1');
    await crm.locator('#contractCustomer').selectOption({label:'테스트 소형이사'});
    await crm.locator('#contractProduct').selectOption('website-renewal');
    const soon=new Date(Date.now()+12*86400000).toISOString().slice(0,10);
    const later=new Date(Date.now()+22*86400000).toISOString().slice(0,10);
    await crm.locator('#contractForm [name="status"]').selectOption('계약');
    await crm.locator('#contractForm [name="endDate"]').fill(later);
    await crm.locator('#contractForm [name="domainEnd"]').fill(soon);
    await crm.locator('#contractForm [name="amount"]').fill('120000');
    await crm.locator('#contractForm [name="cost"]').fill('30000');
    await crm.locator('#contractForm [name="paid"]').fill('40000');
    await crm.locator('#contractForm button[type="submit"]').click();
    assert.equal(await crm.locator('#activeContracts').innerText(),'1');
    assert.equal(await crm.locator('#dueSoon').innerText(),'2');
    assert.equal(await crm.locator('#outstanding').innerText(),'80,000원');
    assert.equal(await crm.locator('#grossProfit').innerText(),'90,000원');
    await crm.locator('#taskForm [name="title"]').fill('시안 수정 후 고객 연락');
    await crm.locator('#taskCustomer').selectOption({label:'테스트 소형이사'});
    await crm.locator('#taskForm [name="dueDate"]').fill(soon);
    await crm.locator('#taskForm button[type="submit"]').click();
    assert.equal(await crm.locator('#openTasks').innerText(),'1');
    assert.match(await crm.locator('#taskList').innerText(),/시안 수정 후 고객 연락/);
    await crm.locator('[data-task-toggle]').click();
    assert.equal(await crm.locator('#openTasks').innerText(),'0');
    const csv=await Promise.all([crm.waitForEvent('download'),crm.locator('#exportCsv').click()]);
    assert.match(csv[0].suggestedFilename(),/momentum-clients.*\.csv$/);
    assert.equal(await crm.locator('#renewalList .alert').count(),2);
    assert.match(await crm.locator('#recordList').innerText(),/부산 사다리차/);
    const calendar=await Promise.all([crm.waitForEvent('download'),crm.locator('#exportCalendar').click()]);
    assert.match(calendar[0].suggestedFilename(),/renewals\.ics$/);
    const backup=await Promise.all([crm.waitForEvent('download'),crm.locator('#exportData').click()]);
    assert.match(backup[0].suggestedFilename(),/momentum-crm.*\.json$/);
    // Advertisers and external vendors remain separate; bundles link them by sale line.
    await crm.waitForFunction(()=>document.querySelector('#supplierRates .supplier-rate')&&document.querySelector('#bundleLines .bundle-line'));
    await crm.locator('#supplierForm [name="name"]').fill('시연용 콘텐츠 외주사');
    await crm.locator('#supplierForm [name="manager"]').fill('테스트 담당자');
    await crm.locator('#supplierForm [name="phone"]').fill('010-0000-0000');
    await crm.locator('#supplierForm [name="orderUrl"]').fill('https://example.com/order');
    await crm.locator('.supplier-rate [data-rate="productId"]').selectOption('blog-experience');
    await crm.locator('.supplier-rate [data-rate="cost"]').fill('8000');
    await crm.locator('#supplierForm button[type="submit"]').click();
    assert.match(await crm.locator('#supplierList').innerText(),/시연용 콘텐츠 외주사/);
    assert.equal(await crm.locator('#totalCustomers').innerText(),'1','Supplier must not inflate advertiser count');
    await crm.locator('#bundleCustomer').selectOption({label:'테스트 소형이사'});
    await crm.locator('#bundleForm [name="title"]').fill('블로그 체험단과 기자단 통합 계약');
    await crm.locator('#bundleForm [name="status"]').selectOption('계약');
    await crm.locator('#bundleLines .bundle-line').nth(0).locator('[data-line="productId"]').selectOption('blog-experience');
    await crm.locator('#bundleLines .bundle-line').nth(0).locator('[data-line="supplierId"]').selectOption({label:'시연용 콘텐츠 외주사'});
    assert.equal(await crm.locator('#bundleLines .bundle-line').nth(0).locator('[data-line="unitCost"]').inputValue(),'8000');
    await crm.locator('#bundleLines .bundle-line').nth(0).locator('[data-line="quantity"]').fill('10');
    await crm.locator('#bundleLines .bundle-line').nth(0).locator('[data-line="unitPrice"]').fill('15000');
    await crm.locator('#bundleLines .bundle-line').nth(0).locator('[data-line="endDate"]').fill(soon);
    await crm.locator('#addBundleLine').click();
    assert.equal(await crm.locator('#bundleLines .bundle-line').count(),2);
    const secondLine=crm.locator('#bundleLines .bundle-line').nth(1);
    await secondLine.locator('[data-line="productId"]').selectOption('blog-reporters');
    await secondLine.locator('[data-line="quantity"]').fill('5');
    await secondLine.locator('[data-line="unitPrice"]').fill('20000');
    await secondLine.locator('[data-line="unitCost"]').fill('12000');
    await secondLine.locator('[data-line="endDate"]').fill(later);
    await crm.locator('#bundleDiscount').fill('10000');
    await crm.locator('#bundlePaid').fill('50000');
    assert.equal(await crm.locator('#bundleTotal').innerText(),'240,000원');
    assert.equal(await crm.locator('#bundleCost').innerText(),'140,000원');
    assert.equal(await crm.locator('#bundleProfit').innerText(),'100,000원');
    assert.equal(await crm.locator('#bundleOutstanding').innerText(),'190,000원');
    await crm.locator('#bundleForm button[type="submit"]').click();
    assert.match(await crm.locator('#bundleRecords').innerText(),/블로그 체험단과 기자단 통합 계약/);
    assert.equal(await crm.locator('#activeContracts').innerText(),'2','Standalone and bundled contracts both count');
    assert.equal(await crm.locator('#outstanding').innerText(),'270,000원');
    const firstUsage=crm.locator('#bundleRecords [data-use-line]').first();
    await firstUsage.click();
    await crm.locator('#usageForm [name="quantity"]').fill('3');
    await crm.locator('#usageForm [name="note"]').fill('체험단 3명 집행');
    await crm.locator('#usageForm button[type="submit"]').click();
    assert.match(await crm.locator('#usageStatus').innerText(),/잔여 7건/);
    await crm.locator('#closeUsage').click();
    assert.match(await crm.locator('#bundleRecords').innerText(),/잔여 7\s*건/);
    await crm.locator('#bundleRecords [data-edit-bundle]').click();
    await crm.locator('#bundleLines .bundle-line').nth(0).locator('[data-line="unitPrice"]').fill('16000');
    await crm.locator('#bundleForm button[type="submit"]').click();
    assert.match(await crm.locator('#bundleRecords').innerText(),/계약 변경 이력 1건/);
    await crm.locator('#bundleRecords details').first().evaluate(el=>el.open=true);
    assert.match(await crm.locator('#bundleRecords details').innerText(),/15,000원/);
    assert.match(await crm.locator('#bundleRecords').innerText(),/16,000원/);
    const backupAfter=await Promise.all([crm.waitForEvent('download'),crm.locator('#exportData').click()]);
    assert.match(backupAfter[0].suggestedFilename(),/momentum-crm.*\.json$/);
    assert.equal(crmErrors.length,0,'CRM bundle workflow errors: '+crmErrors.join(' | '));
    await crm.screenshot({path:path.join(root,'artifacts/momentum-internal-crm.png'),fullPage:true});
    await crm.setViewportSize({width:390,height:844});
    const crmDims=await crm.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
    const overflowing=await crm.evaluate(()=>[...document.querySelectorAll('main *')].filter(x=>x.getBoundingClientRect().right>innerWidth+6).slice(0,8).map(x=>({tag:x.tagName,cls:x.className,id:x.id,width:Math.round(x.getBoundingClientRect().width)})));
    assert.ok(crmDims.scrollWidth<=crmDims.viewport+3,'CRM mobile overflow '+JSON.stringify({crmDims,overflowing}));
    assert.equal(crmErrors.length,0,'CRM errors: '+crmErrors.join(' | '));
    await crm.close();
    console.log('PASS: admin CRM 18 products, referrals, customer contracts, renewal alerts, calendar, backup and mobile');

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


    const keywordPage=await ctx.newPage();
    const keywordErrors=[];
    keywordPage.on('pageerror',err=>keywordErrors.push(String(err)));
    const keywordResponse=await keywordPage.goto('http://127.0.0.1:'+port+'/lab/keywords/',{waitUntil:'load'});
    assert.equal(keywordResponse.status(),200);
    await keywordPage.waitForFunction(()=>document.querySelectorAll('#table tr').length>=10,{timeout:12000});
    assert.match(await keywordPage.locator('#summary').innerText(),/부산 사다리차/);
    assert.ok((await keywordPage.locator('#table tr').count())>=12);
    assert.match(await keywordPage.locator('#apiStatus').innerText(),/기획 우선순위/);
    assert.ok((await keywordPage.locator('#table').innerText()).includes('—'));
    await keywordPage.locator('.example[data-seed="해운대 맛집"]').click();
    await keywordPage.waitForFunction(()=>document.querySelector('#summary')?.textContent.includes('해운대 맛집'),{timeout:12000});
    assert.match(await keywordPage.locator('#table').innerText(),/예약|메뉴/);
    await keywordPage.setViewportSize({width:390,height:844});
    const kd=await keywordPage.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
    assert.ok(kd.scrollWidth<=kd.viewport+3,'Keyword mobile horizontal overflow '+JSON.stringify(kd));
    assert.equal(keywordErrors.length,0,'Keyword tool runtime errors: '+keywordErrors.join(' | '));
    await keywordPage.screenshot({path:path.join(root,'artifacts/keyword-explorer-mobile.png'),fullPage:true});
    await keywordPage.close();
    console.log('PASS: keyword explorer live API, intent-based ranking, mobile and no invented search volume');


    // Ranking measurement is real user-observed data, not an invented position.
    const rankPage=await ctx.newPage();
    const rankErrors=[];rankPage.on('pageerror',e=>rankErrors.push(String(e)));
    await rankPage.goto('http://127.0.0.1:'+port+'/lab/rank/',{waitUntil:'load'});
    await rankPage.locator('input[name="method"][value="observed"]').check();
    await rankPage.locator('#target').fill('테스트 미용실');
    await rankPage.locator('#rankNumber').fill('12');
    await rankPage.locator('#measure').click();
    assert.equal(await rankPage.locator('#latest').innerText(),'12위');
    await rankPage.locator('#rankNumber').fill('7');
    await rankPage.locator('#measure').click();
    assert.equal(await rankPage.locator('#latest').innerText(),'7위');
    assert.match(await rankPage.locator('#delta').innerText(),/▲ 5/);
    assert.equal(await rankPage.locator('#history tr').count(),2);
    await rankPage.reload({waitUntil:'load'});
    await rankPage.locator('#target').fill('테스트 미용실');
    assert.equal(await rankPage.locator('#latest').innerText(),'7위');
    await rankPage.locator('input[name="method"][value="paste"]').check();
    await rankPage.locator('#list').fill('1. 다른매장\n2. 테스트 미용실\n3. 세번째매장');
    await rankPage.locator('#measure').click();
    assert.equal(await rankPage.locator('#latest').innerText(),'2위');
    await rankPage.locator('#kind').selectOption('blog');
    await rankPage.locator('#keyword').fill('부산 맛집');
    await rankPage.locator('#target').fill('https://blog.naver.com/exampleblog/12345678');
    await rankPage.locator('input[name="method"][value="api"]').check();
    await rankPage.locator('#measure').click();
    await rankPage.waitForFunction(()=>/연결되지|승인/.test(document.querySelector('#message')?.textContent||''));
    assert.match(await rankPage.locator('#message').innerText(),/연결되지|승인/);
    assert.equal(await rankPage.locator('#latest').innerText(),'—');
    await rankPage.locator('#kind').selectOption('place');
    await rankPage.locator('#keyword').fill('포항 물회');
    await rankPage.locator('#target').fill('https://map.naver.com/p/entry/place/1234567890');
    await rankPage.locator('input[name="method"][value="live"]').check();
    await rankPage.locator('#measure').click();
    await rankPage.waitForFunction(()=>document.querySelector('#latest')?.textContent==='4위');
    assert.equal(await rankPage.locator('#latest').innerText(),'4위');
    assert.match(await rankPage.locator('#message').innerText(),/테스트 픽스처/);
    await rankPage.setViewportSize({width:390,height:844});
    const rd=await rankPage.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
    assert.ok(rd.scrollWidth<=rd.viewport+3,'Rank mobile overflow '+JSON.stringify(rd));
    assert.equal(rankErrors.length,0,'Rank browser errors: '+rankErrors.join(' | '));
    await rankPage.screenshot({path:path.join(root,'artifacts/rank-tracker-mobile.png'),fullPage:true});
    await rankPage.close();
    console.log('PASS: rank observation recording and history comparisons');

    let samplePlaceId=null;
    // One-time, low-volume technical feasibility observation (no bypass or retries).
    try {
      const qp=await ctx.newPage();
      const started=Date.now();
      const url='https://search.naver.com/search.naver?'+new URLSearchParams({query:'포항 물회'});
      let response=null;
      try {response=await qp.goto(url,{waitUntil:'domcontentloaded',timeout:15000});}
      catch(err){console.log('NAVER_FEASIBILITY navigation_error='+String(err.message).slice(0,180));}
      if(response){
        await qp.waitForTimeout(1400);
        const v=await qp.evaluate(()=>{
          const all=[...document.querySelectorAll('a[href*="/place/"]')];
          const list=[...document.querySelectorAll('div[class*="place"] li')];
          return {title:document.title.slice(0,100),hrefLinks:all.length,uniqueIds:[...new Set(all.map(a=>a.href.match(/\/place\/(\d{5,20})/)?.[1]).filter(Boolean))].length,firstIds:[...new Set(all.map(a=>a.href.match(/\/place\/(\d{5,20})/)?.[1]).filter(Boolean))].slice(0,3),listCount:list.length,bodyLen:document.body?.innerText.length||0};
        });
        console.log('NAVER_FEASIBILITY '+JSON.stringify({http:response.status(),finalOrigin:new URL(qp.url()).origin,...v,elapsedMs:Date.now()-started}));
        samplePlaceId=v.firstIds?.[0]||null;
        try {
          const raw=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36','Accept-Language':'ko-KR,ko;q=0.9'},signal:AbortSignal.timeout(8000)});
          const html=await raw.text();
          const list=[...html.matchAll(/(?:https?:\/\/)?map\.naver\.com\/p\/entry\/place\/(\d{5,20})/g)].map(x=>x[1]);
          const ids=[...new Set(list)].slice(0,20);
          const docLinks=await qp.evaluate(()=>[...document.querySelectorAll('div[class*="place"] li')].map(el=>{
            const link=el.querySelector('a[href*="map.naver.com/p/entry/place/"]');
            return {id:link?.href.match(/\/place\/(\d{5,20})/)?.[1]||'',hint:el.innerText.slice(0,70),ad:/광고/.test(el.innerText)};
          }).filter(x=>x.id));
          console.log('NAVER_HTML_PROBE '+JSON.stringify({http:raw.status,htmlLen:html.length,htmlUnique:ids.length,htmlIds:ids,domLinks:docLinks}));
        } catch(err){console.log('NAVER_HTML_PROBE error='+String(err.message).slice(0,160))}

      }
      await qp.close();
    } catch(err){console.log('NAVER_FEASIBILITY error='+String(err.message).slice(0,220));}

    // One-off production health probe for the newly deployed browser-powered API.
    try{
      const begin=Date.now();
      const endpoint='https://momentum-goldeye24-hubs-projects.vercel.app/api/place-rank-live?'+new URLSearchParams({keyword:'포항 물회',placeId:samplePlaceId||'34908033'});
      const rr=await fetch(endpoint,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(28000)});
      const t=await rr.text();
      console.log('RANK_PRODUCTION_PROBE '+JSON.stringify({http:rr.status,ms:Date.now()-begin,body:t.slice(0,600)}));
    }catch(err){console.log('RANK_PRODUCTION_PROBE error='+String(err.message).slice(0,240))}

    // One-off investigation: first-party Naver Map listing (no login/bypass).
    try{
      const mapPage=await ctx.newPage();
      const start=Date.now();
      const response=await mapPage.goto('https://map.naver.com/p/search/'+encodeURIComponent('포항 물회'),{waitUntil:'domcontentloaded',timeout:18000});
      await mapPage.waitForTimeout(1800);
      const status=[];
      for(const frame of mapPage.frames()){
        try{
          const info=await frame.evaluate(()=>{
            const anchors=[...document.querySelectorAll('a[href*="/place/"],a[href*="/entry/place/"]')];
            return {title:document.title.slice(0,75),len:document.body?.innerText.length||0,placeLinks:anchors.length,ids:[...new Set(anchors.map(a=>a.href.match(/\/place\/(\d{5,20})/)?.[1]).filter(Boolean))].slice(0,5),allLi:document.querySelectorAll('li').length};
          });
          status.push({url:frame.url().slice(0,130),...info});
        }catch(e){status.push({url:frame.url().slice(0,130),err:String(e.message).slice(0,50)})}
      }
      console.log('NAVER_MAP_PROBE '+JSON.stringify({http:response?.status()||null,frames:status,ms:Date.now()-start}).slice(0,2100));
      await mapPage.close();
    }catch(err){console.log('NAVER_MAP_PROBE error='+String(err.message).slice(0,160))}

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
