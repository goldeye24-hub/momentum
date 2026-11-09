'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cfg=JSON.parse(read('vercel.json'));
const removed=[
 'api/_member-session.js','api/_member-history-model.js',
 'server-handlers/member-auth.js','server-handlers/member-history.js',
 'server-handlers/member-watches.js','server-handlers/admin-members.js',
 'site-builder/member-admin-index.html','site-builder/member-admin.js',
 'db/member-portal.sql','docs/member-portal-setup.md'
];
test('obsolete public-member and trial-slot files are not deployed',()=>{
 for(const p of removed)assert.equal(fs.existsSync(path.join(root,p)),false,p);
 const urls=['/api/admin-members','/api/member-auth','/api/member-watches','/api/member-history',
  '/admin/members/api','/admin/members','/admin/members/','/platform','/platform/'];
 for(const url of urls)assert.ok(!cfg.rewrites.some(x=>x.source===url),url);
 assert.ok(cfg.redirects.some(x=>x.source==='/platform/:path*'&&x.destination==='/'));
});
test('admin authentication, private research and contact services remain operationally wired',()=>{
 const admin=read('api/admin-site-builder.js'),app=read('api/compact.js'),research=read('api/_research-admin.js');
 assert.match(admin,/module\.exports\.isAuthorized/);
 assert.ok(!admin.includes('member-admin-index.html'));
 assert.ok(!app.includes('admin-members'));
 assert.match(read('api/_admin-email-login.js'),/_admin-auth-provider/);
 assert.match(read('api/_admin-auth-provider.js'),/unsupported_admin_auth_operation/);
 assert.doesNotMatch(research,/_member-session/);
 assert.match(research,/admin\.isAuthorized/);
 assert.match(research,/validOrigin/);
 assert.ok(fs.existsSync(path.join(root,'api/inquiries.js')));
 assert.ok(fs.existsSync(path.join(root,'private-keyword-workbench/index.html')));
 for(const p of ['/private/kw/:access','/admin/research/api','/admin/connection/api','/admin/login'])
  assert.ok(cfg.rewrites.some(x=>x.source===p),p);
 assert.ok(!read('site-builder/index.html').includes('/admin/members/'));
 assert.ok(!read('site-builder/connection-index.html').includes('/admin/members/'));
});
test('retired public member handlers are not reachable by compact router',async()=>{
 const handler=require('../api/compact');
 for(const op of ['member-auth','member-watches','member-history','admin-members']){
  const result={code:200,data:null,setHeader(){},status(x){this.code=x;return this},json(x){this.data=x;return this}};
  await handler({method:'GET',query:{op},headers:{}},result);
  assert.equal(result.code,404,op);
 }
});
