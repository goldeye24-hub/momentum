'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const admin=require('../api/admin-site-builder');
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
function response(){return {statusCode:200,headers:{},body:'',setHeader(k,v){this.headers[k]=v},end(v){this.body=String(v??'');return this}}}
async function withAdminConfig(fn){
 const old={pass:process.env.MOMENTUM_ADMIN_PASSWORD,secret:process.env.MOMENTUM_SESSION_SECRET};
 process.env.MOMENTUM_ADMIN_PASSWORD='Admin-Test-Only-Password-2026';
 process.env.MOMENTUM_SESSION_SECRET='s'.repeat(64);
 try{return await fn()}finally{
  if(old.pass===undefined)delete process.env.MOMENTUM_ADMIN_PASSWORD;else process.env.MOMENTUM_ADMIN_PASSWORD=old.pass;
  if(old.secret===undefined)delete process.env.MOMENTUM_SESSION_SECRET;else process.env.MOMENTUM_SESSION_SECRET=old.secret;
 }
}
test('single authenticated admin cookie works on dashboard and research screen',async()=>withAdminConfig(async()=>{
 const host='momentum-orcin-delta.vercel.app';
 const login=response();await admin({method:'POST',query:{action:'login'},headers:{origin:'https://'+host,host},body:{password:'Admin-Test-Only-Password-2026'}},login);
 assert.equal(login.statusCode,303);
 assert.match(login.headers['Set-Cookie'],/momentum_admin_session=/);
 assert.match(login.headers['Set-Cookie'],/Path=\/admin; HttpOnly; Secure; SameSite=Strict/);
 const cookie=login.headers['Set-Cookie'].split(';')[0];
 const dashboard=response();await admin({method:'GET',query:{},headers:{cookie}},dashboard);
 assert.equal(dashboard.statusCode,200);
 assert.match(dashboard.body,/통합 관리자/);
 assert.match(dashboard.body,/href="\/admin\/research\/"/);
 const research=response();await admin({method:'GET',query:{view:'research'},headers:{cookie}},research);
 assert.equal(research.statusCode,200);
 assert.match(research.body,/플레이스 순위 모니터링/);
 assert.match(research.body,/통합 관리자 홈/);
 assert.equal(admin.isAuthorized({headers:{cookie}}),true);
 assert.equal(admin.isAuthorized({headers:{cookie:cookie+'invalid'}}),false);
 const noSession=response();await admin({method:'GET',query:{view:'research'},headers:{}},noSession);
 assert.match(noSession.body,/관리자 로그인/);
 assert.doesNotMatch(noSession.body,/플레이스 순위 모니터링/);
}));
test('research lab has no independent password form or public membership login',()=>{
 const ui=fs.readFileSync('site-builder/research-index.html','utf8');
 const source=fs.readFileSync('api/_research-admin.js','utf8');
 const shell=fs.readFileSync('site-builder/operations-index.html','utf8');
 for(const forbidden of ['existingAdminForm','existingAdminPassword','회원·슬롯 관리'])assert.ok(!ui.includes(forbidden));
 assert.match(ui,/href="\/admin\/"/);
 assert.match(source,/admin\.isAuthorized\(req\)===true/);
 assert.ok(!shell.includes('/admin/members/'));
 for(const url of ['/admin/research','/admin/research/','/admin/research/api','/private/kw/:access'])
  assert.ok(config.rewrites.some(x=>x.source===url),url);
 assert.ok(fs.existsSync('private-keyword-workbench/index.html'));
});

test('standalone homepage delegates admin entry to actual unified server login',()=>{
 const homepage=fs.readFileSync('index.html','utf8');
 assert.match(homepage,/async function loadAdmin\(\)\{if\(STANDALONE\)\{location\.assign\('\/admin\/'\);return;/);
 assert.doesNotMatch(homepage,/관리자 기능은 ZIP의 로컬 서버에서 작동합니다/);
});
