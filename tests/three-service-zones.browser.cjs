'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const admin=require('../api/admin-site-builder');
const PASSWORD='Test-only-not-a-real-admin-password-42';
process.env.MOMENTUM_ADMIN_PASSWORD=PASSWORD;
process.env.MOMENTUM_SESSION_SECRET='z'.repeat(64);
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
function serveFile(file,res){
 const target=path.resolve(root,file);
 if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const data=fs.readFileSync(target);res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'});res.end(data)}
 catch{res.writeHead(404);res.end('Not found')}
}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local.test');
 const pathname=u.pathname;
 if(pathname.startsWith('/admin/')||pathname==='/admin'){
  if(pathname==='/admin/connection/api'){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({
   status:'degraded',database:{passedCount:0,checkedCount:9},authentication:{connectivity:'failed'}}));return}
  let body='';if(req.method==='POST')for await(const chunk of req)body+=chunk;
  const view=pathname.startsWith('/admin/overview')?'overview':pathname.startsWith('/admin/studio')?'studio':'';
  let asset='';if(pathname.startsWith('/admin/assets/'))asset=pathname.slice('/admin/assets/'.length);
  const action=pathname==='/admin/login'?'login':pathname==='/admin/logout'?'logout':'';
  const query={view,asset,action};
  const adapter={statusCode:200,headers:{},
   setHeader(k,v){this.headers[k]=v},
   end(content){
    for(const [k,v] of Object.entries(this.headers))
     res.setHeader(k,k.toLowerCase()==='set-cookie'?v.replace('; Secure;',';'):v);
    res.writeHead(this.statusCode);res.end(content||'');
   }};
  admin({method:req.method,query,headers:{...req.headers,origin:req.method==='POST'?'https://'+req.headers.host:req.headers.origin},body},adapter);
  return;
 }
 if(pathname==='/api/member-auth'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"authenticated":false}');return}
 if(pathname==='/api/member-watches'){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"member login required"}');return}
 if(pathname==='/')return serveFile('index.html',res);
 if(pathname==='/platform/'||pathname==='/platform')return serveFile('platform/index.html',res);
 if(pathname==='/lab/'||pathname==='/lab')return serveFile('lab/index.html',res);
 if(pathname==='/lab/rank/')return serveFile('lab/rank/index.html',res);
 serveFile(pathname.replace(/^\/+/,''),res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:820}});
  const page=await context.newPage();
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  assert.ok(await page.locator('a[href="/platform/"]').first().isVisible());
  await page.locator('#agencyNav a[href="/platform/"]').click();
  await page.waitForURL(origin+'/platform/');
  await page.waitForFunction(()=>!document.querySelector('#authPanel').hidden);
  assert.equal(await page.locator('#dashboard').isHidden(),true,'Member services must not appear before login');
  assert.equal(await page.locator('#rememberEmail').isVisible(),true);
  await page.goto(origin+'/lab/',{waitUntil:'domcontentloaded'});
  assert.ok(await page.locator('.mainnav a[href="/platform/"]').isVisible(),'Public lab shows separate member entry');
  await page.goto(origin+'/admin/overview/',{waitUntil:'domcontentloaded'});
  assert.match(await page.title(),/관리자 로그인/);
  assert.equal(await page.locator('a[href="/admin/crm/"]').count(),0,'Admin links must not leak before authentication');
  await page.locator('#password').fill(PASSWORD);
  await page.locator('#adminLoginSubmit').click();
  await page.waitForFunction(()=>document.title.includes('관리자 운영센터'),{timeout:8000});
  assert.ok(await page.locator('a[href="/admin/crm/"]').isVisible());
  await page.waitForFunction(()=>document.querySelector('#dbConnectionStatus').textContent.includes('상세 진단'),{timeout:8000});
  assert.doesNotMatch(await page.locator('#dbConnectionStatus').textContent(),/모두 정상/);
  await page.goto(origin+'/admin/studio/',{waitUntil:'domcontentloaded'});
  assert.match(await page.title(),/홈페이지 제작/);
  console.log('PASS: public → private member login; guarded admin → login → operations hub → preserved studio');
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
