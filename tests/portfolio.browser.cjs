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
   for(const route of ['/','/portfolio/','/portfolio/product-pages/','/portfolio/brand-blogs/','/portfolio/brand-blogs/buttons/','/portfolio/conversion/','/portfolio/conversion/restaurant/','/portfolio/conversion/beauty/','/portfolio/conversion/b2b/','/portfolio/conversion/shop/','/portfolio/conversion/stay/','/portfolio/conversion/interior/','/portfolio/conversion/academy/','/portfolio/conversion/pet/','/website-samples/','/insights/']){
    const r=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:20000});
    assert.equal(r.status(),200,route);
    assert.ok((await page.locator('body').innerText()).length>100,route+' readable content');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<10,route+' horizontal overflow '+overflow+'px at '+viewport.width);
   }
   await page.goto(origin+'/portfolio/',{waitUntil:'domcontentloaded'});
   for(const dest of ['/portfolio/conversion/','/portfolio/product-pages/','/portfolio/brand-blogs/'])
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
   assert.equal(await page.locator('.showcase').count(),8,'Eight independently presented industries visible from the hub');
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
   await page.goto(origin+'/portfolio/brand-blogs/',{waitUntil:'domcontentloaded'});
   for(const id of ['salon','studio','local'])assert.ok(await page.locator('#'+id+' .blog-case').count(),id+' blog design');
   // Retired public routes direct users to current 8 independent designs.
   await page.goto(origin+'/website-samples/',{waitUntil:'domcontentloaded'});
   assert.match(await page.locator('h1').innerText(),/새로운 업종별 포트폴리오/);
   assert.ok((await page.locator('a[href="/portfolio/conversion/"]').count())>=1);
   await page.goto(origin+'/portfolio/conversion/',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('.showcase').count(),8);
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
   // Export actual Naver blog button, desktop skin and mobile cover PNGs.
   await page.goto(origin+'/portfolio/brand-blogs/buttons/?theme=expert',{waitUntil:'load'});
   assert.equal(await page.locator('[data-theme="expert"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#buttonPreview button').count(),5);
   await page.locator('#buttonFields .button-row').first().locator('input[type="url"]').fill('https://blog.naver.com/');
   await page.locator('#hostedImage').fill('https://blog.naver.com/example/btn01.png');
   assert.match(await page.locator('#widgetCode').inputValue(),/<a href="https:\/\/blog.naver.com\//);
   assert.match(await page.locator('#widgetCode').inputValue(),/<img src=/);
   const bdownloadPromise=page.waitForEvent('download');
   await page.locator('#downloadButton').click();
   assert.match((await bdownloadPromise).suggestedFilename(),/momentum-blog-menu-01\.png/);
   const pcPromise=page.waitForEvent('download');
   await page.locator('#downloadHeader').click();
   assert.match((await pcPromise).suggestedFilename(),/1920x650\.png/);
   const mobilePromise=page.waitForEvent('download');
   await page.locator('#downloadMobile').click();
   assert.match((await mobilePromise).suggestedFilename(),/720x720\.png/);
   fs.mkdirSync(path.join(ROOT,'artifacts'),{recursive:true});
   await page.screenshot({path:path.join(ROOT,'artifacts',viewport.width===1440?'brand-blog-button-builder-desktop.png':'brand-blog-button-builder-mobile.png'),fullPage:true});
   await page.locator('#buttonFields .button-row').first().locator('input[type="url"]').fill('javascript:alert(1)');
   assert.doesNotMatch(await page.locator('#widgetCode').inputValue(),/^<a /,'Unsafe links must not produce live widget code');
   await page.goto(origin+'/portfolio/brand-blogs/',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('.brand-blog-action-nav').count(),3);
   assert.ok(await page.locator('a[href*="/portfolio/brand-blogs/buttons/"]').count());
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
