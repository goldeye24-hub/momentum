'use strict';
/* Real Chromium portfolio acceptance; uses no production accounts or credentials. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://qa.test');
 const pathname=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
 let requested;
 try{requested=path.resolve(ROOT,'.'+decodeURIComponent(pathname));if(!requested.startsWith(ROOT+path.sep))throw Error('unsafe route')}
 catch{res.writeHead(403);res.end();return}
 fs.readFile(requested,(err,buf)=>{if(err){res.writeHead(404);res.end();return}
  res.writeHead(200,{'Content-Type':mime[path.extname(requested)]||'application/octet-stream'});res.end(buf)});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const route of ['/','/portfolio/','/portfolio/product-pages/','/portfolio/conversion/','/portfolio/conversion/restaurant/','/portfolio/conversion/beauty/','/portfolio/conversion/b2b/','/portfolio/conversion/shop/','/portfolio/conversion/stay/','/portfolio/conversion/interior/','/portfolio/conversion/academy/','/portfolio/conversion/pet/','/portfolio/conversion/legal/','/portfolio/conversion/clinic/','/portfolio/conversion/auto/','/portfolio/conversion/fitness/','/portfolio/conversion/estate/','/portfolio/conversion/hrd/','/portfolio/conversion/tax/','/portfolio/conversion/moving/','/portfolio/conversion/cleaning/','/portfolio/conversion/pilates/','/website-samples/','/insights/']){
    const r=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:20000});
    assert.equal(r.status(),200,route);
    assert.ok((await page.locator('body').innerText()).length>100,route+' readable content');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<10,route+' horizontal overflow '+overflow+'px at '+viewport.width);
    if(/^\/portfolio\/conversion\/[^/]+\/$/.test(route)){
      const imgs=await page.locator('img').evaluateAll(nodes=>nodes.map(x=>({src:(x.getAttribute('src')||'').split('?')[0],alt:x.getAttribute('alt')})));
      assert.ok(imgs.length>=3,route+' should have at least three photos, not only abstract graphics');
      assert.equal(new Set(imgs.map(x=>x.src)).size,imgs.length,route+' should not repeat photographic assets');
      assert.ok(imgs.every(x=>x.alt&&x.alt.trim()),route+' should describe imagery accessibly');
      assert.equal(await page.locator('link[href="/portfolio/conversion/photography-upgrade.css"]').count(),1,route+' has photography layout');
    }
   }
   await page.goto(origin+'/portfolio/',{waitUntil:'domcontentloaded'});
   for(const dest of ['/portfolio/conversion/','/portfolio/product-pages/'])
    assert.ok(await page.locator('a[href="'+dest+'"]').count(),dest+' category navigation');
   assert.match(await page.locator('.port-premium').last().innerText(),/지금 보는 홈페이지 30만원으로 제작 가능합니다\./);
   assert.match(await page.locator('.port-premium small').last().innerText(),/호스팅비는 별도/);
   // Distinct standalone industry sites: no shared template or fake order form.
   const independent={
    restaurant:{hero:'.editorial-hero',unique:'.menu-story',nav:'.restaurant-navigation',cta:'#menu',faq:3},
    beauty:{hero:'.cover-grid',unique:'.look-strip',nav:'.head',cta:'#lookbook',faq:3},
    b2b:{hero:'.intro',unique:'.problem-matrix',nav:'.railnav',cta:'#solutions',faq:4},
    shop:{hero:'.product-shell',unique:'.product-actions',nav:'.shop-header',cta:'#details',faq:4}
   };
   fs.mkdirSync(path.join(ROOT,'artifacts'),{recursive:true});
   await page.goto(origin+'/portfolio/conversion/',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('.showcase').count(),18,'Eighteen independent industry previews displayed in hub');
   await page.screenshot({path:path.join(ROOT,'artifacts',viewport.width===1440?'conversion-portfolio-desktop.png':'conversion-portfolio-mobile.png'),fullPage:true});
   const signatures=new Set();
   for(const [id,v] of Object.entries(independent)){
    const r=await page.goto(origin+'/portfolio/conversion/'+id+'/',{waitUntil:'domcontentloaded'});
    assert.equal(r.status(),200,id+' route');
    assert.equal(await page.locator('h1').count(),1,id+' unique H1');
    assert.equal(await page.locator(v.hero).count(),1,id+' own hero');
    assert.equal(await page.locator(v.unique).count(),1,id+' own content composition');
    assert.equal(await page.locator(v.nav).count(),1,id+' own navigation');
    assert.equal(await page.locator('details').count(),v.faq,id+' FAQ tailored to industry');
    assert.match(await page.locator('.price,.disclosure').innerText(),/지금 보는 홈페이지 30만원으로 제작 가능합니다/);
    assert.match(await page.locator('.price small,.disclosure small').innerText(),/호스팅비는 별도/);
    assert.equal(await page.locator('form').count(),0,id+' cannot display fake booking form');
    assert.ok((await page.locator('a[href="'+v.cta+'"]').count())>=1,id+' functional anchor');
    assert.ok((await page.locator('a[href*="/?service="]').count())>=1,id+' real agency inquiry link');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow','samples should not index as real businesses');
    signatures.add(await page.locator('main > section').first().getAttribute('class'));
    if(id==='shop'){
       assert.equal(await page.locator('#quantity').innerText(),'1');
       await page.locator('#plus').click();
       await page.locator('input[value="500g"]').check();
       await page.locator('#addToBag').click();
       assert.equal(await page.locator('#bagCount').innerText(),'2');
       assert.match(await page.locator('#bagMessage').innerText(),/500g × 2개/);
       assert.match(await page.locator('#bagMessage').innerText(),/실제 주문/);
    }
    if(viewport.width===1440)await page.screenshot({path:path.join(ROOT,'artifacts','independent-'+id+'-desktop.png'),fullPage:true});
    else await page.screenshot({path:path.join(ROOT,'artifacts','independent-'+id+'-mobile.png'),fullPage:true});
   }
   assert.equal(signatures.size,4,'Hero HTML structures must be different, not four shared templates');
   await page.goto(origin+'/portfolio/product-pages/',{waitUntil:'domcontentloaded'});
   for(const id of ['ferment','lumin','brew'])assert.ok(await page.locator('#'+id+' .detail-demo').count(),id+' product design');
   if(viewport.width===1440){
     await page.goto(origin+'/portfolio/product-pages/',{waitUntil:'load'});
     await page.screenshot({path:path.join(ROOT,'artifacts','longform-product-portfolio.png'),fullPage:true});
   }
   // Retired public routes direct users to current 18 independent designs.
   await page.goto(origin+'/website-samples/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>location.pathname.startsWith('/portfolio/conversion/')||document.querySelector('h1')?.textContent.includes('새로운 업종별 포트폴리오'),{timeout:7000});
   assert.ok((await page.evaluate(()=>location.pathname)).startsWith('/portfolio/conversion/')||(await page.locator('h1').innerText()).includes('새로운 업종별'),'Legacy gallery must lead to current collection');
   await page.goto(origin+'/portfolio/conversion/',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('.showcase').count(),18);
   for(const id of ['stay','interior','academy','pet']){
     const r=await page.goto(origin+'/portfolio/conversion/'+id+'/',{waitUntil:'domcontentloaded'});
     assert.equal(r.status(),200,'new vertical '+id);
     assert.equal(await page.locator('h1').count(),1,'unique heading '+id);
     assert.match(await page.locator('.price').innerText(),/30만원으로 제작 가능합니다/);
     assert.match(await page.locator('.price small').innerText(),/호스팅비는 별도/);
     if(id==='stay'){
       await page.locator('#arrival').fill('2027-05-10');
       await page.locator('#departure').fill('2027-05-13');
       await page.locator('#demoBooking button[type="submit"]').click();
       assert.match(await page.locator('#bookingStatus').innerText(),/2027-05-10/);
       assert.match(await page.locator('#bookingStatus').innerText(),/실제 예약/);
     }else if(id==='interior'){
       await page.locator('#spaceType').selectOption('사무실');
       await page.locator('#briefForm button').click();
       assert.match(await page.locator('#briefResult').innerText(),/사무실/);
       assert.match(await page.locator('#briefResult').innerText(),/실제 시공 견적/);
     }else if(id==='academy'){
       await page.locator('[data-level="adult"]').click();
       assert.equal(await page.locator('[data-level="adult"]').getAttribute('aria-selected'),'true');
       assert.match(await page.locator('#courseTitle').innerText(),/목표에 맞춰/);
     }else if(id==='pet'){
       await page.locator('#petSize').selectOption('대형견');
       await page.locator('#petSurvey button').click();
       assert.match(await page.locator('#surveyOutput').innerText(),/대형견/);
     }
   }
   // Six newly launched independent verticals, including live demo controls.
   for(const [id,test] of Object.entries({
    legal:async()=>{
       await page.locator('[data-topic="contract"]').click();
       assert.equal(await page.locator('[data-item]:visible').count(),1);
       assert.match(await page.locator('#topicStatus').innerText(),/선택한 분야/);
    },
    clinic:async()=>{
       await page.locator('[data-check]').first().check();
       assert.match(await page.locator('#progress').innerText(),/1 \/ 3/);
    },
    auto:async()=>{
       await page.locator('#category').selectOption('tire');
       await page.locator('#showInfo').click();
       assert.match(await page.locator('#result').innerText(),/타이어 규격/);
    },
    fitness:async()=>{
       await page.locator('[data-day="wed"]').click();
       assert.equal(await page.locator('.class-list article:visible').count(),1);
    },
    estate:async()=>{
       await page.locator('#region').selectOption('urban');
       await page.locator('#purpose').selectOption('commercial');
       await page.locator('#searchForm button').click();
       assert.equal(await page.locator('.cards article:visible').count(),1);
    },
    hrd:async()=>{
       await page.locator('#audience').selectOption('승진자');
       await page.locator('#brief button').click();
       assert.match(await page.locator('#summary').innerText(),/승진자/);
    }
   })){
      const r=await page.goto(origin+'/portfolio/conversion/'+id+'/',{waitUntil:'domcontentloaded'});
      assert.equal(r.status(),200,id+' new independent route');
      assert.equal(await page.locator('h1').count(),1,id+' needs one H1');
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
      assert.ok((await page.locator('a[href*="service="]').count())>0,id+' must link to agency');
      assert.match(await page.locator('body').innerText(),/지금 보는 홈페이지 30만원으로 제작 가능합니다/);
      await test();
      if(viewport.width===1440)await page.screenshot({path:path.join(ROOT,'artifacts','new-'+id+'-desktop.png'),fullPage:true});
   }
   // Four incremental industry structures and interactive demos, without disturbing latest main's other six.
   for(const id of ['tax','moving','cleaning','pilates']){
     const r=await page.goto(origin+'/portfolio/conversion/'+id+'/',{waitUntil:'domcontentloaded'});
     assert.equal(r.status(),200,id+' route');
     assert.equal(await page.locator('h1').count(),1,id+' single H1');
     assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
     assert.match(await page.locator('.agency-price,.studio-price').innerText(),/지금 보는 홈페이지 30만원으로 제작 가능합니다/);
     assert.match(await page.locator('.agency-price small,.studio-price small').innerText(),/호스팅비는 별도/);
     if(id==='tax'){await page.locator('[data-tax="company"]').click();assert.match(await page.locator('#taxTitle').innerText(),/법인사업자/)}
     if(id==='moving'){await page.locator('input[value="원룸이사"]').check();await page.locator('#moveForm button').click();assert.match(await page.locator('#moveResult').innerText(),/원룸이사/)}
     if(id==='cleaning'){await page.locator('#cleanCompare').fill('73');assert.match(await page.locator('#beforeMask').getAttribute('style'),/27%/);await page.locator('[data-clean="office"]').click();assert.match(await page.locator('#cleanTitle').innerText(),/사무실 청소/)}
     if(id==='pilates'){await page.locator('[data-day="wed"]').click();assert.match(await page.locator('#classSlots').innerText(),/WED/);assert.equal(await page.locator('#classSlots .slot').count(),3)}
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
     assert.ok(overflow<10,id+' mobile/desktop horizontal overflow '+overflow);
     if(viewport.width===1440)await page.screenshot({path:path.join(ROOT,'artifacts','new-'+id+'-desktop.png'),fullPage:true});
   }
   await page.goto(origin+'/?service='+encodeURIComponent('브랜드블로그 디자인')+'#contact',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#requestedProduct').inputValue(),'브랜드블로그 디자인','Brand blog inquiry selection');
   await page.goto(origin+'/?service='+encodeURIComponent('상세페이지 제작')+'#contact',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#requestedProduct').inputValue(),'상세페이지 제작','Detail page inquiry selection');
   await page.goto(origin+'/?service='+encodeURIComponent('홈페이지 제작')+'&design=foodie#contact',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#requestedProduct').inputValue(),'홈페이지 제작','Chosen website product');
   assert.match(await page.locator('#selectedDesign').inputValue(),/온기집/,'Chosen website ID for inquiry');
   await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
   assert.ok(await page.locator('a[href="/portfolio/"]').count(),'home portfolio navigation');
   assert.match(await page.locator('.momentum-price-banner').innerText(),/지금 보는 홈페이지 30만원으로 제작 가능합니다\./);
   assert.equal(errors.length,0,'Browser JS errors: '+JSON.stringify(errors));
   if(viewport.width===1440){fs.mkdirSync(path.join(ROOT,'artifacts'),{recursive:true});
    await page.locator('#work').screenshot({path:path.join(ROOT,'artifacts','homepage-portfolio-desktop.png')});
    await page.goto(origin+'/portfolio/',{waitUntil:'domcontentloaded'});
    await page.screenshot({path:path.join(ROOT,'artifacts','portfolio-overview-desktop.png'),fullPage:true});
   }else{
    await page.goto(origin+'/portfolio/',{waitUntil:'domcontentloaded'});
    await page.screenshot({path:path.join(ROOT,'artifacts','portfolio-overview-mobile.png'),fullPage:true});
   }
   await page.close();
  }
  console.log('PASS portfolio: public homepage + three categories + 15 original demo sites + responsive pricing and filters');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(err=>{console.error(err.stack||err);process.exitCode=1;server.close()});
