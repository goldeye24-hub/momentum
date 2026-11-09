'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const ORIGIN='https://momentum-goldeye24-hubs-projects.vercel.app';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[],badResponses=[];
  page.on('pageerror',err=>errors.push(err.message.slice(0,160)));
  page.on('response',response=>{
   if(response.status()>=400&&response.url().startsWith(ORIGIN)&&!response.url().includes('/favicon'))
    badResponses.push({path:new URL(response.url()).pathname,status:response.status()});
  });
  await page.goto(ORIGIN+'/platform/',{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForFunction(()=>document.querySelector('#authPanel')?.hidden===false,{timeout:10000});
  assert.match(await page.title(),/플레이스/);
  assert.equal(await page.locator('#email').isVisible(),true);
  assert.equal(await page.locator('#rememberEmail').isVisible(),true);
  assert.equal(await page.locator('#rememberEmail').isChecked(),false);
  await page.locator('button[data-mode="signup"]').click();
  assert.equal(await page.locator('#rememberEmail').isVisible(),false);
  await page.locator('button[data-mode="login"]').click();
  assert.equal(await page.locator('#rememberEmail').isVisible(),true);
  await page.locator('#rememberEmail').check();
  await page.locator('#email').fill('example-for-qa@invalid.test');
  // Do not submit credentials or create real accounts.
  await page.goto(ORIGIN+'/admin/',{waitUntil:'domcontentloaded',timeout:25000});
  assert.match(await page.title(),/관리자 로그인/);
  assert.equal(await page.locator('#password').isVisible(),true);
  await page.goto(ORIGIN+'/',{waitUntil:'domcontentloaded',timeout:25000});
  assert.match(await page.title(),/모멘텀|Momentum/i);
  assert.deepEqual(errors,[],'Production client JS errors: '+JSON.stringify(errors));
  assert.deepEqual(badResponses,[],'Production network errors: '+JSON.stringify(badResponses));
  console.log('LIVE_BROWSER_OK: anonymous portal, remember ID toggle, admin login and public homepage.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e.name+': '+e.message);process.exitCode=1});
