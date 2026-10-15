'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const origin='https://momentum.example',errors=[];
  let limit=1,updates=0;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.route('**/admin/members/api',async route=>{
   const req=route.request(),data=req.method()==='POST'?JSON.parse(req.postData()):{};
   if(req.method()==='POST'){updates++;limit=data.limit;
    return route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({changed:{slotLimit:limit},notice:'시험용 슬롯 반영'})})}
   return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({accounts:[{user_id:'11111111-1111-4111-8111-111111111111',
     email:'member@company.kr',plan:'free',slot_limit:limit,used_slots:1,created_at:'2026-10-15T12:00:00Z'}],
     notice:'시험 운영'})});
  });
  for(const [path,file,type] of [
   ['/admin/members/','member-admin-index.html','text/html'],
   ['/admin/assets/member-admin.js','member-admin.js','text/javascript']
  ])await page.route(origin+path,route=>route.fulfill({status:200,contentType:type,
    body:fs.readFileSync('site-builder/'+file,'utf8')}));
  await page.goto(origin+'/admin/members/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#total').textContent==='1',{timeout:8000});
  assert.match(await page.locator('#rows').textContent(),/member@company\.kr/);
  await page.locator('input[data-slot]').fill('4');
  await page.locator('input[data-reason]').fill('파일럿 시험 운영');
  await page.locator('button[data-save]').click();
  await page.waitForFunction(()=>document.querySelector('#rows input[data-slot]')?.value==='4',{timeout:8000});
  assert.equal(updates,1);
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('감사 기록'),{timeout:8000});
  assert.match(await page.locator('#message').textContent(),/감사 기록/);
  fs.mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/admin-member-slots-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/admin-member-slots-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Admin member pilot slot browser smoke passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
