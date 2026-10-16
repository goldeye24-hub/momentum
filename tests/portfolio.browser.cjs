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
   for(const route of ['/','/portfolio/','/portfolio/product-pages/','/portfolio/brand-blogs/','/portfolio/brand-blogs/buttons/','/website-samples/','/insights/']){
    const r=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:20000});
    assert.equal(r.status(),200,route);
    assert.ok((await page.locator('body').innerText()).length>100,route+' readable content');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<10,route+' horizontal overflow '+overflow+'px at '+viewport.width);
   }
   await page.goto(origin+'/portfolio/',{waitUntil:'domcontentloaded'});
   for(const dest of ['/website-samples/','/portfolio/product-pages/','/portfolio/brand-blogs/'])
    assert.ok(await page.locator('a[href="'+dest+'"]').count(),dest+' category navigation');
   assert.match(await page.locator('.port-premium').innerText(),/지금 보는 홈페이지 30만원으로 제작 가능합니다\./);
   assert.match(await page.locator('.port-premium small').innerText(),/호스팅비는 별도/);
   await page.goto(origin+'/portfolio/product-pages/',{waitUntil:'domcontentloaded'});
   for(const id of ['ferment','lumin','brew'])assert.ok(await page.locator('#'+id+' .detail-demo').count(),id+' product design');
   if(viewport.width===1440){
     await page.goto(origin+'/portfolio/product-pages/',{waitUntil:'load'});
     await page.screenshot({path:path.join(ROOT,'artifacts','longform-product-portfolio.png'),fullPage:true});
   }
   await page.goto(origin+'/portfolio/brand-blogs/',{waitUntil:'domcontentloaded'});
   for(const id of ['salon','studio','local'])assert.ok(await page.locator('#'+id+' .blog-case').count(),id+' blog design');
   await page.goto(origin+'/website-samples/',{waitUntil:'domcontentloaded'});
   assert.match(await page.locator('.price-offer').innerText(),/지금 보는 홈페이지 30만원으로 제작 가능합니다\./);
   assert.match(await page.locator('.price-offer small').innerText(),/호스팅비는 별도/);
   await page.locator('[data-filter="stay"]').click();
   assert.equal(await page.locator('.sample-card:not([hidden])').count(),3,'stay category filter');
   assert.equal(await page.locator('[data-filter="stay"]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-filter="all"]').click();
   assert.equal(await page.locator('.sample-card:not([hidden])').count(),15,'all website samples');
   for(const demo of ['restaurant','foodie','franchise','poolvilla','pension','glamping','petgroom','ladder','movers','cleaning','aircon','beauty','academy','clinic','corporate']){
    const r=await page.goto(origin+'/website-samples/'+demo+'/',{waitUntil:'domcontentloaded',timeout:20000});
    assert.equal(r.status(),200,demo+' sample');
    assert.match(await page.locator('.neo-price').innerText(),/30만원으로 제작 가능합니다\./,demo+' price');
    assert.match(await page.locator('.neo-price small').innerText(),/호스팅비는 별도/,demo+' hosting');
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
