'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[],origin='https://momentum.example';
  let loggedIn=false,targets=[],posted=0;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.route('**/api/member-auth',async route=>{
   const req=route.request(),body=req.method()==='POST'?JSON.parse(req.postData()):{};
   let result;
   if(req.method()==='GET')result={authenticated:loggedIn};
   else if(body.action==='login'){loggedIn=true;result={authenticated:true,plan:'free',slotLimit:1,email:'test@company.kr'}}
   else if(body.action==='signup')result={message:'이메일 인증 후 로그인하세요.'};
   else if(body.action==='logout'){loggedIn=false;result={authenticated:false}}
   else result={error:'invalid'};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.route('**/api/member-watches',async route=>{
   const req=route.request(),body=req.method()==='POST'?JSON.parse(req.postData()):{};
   let payload,status=200;
   if(req.method()==='GET')payload={plan:'free',slotLimit:1,usedSlots:targets.length,targets,
    disclaimer:'실제로 저장된 데이터'};
   else if(body.action==='add'&&targets.length<1){
    posted++;const target={id:'22222222-2222-4222-8222-222222222222',label:body.label,keyword:body.keyword,
     place_id:body.target,rank:null,observed_at:null};
    targets.push(target);status=201;payload={target,note:'등록했습니다'};
   }else if(body.action==='remove'){targets=[];payload={removed:true}}
   else{status=409;payload={error:'슬롯 초과'}}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(payload)});
  });
  for(const [path,file,mime] of [
   ['/platform/','index.html','text/html'],
   ['/platform/portal.css','portal.css','text/css'],
   ['/platform/portal.js','portal.js','text/javascript']
  ])await page.route(origin+path,route=>route.fulfill({status:200,contentType:mime,
   body:fs.readFileSync('platform/'+file,'utf8')}));
  await page.goto(origin+'/platform/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.querySelector('#authPanel').hidden,{timeout:8000});
  await page.locator('button[data-mode="signup"]').click();
  assert.match(await page.locator('#authTitle').textContent(),/회원가입/);
  await page.locator('button[data-mode="login"]').click();
  await page.locator('#email').fill('test@company.kr');
  await page.locator('#password').fill('test-password-123');
  await page.locator('#authSubmit').click();
  await page.waitForFunction(()=>!document.querySelector('#dashboard').hidden,{timeout:8000});
  assert.equal(await page.locator('#slots').textContent(),'0 / 1');
  await page.locator('[name="label"]').fill('퐝물회');
  await page.locator('[name="keyword"]').fill('포항맛집');
  await page.locator('[name="target"]').fill('2085358113');
  await page.locator('#addWatch').click();
  await page.waitForFunction(()=>document.querySelector('#slots').textContent==='1 / 1',{timeout:8000});
  assert.match(await page.locator('#watchRows').textContent(),/순위 미관측/);
  assert.equal(posted,1);
  assert.equal(await page.locator('#addWatch').isDisabled(),true);
  fs.mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/member-portal-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/member-portal-mobile.png',fullPage:true});
  await page.locator('#watchRows button[data-remove]').click();
  await page.waitForFunction(()=>document.querySelector('#slots').textContent==='0 / 1',{timeout:8000});
  await page.locator('#logout').click();
  await page.waitForFunction(()=>!document.querySelector('#authPanel').hidden,{timeout:8000});
  assert.equal(await page.locator('#dashboard').isHidden(),true);
  assert.deepEqual(errors,[]);
  console.log('Member portal auth and slot browser checks passed');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
