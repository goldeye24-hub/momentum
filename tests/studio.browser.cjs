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
    assert.equal(templateErrors.length,0,'Template page errors: '+templateErrors.join(' | '));
    await templatePage.goto('http://127.0.0.1:'+port+'/website-samples/',{waitUntil:'load'});
    assert.equal(await templatePage.locator('.sample-card').count(),5);
    assert.match(await templatePage.locator('h1').innerText(),/선택하고 싶은/);
    await templatePage.locator('[data-filter="professional"]').click();
    assert.equal(await templatePage.locator('.sample-card:visible').count(),2);
    await templatePage.locator('[data-filter="all"]').click();
    assert.equal(await templatePage.locator('.sample-card:visible').count(),5);
    await templatePage.screenshot({path:path.join(root,'artifacts/momentum-website-samples.png'),fullPage:true});
    await templatePage.close();

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
    console.log('PASS: five actual sample sites, sample gallery filter, editor live changes, autosave, export and mobile preview');

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
    await crm.screenshot({path:path.join(root,'artifacts/momentum-internal-crm.png'),fullPage:true});
    await crm.setViewportSize({width:390,height:844});
    const crmDims=await crm.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
    assert.ok(crmDims.scrollWidth<=crmDims.viewport+3,'CRM mobile overflow '+JSON.stringify(crmDims));
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
