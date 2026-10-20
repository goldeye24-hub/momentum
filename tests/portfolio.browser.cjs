'use strict';
/* Real-browser acceptance for current 19-vertical portfolio.
 * Every deployment needs human-approved visual comparison; PNG production != approved art direction.
 * No customer records or authentication are touched. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const ROOT=path.resolve(__dirname,'..');
const folders=['restaurant','beauty','enterprise','b2b','shop','stay','interior','academy','pet','legal','clinic','auto','fitness','estate','hrd','tax','moving','cleaning','pilates'];
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://local.invalid').pathname;
 const relative=name.endsWith('/')?name+'index.html':name;
 let full;try{full=path.resolve(ROOT,'.'+decodeURIComponent(relative));if(!full.startsWith(ROOT+path.sep))throw Error('blocked')}catch{res.writeHead(403);res.end();return}
 fs.readFile(full,(err,data)=>{if(err){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':types[path.extname(full)]||'application/octet-stream'});res.end(data)});
});
async function start(){await new Promise(done=>server.listen(0,'127.0.0.1',done));return 'http://127.0.0.1:'+server.address().port}
(async()=>{
 const origin=await start(),browser=await chromium.launch({headless:true});
 const artifacts=path.join(ROOT,'artifacts');fs.mkdirSync(artifacts,{recursive:true});
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const routes=['/portfolio/','/portfolio/conversion/',...folders.map(s=>'/portfolio/conversion/'+s+'/')];
   for(const route of routes){
    const res=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:20000});
    assert.equal(res.status(),200,route);
    assert.ok((await page.locator('body').innerText()).length>80,route+' empty body');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<14,route+' has horizontal overflow '+overflow+'px @'+viewport.width);
    if(route.includes('/conversion/')&&route!='/portfolio/conversion/'){
     assert.equal(await page.locator('h1').count(),1,route+' must have one h1');
     assert.ok(await page.locator('img').count()>=3,route+' needs photography');
    }
   }
   assert.deepEqual(errors,[],'JavaScript errors in '+viewport.width+'px browser');
   await page.goto(origin+'/portfolio/',{waitUntil:'domcontentloaded'});
   assert.ok(await page.locator('a[href="/portfolio/conversion/"]').count(),'portfolio hub link missing');
   await page.goto(origin+'/portfolio/conversion/',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('.case-grid .site-case').count(),19,'current catalog count');
   assert.equal(await page.locator('.featured .site-case').count(),2,'two featured examples');
   await page.locator('[data-filter="professional"]').click();
   assert.equal(await page.locator('.case-grid .site-case:not([hidden])').count(),3,'professional filter should display law, clinic and tax');
   await page.locator('[data-filter="all"]').click();
   assert.equal(await page.locator('.case-grid .site-case:not([hidden])').count(),19,'reset filter shows all');
   await page.screenshot({path:path.join(artifacts,'portfolio-catalog-'+viewport.width+'.png'),fullPage:true,animations:'disabled'});
   await page.goto(origin+'/portfolio/conversion/legal/',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('header .logo').count(),1);
   assert.equal(await page.locator('.case-card').count(),3);
   assert.equal(await page.locator('.step-number').count(),4);
   await page.locator('[data-slide="1"]').click();
   assert.match(await page.locator('#slide-title').innerText(),/문제를 이해하는 것/,'the slide must change content');
   assert.equal(await page.locator('[data-slide="1"]').getAttribute('aria-current'),'true');
   if(viewport.width===390){
    await page.locator('.menu-toggle').click();
    assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true','mobile menu should open');
    await page.locator('#primary-menu a[href="#practice"]').click();
    assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false','mobile menu should close');
   }
   await page.screenshot({path:path.join(artifacts,'legal-reference-implementation-'+viewport.width+'.png'),fullPage:true,animations:'disabled'});
   await page.close();
  }
  console.log('PASS: 19 routes, 2 viewports, catalog filtering, real legal slide and navigation. Manual visual approval still required.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error('PORTFOLIO_QA_FAILED:',e.stack||String(e));process.exitCode=1;server.close()});
