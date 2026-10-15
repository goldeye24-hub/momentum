'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const current=new Date().toISOString();
  const before=new Date(Date.now()-86400000).toISOString();
  const fixtures={keyword:'포항맛집',scope:'mobile',period:7,
   columns:[
    {id:'11111111-1111-4111-8111-111111111111',date:'2026-10-14',observedAt:before,observedCount:2,
     entries:[{placeId:'2085358113',name:'퐝물회',rank:88,approximate:true},{placeId:'22334455',name:'과거 업체',rank:5,approximate:false}]},
    {id:'22222222-2222-4222-8222-222222222222',date:'2026-10-15',observedAt:current,observedCount:2,
     entries:[{placeId:'2085358113',name:'퐝물회',rank:85,approximate:false},{placeId:'33445566',name:'다른 업체',rank:7,approximate:false}]}
   ],
   rows:[{id:'2085358113',name:'퐝물회',ranks:[88,85],approximate:[true,false]},
    {id:'22334455',name:'과거 업체',ranks:[5,null],approximate:[false,null]},
    {id:'33445566',name:'다른 업체',ranks:[null,7],approximate:[null,false]}],
   movements:[
    {placeId:'2085358113',name:'퐝물회',rank:85,previousRank:88,delta:3,approximate:true},
    {placeId:'33445566',name:'다른 업체',rank:7,previousRank:null,delta:null,approximate:false}
   ],
   summary:{latestObservedAt:current,latestObservedCount:2,matchedAcrossLastTwo:1,rising:1,falling:0}
  };
  let posts=0,gets=0;
  await page.route('**/admin/keyword-matrix/api**',async route=>{
   const req=route.request();
   const payload=req.method()==='POST'?(posts++,{status:'saved',observedAt:current,observedCount:2}):(gets++,fixtures);
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  const html=fs.readFileSync('site-builder/keyword-matrix-index.html','utf8');
  await page.setContent(html,{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:fs.readFileSync('site-builder/keyword-matrix.css','utf8')});
  await page.addScriptTag({content:fs.readFileSync('site-builder/keyword-matrix.js','utf8')});
  await page.waitForFunction(()=>document.querySelector('#latestCount').textContent==='2',{timeout:8000});
  assert.equal(await page.locator('#risingCount').textContent(),'1');
  assert.equal(await page.locator('#matrixBody tr').count(),100);
  assert.ok((await page.locator('#matrixBody').textContent()).includes('과거 업체'),'Old-only competitor must remain visible in historical column');
  assert.ok((await page.locator('#matrixBody').textContent()).includes('퐝물회'));
  await page.locator('#movementRows button[data-place="2085358113"]').click();
  assert.equal(await page.locator('#trendChart svg circle').count(),2);
  await page.locator('button[data-limit="10"]').click();
  assert.equal(await page.locator('#matrixBody tr').count(),10);
  await page.locator('button[data-limit="100"]').click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#exportCsv').click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/momentum-keyword-rank-/);
  await page.locator('#capture').click();
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('관측일')||document.querySelector('#message').textContent.includes('2개 관측일'));
  assert.equal(posts,1);assert.ok(gets>=2);
  assert.deepEqual(errors,[]);
  fs.mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/keyword-rank-matrix-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/keyword-rank-matrix-mobile.png',fullPage:true});
  console.log('Keyword rank matrix browser regression passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
