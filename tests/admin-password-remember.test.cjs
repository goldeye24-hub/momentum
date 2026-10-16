'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const handler=require('../api/admin-site-builder');
function response(){return{statusCode:200,headers:{},body:'',setHeader(k,v){this.headers[k]=v},end(v){this.body=String(v||'');return this}}}
function withConfig(fn){
 const prev={password:process.env.MOMENTUM_ADMIN_PASSWORD,secret:process.env.MOMENTUM_SESSION_SECRET};
 process.env.MOMENTUM_ADMIN_PASSWORD='Test-only-admin-secret-987654321';
 process.env.MOMENTUM_SESSION_SECRET='a'.repeat(64);
 try{return fn()}finally{
  if(prev.password===undefined)delete process.env.MOMENTUM_ADMIN_PASSWORD;else process.env.MOMENTUM_ADMIN_PASSWORD=prev.password;
  if(prev.secret===undefined)delete process.env.MOMENTUM_SESSION_SECRET;else process.env.MOMENTUM_SESSION_SECRET=prev.secret;
 }
}
test('administrator login offers optional browser-managed password saving',()=>withConfig(()=>{
 const res=response();handler({method:'GET',query:{},headers:{cookie:''}},res);
 assert.equal(res.statusCode,200);
 assert.match(res.body,/<input[^>]+id="rememberAdminPassword"[^>]+type="checkbox"|<input[^>]+type="checkbox"[^>]+id="rememberAdminPassword"/);
 assert.match(res.body,/관리자 비밀번호 저장/);
 assert.match(res.body,/autocomplete="username"/);
 assert.match(res.body,/autocomplete="off"/);
 assert.match(res.body,/navigator\.credentials\.store/);
 assert.match(res.body,/new PasswordCredential/);
 const script=res.body.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(script,'Login form should expose an opt-in password manager workflow');
 assert.doesNotThrow(()=>new vm.Script(script[1]));
 const preferenceWrites=[...script[1].matchAll(/localStorage\.setItem\(([^)]*)\)/g)].map(x=>x[1]);
 assert.deepEqual(preferenceWrites,["preference,'1'"]);
 assert.doesNotMatch(script[1],/localStorage\.(?:setItem|getItem)\([^)]*password\.value/);
 assert.doesNotMatch(script[1],/sessionStorage\.(?:setItem|getItem)\([^)]*password\.value/);
 assert.ok(!res.body.includes('Test-only-admin-secret-987654321'),'The login HTML must not include server password');
}));
test('server-side administrator password validation and cookie policy remain intact',()=>withConfig(()=>{
 const req={method:'POST',query:{action:'login'},
  headers:{origin:'https://example.test',host:'example.test'},
  body:{username:'momentum-admin',password:'Test-only-admin-secret-987654321'}};
 const res=response();handler(req,res);
 assert.equal(res.statusCode,303);
 assert.equal(res.headers.Location,'/admin/');
 assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
 assert.doesNotMatch(res.headers['Set-Cookie'],/Test-only-admin-secret/);
 const bad=response();handler({...req,body:{username:'momentum-admin',password:'wrong-admin-password-123'}},bad);
 assert.equal(bad.statusCode,401);
 assert.equal(bad.headers['Set-Cookie'],undefined);
}));
