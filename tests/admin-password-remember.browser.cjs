'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('playwright');
const handler=require('../api/admin-site-builder');

const ADMIN_PASSWORD='Test-only-admin-secret-987654321';
process.env.MOMENTUM_ADMIN_PASSWORD=ADMIN_PASSWORD;
process.env.MOMENTUM_SESSION_SECRET='a'.repeat(64);

const server=http.createServer(async(req,res)=>{
 let data='';
 for await(const chunk of req){data+=chunk;if(data.length>5000)break}
 const u=new URL(req.url,'http://localhost');
 const upstream={
  method:req.method,query:u.pathname==='/admin/login'?{action:'login'}:{},
  headers:{...req.headers,origin:req.method==='POST'?'https://'+req.headers.host:req.headers.origin},
  body:data
 };
 const response={
  statusCode:200,headers:{},
  setHeader(k,v){this.headers[k]=v},
  end(content){
   for(const [k,v] of Object.entries(this.headers)){
    // Secure cookie is necessary in production; local HTTP test fixture
    // relaxes only the cookie transport flag.
    res.setHeader(k,k.toLowerCase()==='set-cookie'?v.replace('; Secure;',';'):v);
   }
   res.writeHead(this.statusCode);
   res.end(content||'');
  }
 };
 handler(upstream,response);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext();
  const page=await context.newPage();
  const pageErrors=[];
  let stored=null,storeCalls=0;
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.exposeFunction('__qaStoreCredential',async credential=>{
   storeCalls++;stored=credential;return credential;
  });
  await page.exposeFunction('__qaGetCredential',async()=>stored);
  await page.addInitScript(()=>{
   window.PasswordCredential=function Credential(options){Object.assign(this,options)};
   Object.defineProperty(navigator,'credentials',{configurable:true,value:{
    store:credential=>window.__qaStoreCredential({id:credential.id,password:credential.password}),
    get:()=>window.__qaGetCredential()
   }});
  });
  await page.goto(url+'/admin/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#rememberAdminPassword').isChecked(),false);
  assert.equal(await page.locator('#password').getAttribute('autocomplete'),'off');
  assert.equal(await page.locator('#password').inputValue(),'');
  await page.locator('#rememberAdminPassword').check();
  assert.equal(await page.locator('#password').getAttribute('autocomplete'),'current-password');
  await page.locator('#password').fill('wrong-admin-password-123');
  await page.locator('#adminLoginSubmit').click();
  await page.locator('#adminLoginMessage:not([hidden])').waitFor();
  assert.match(await page.locator('#adminLoginMessage').textContent(),/올바르지/);
  assert.equal(storeCalls,0,'invalid password must not be stored');
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.locator('#adminLoginSubmit').click();
  await page.waitForURL(url+'/admin/',{timeout:8000});
  assert.equal(storeCalls,1);
  assert.equal(stored.id,'momentum-admin');
  assert.equal(stored.password,ADMIN_PASSWORD);
  await context.clearCookies();
  await page.goto(url+'/admin/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#rememberAdminPassword').isChecked(),true);
  await page.waitForFunction(()=>document.querySelector('#password').value.length>0);
  assert.equal(await page.locator('#password').inputValue(),ADMIN_PASSWORD);
  const safe=await page.evaluate(()=>Object.entries(localStorage));
  assert.deepEqual(safe,[['momentum.admin.password-manager.optin.v1','1']]);
  await page.locator('#rememberAdminPassword').uncheck();
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#rememberAdminPassword').isChecked(),false);
  assert.equal(await page.locator('#password').inputValue(),'');
  assert.deepEqual(await page.evaluate(()=>Object.entries(localStorage)),[]);
  assert.deepEqual(pageErrors,[]);
  console.log('Admin password-manager opt-in, wrong-password rejection, reload and uncheck regression passed');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
