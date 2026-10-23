'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const admin=require('../api/admin-site-builder');
const memberWatches=require('../server-handlers/member-watches');
const adminConnection=require('../server-handlers/admin-connection');
function response(){return{statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v},end(v){this.body=String(v||'');return this},status(n){this.statusCode=n;return this},json(data){this.body=data;return this}}}
function adminConfigured(callback){
 const k=['MOMENTUM_ADMIN_PASSWORD','MOMENTUM_SESSION_SECRET'];
 const original=Object.fromEntries(k.map(v=>[v,process.env[v]]));
 process.env.MOMENTUM_ADMIN_PASSWORD='Only-for-testing-admin-password-with-sufficient-length';
 process.env.MOMENTUM_SESSION_SECRET='s'.repeat(64);
 try{return callback()}finally{for(const v of k)if(original[v]===undefined)delete process.env[v];else process.env[v]=original[v]}
}
test('exact public/member/admin entrypoints exist with preserved legacy routes',()=>{
 const cfg=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 for(const name of ['index.html','lab/index.html','platform/index.html','site-builder/index.html','site-builder/operations-index.html'])
  assert.ok(fs.statSync(name).isFile(),name);
 const rewrite=(route,target)=>assert.ok(cfg.rewrites.some(x=>x.source===route&&x.destination===target),'Missing '+route);
 rewrite('/platform/','/platform/index.html');
 rewrite('/admin/','/api/admin-site-builder');
 rewrite('/admin/overview/','/api/admin-site-builder?view=overview');
 rewrite('/admin/studio/','/api/admin-site-builder?view=studio');
 assert.equal(Object.keys(cfg.functions).length,4,'Do not exceed Vercel Hobby function budget');
});
test('public and member navigation directs visitors into correct service area',()=>{
 const home=fs.readFileSync('index.html','utf8');
 const lab=fs.readFileSync('lab/index.html','utf8');
 const member=fs.readFileSync('platform/index.html','utf8');
 const adminHub=fs.readFileSync('site-builder/operations-index.html','utf8');
 assert.ok(home.includes('class="momentum-header-login" href="/platform/">로그인</a>'));
 assert.ok(home.includes('href="/agency/"'));
 assert.match(lab,/href="\/platform\/">회원 서비스·로그인/);
 assert.match(member,/id="dashboard" hidden/);
 assert.match(member,/member-service-hub/);
 assert.match(member,/href="#watchForm"/);
 assert.match(member,/id="memberWatchList"/);
 assert.match(adminHub,/href="\/admin\/crm\/"/);
 assert.match(adminHub,/href="\/admin\/watches\/"/);
 assert.match(adminHub,/href="\/admin\/connection\/"/);
 assert.match(adminHub,/서버 저장 미구현/);
 assert.match(adminHub,/측정 데이터 필요/);
});
test('administrators get a protected central home; original editor remains available at studio',()=>adminConfigured(()=>{
 const req={method:'GET',query:{},headers:{cookie:''}};
 let r=response();admin(req,r);
 assert.match(r.body,/관리자 로그인/);
 assert.doesNotMatch(r.body,/관리자 운영센터/);
 r=response();admin({...req,query:{asset:'operations-index.html'}},r);
 assert.equal(r.statusCode,401);
 const login=response();admin({method:'POST',query:{action:'login'},headers:{
  origin:'https://momentum.example',host:'momentum.example'},body:{password:process.env.MOMENTUM_ADMIN_PASSWORD}},login);
 assert.equal(login.statusCode,303);
 const cookie=login.headers['Set-Cookie'].split(';')[0];
 const headers={cookie};
 r=response();admin({...req,headers},r);
 assert.equal(r.statusCode,200);
 assert.match(r.body,/<title>관리자 운영센터/);
 assert.match(r.body,/운영 DB 연결 진단/);
 const dashboard=response();admin({...req,headers,query:{view:'overview'}},dashboard);
 assert.equal(dashboard.statusCode,200);
 assert.match(dashboard.body,/관리자 운영센터/);
 const editor=response();admin({...req,headers,query:{view:'studio'}},editor);
 assert.equal(editor.statusCode,200);
 assert.match(editor.body,/홈페이지 제작 스튜디오/);
}));
test('an anonymous visitor or a member cookie cannot use privileged admin APIs',async()=>adminConfigured(async()=>{
 const req={method:'GET',headers:{cookie:'momentum_member_session=fake.membercookie'}};
 let r=response();adminConnection(req,r);
 assert.equal(r.statusCode,401);
 r=response();await memberWatches(req,r);
 assert.equal(r.statusCode,401);
}));
test('README/QA matrix calls out live DB failure, no background collection and local-only CRM',()=>{
 const doc=fs.readFileSync('docs/service-map-and-qa.md','utf8');
 for(const term of ['운영 실패 보고','운영 미검증','관리자 DB 접근 오류','정기 자동 추적','로컬 저장','외부 서비스','로그인 회원 서비스','관리자 모드'])
  assert.ok(doc.includes(term),term);
});

test('all private business APIs require the right role, never accepting the opposite session type',async()=>adminConfigured(async()=>{
 for(const handlerName of ['admin-connection','admin-keyword-matrix','admin-competitor-compare','admin-members','admin-place-keyword-insights','admin-rank-watches']){
  const handler=require('../server-handlers/'+handlerName);
  const r=response();
  await handler({method:'GET',headers:{cookie:'momentum_member_session=fake.member',host:'example.test'},query:{}},r);
  assert.equal(r.statusCode,401,handlerName+' must block member cookies');
 }
 for(const handlerName of ['member-watches','member-history']){
  const handler=require('../server-handlers/'+handlerName);
  const r=response();
  await handler({method:'GET',headers:{cookie:'momentum_admin_session=fake.admin',host:'example.test'},query:{}},r);
  assert.equal(r.statusCode,401,handlerName+' must block admin cookies and anonymous access');
 }
}));
