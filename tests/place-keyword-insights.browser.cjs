'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960}}),origin='https://momentum.example',errors=[];
  page.on('pageerror',x=>errors.push(x.message));
  const data={placeId:'2085358113',days:30,scope:'mobile',
   summary:{trackedKeywords:3,top3:0,top10:1,rising:1,falling:0,notObservedLatest:1},
   rows:[
    {keyword:'포항맛집',observedAt:'2026-10-15T09:00:00Z',previousObservedAt:'2026-10-14T09:00:00Z',rank:85,previousRank:88,delta:3,approximate:true,previousApproximate:false,name:'퐝물회',status:'observed'},
    {keyword:'포항 해산물',observedAt:'2026-10-15T09:00:00Z',rank:5,previousRank:null,delta:null,approximate:false,previousApproximate:false,name:'퐝물회',status:'observed'},
    {keyword:'영일대 물회',observedAt:'2026-10-15T09:00:00Z',rank:null,previousRank:7,delta:null,approximate:false,previousApproximate:false,name:'퐝물회',status:'not_observed_in_latest'}
   ]};
  let gets=0;
  await page.route('**/admin/place-insights/api**',async route=>{
   gets++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  for(const [url,file,type] of [
   ['/admin/place-insights/','place-keyword-insights-index.html','text/html'],
   ['/admin/assets/keyword-matrix.css','keyword-matrix.css','text/css'],
   ['/admin/assets/place-keyword-insights.css','place-keyword-insights.css','text/css'],
   ['/admin/assets/place-keyword-insights.js','place-keyword-insights.js','text/javascript']
  ])await page.route(origin+url,route=>route.fulfill({
   status:200,contentType:type,body:fs.readFileSync('site-builder/'+file,'utf8')
  }));
  await page.goto(origin+'/admin/place-insights/',{waitUntil:'domcontentloaded'});
  await page.locator('#placeId').fill('2085358113');
  await page.locator('#search').click();
  await page.waitForFunction(()=>document.querySelector('#keywordCount').textContent==='3',{timeout:8000});
  assert.equal(await page.locator('#top10Count').textContent(),'1');
  assert.equal(await page.locator('#missingCount').textContent(),'1');
  assert.equal(await page.locator('#insightRows tr').count(),3);
  assert.match(await page.locator('#insightRows').textContent(),/미관측/);
  await page.locator('#filter').selectOption('rising');
  assert.equal(await page.locator('#insightRows tr').count(),1);
  await page.locator('#filter').selectOption('all');
  const href=await page.locator('#insightRows a').first().getAttribute('href');
  assert.match(href,/\/admin\/keyword-matrix\/\?keyword=/);
  const promise=page.waitForEvent('download');
  await page.locator('#exportCsv').click();
  assert.match((await promise).suggestedFilename(),/momentum-place-observed-keywords/);
  await page.locator('button[data-days="7"]').click();
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('3개 키워드'));
  assert.ok(gets>=2);assert.deepEqual(errors,[]);
  fs.mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/place-keyword-insights-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/place-keyword-insights-mobile.png',fullPage:true});
  console.log('Place observed keyword insights browser smoke passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
