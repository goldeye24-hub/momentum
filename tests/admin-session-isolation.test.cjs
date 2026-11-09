'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const auth=require('../api/_admin-session');
const ROOT=path.resolve(__dirname,'..');
const dependant=[
 'api/_research-admin.js','api/editorial-keywords.js',
 'server-handlers/admin-connection.js','server-handlers/admin-rank-watches.js',
 'server-handlers/admin-keyword-matrix.js','server-handlers/admin-competitor-compare.js',
 'server-handlers/admin-place-keyword-insights.js'
];
test('all research and keyword APIs import standalone admin session, not legacy UI',()=>{
 for(const file of dependant){
  const source=fs.readFileSync(path.join(ROOT,file),'utf8');
  assert.match(source,/_admin-session/,file);
  assert.doesNotMatch(source,/require\(['\"](?:\.\/|\.\.\/api\/)admin-site-builder['\"]\)/,file);
 }
});
test('valid and invalid HMAC sessions work without loading legacy page router',()=>{
 const oldPass=process.env.MOMENTUM_ADMIN_PASSWORD;
 const oldSecret=process.env.MOMENTUM_SESSION_SECRET;
 process.env.MOMENTUM_ADMIN_PASSWORD='test-only-strong-password-123456789';
 process.env.MOMENTUM_SESSION_SECRET='test-only-session-secret-123456789000';
 try{
  const cfg=auth.ready();assert.ok(cfg);
  const cookie=auth.makeCookie(cfg.secret).split(';')[0];
  assert.equal(auth.isAuthorized({headers:{cookie}}),true);
  assert.equal(auth.isAuthorized({headers:{cookie:'momentum_admin_session=invalid'}}),false);
  assert.equal(auth.isAuthorized({headers:{cookie:''}}),false);
  assert.equal(require.cache[require.resolve('../api/admin-site-builder')],undefined);
 }finally{
  if(oldPass===undefined)delete process.env.MOMENTUM_ADMIN_PASSWORD;else process.env.MOMENTUM_ADMIN_PASSWORD=oldPass;
  if(oldSecret===undefined)delete process.env.MOMENTUM_SESSION_SECRET;else process.env.MOMENTUM_SESSION_SECRET=oldSecret;
 }
});
