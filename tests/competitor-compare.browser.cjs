'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:920}});
  const errors=[],base='https://momentum.example';let calls=0;
  page.on('pageerror',err=>errors.push(err.message));
  const data={placeA:'2085358113',placeB:'1616273949',days:30,
   summary:{keywordsObserved:3,both:1,onlyA:1,onlyB:1,top10A:1,top10B:2},
   rows:[
    {keyword:'포항맛집',observedAt:'2026-10-15T10:00:00Z',rankA:8,rankB:6,approximateA:false,approximateB:false,comparison:'both'},
    {keyword:'영일대 물회',observedAt:'2026-10-15T10:00:00Z',rankA:85,rankB:null,approximateA:true,approximateB:false,comparison:'only_a'},
    {keyword:'해산물맛집',observedAt:'2026-10-15T10:00:00Z',rankA:null,rankB:2,approximateA:false,approximateB:false,comparison:'only_b'}
   ]};
  await page.route('**/admin/competitors/api**',async route=>{
   calls++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const routes=[
   ['/admin/competitors/','competitor-compare-index.html','text/html'],
   ['/admin/assets/keyword-matrix.css','keyword-matrix.css','text/css'],
   ['/admin/assets/competitor-compare.css','competitor-compare.css','text/css'],
   ['/admin/assets/competitor-compare.js','competitor-compare.js','text/javascript']
  ];
  for(const [url,file,type] of routes)await page.route(base+url,route=>route.fulfill({
   status:200,contentType:type,body:fs.readFileSync('site-builder/'+file,'utf8')
  }));
  await page.goto(base+'/admin/competitors/',{waitUntil:'domcontentloaded'});
  await page.locator('#placeA').fill('2085358113');
  await page.locator('#placeB').fill('1616273949');
  await page.locator('#submitCompare').click();
  await page.waitForFunction(()=>document.querySelector('#bothCount').textContent==='1',{timeout:8000});
  assert.equal(await page.locator('#aCount').textContent(),'1');
  assert.equal(await page.locator('#bCount').textContent(),'1');
  assert.equal(await page.locator('#compareRows tr').count(),3);
  const body=await page.locator('#compareRows').textContent();
  assert.match(body,/공통 관측/);assert.match(body,/미관측/);
  await page.locator('#filter').selectOption('both');
  assert.equal(await page.locator('#compareRows tr').count(),1);
  await page.locator('#filter').selectOption('all');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportCsv').click();
  assert.match((await downloadPromise).suggestedFilename(),/momentum-place-competitor-comparison/);
  await page.locator('button[data-days="7"]').click();
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('3개 키워드'));
  assert.ok(calls>=2);assert.deepEqual(errors,[]);
  fs.mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/competitor-keyword-comparison-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/competitor-keyword-comparison-mobile.png',fullPage:true});
  console.log('Competitor comparison browser smoke passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
