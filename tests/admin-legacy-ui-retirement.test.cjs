'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const retired=["site-builder/operations-index.html","site-builder/index.html","site-builder/editor.css","site-builder/editor.js","site-builder/kit.js","site-builder/presets.json","site-builder/site-template.css","site-builder/design-editor.html","site-builder/design-editor.css","site-builder/design-editor.js"],routes=["/admin/overview","/admin/overview/","/admin/studio","/admin/studio/","/admin/designs","/admin/designs/"];
const cfg=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
test('old admin studio and editor code deleted; research, CRM backup and auth retained',()=>{
 for(const file of retired)assert.equal(fs.existsSync(path.join(root,file)),false,file);
 for(const file of ['site-builder/research-index.html','site-builder/keyword-matrix-index.html','site-builder/crm-index.html','site-builder/finance-index.html','api/_admin-session.js'])assert.ok(fs.existsSync(path.join(root,file)),file);
 for(const route of routes){assert.ok(!cfg.rewrites.some(x=>x.source===route),route);assert.ok(cfg.redirects.some(x=>x.source===route&&x.destination==='/admin/research/'),route)}
});
test('authenticated admin root serves research and not old operations portal',async()=>{
 const auth=require('../api/_admin-session'),handler=require('../api/admin-site-builder');
 const p=process.env.MOMENTUM_ADMIN_PASSWORD,s=process.env.MOMENTUM_SESSION_SECRET;
 process.env.MOMENTUM_ADMIN_PASSWORD='test-only-very-long-admin-password';
 process.env.MOMENTUM_SESSION_SECRET='test-only-secret-123456789000000000000000000';
 try{
  const cookie=auth.makeCookie(auth.ready().secret).split(';')[0];
  const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v},end(body){this.body=body;return this}};
  await handler({method:'GET',headers:{cookie},query:{}},res);
  assert.equal(res.statusCode,200);assert.match(res.body,/순위·검색량 모니터링/);assert.doesNotMatch(res.body,/관리자 전용 홈페이지 제작 스튜디오/);
 }finally{if(p===undefined)delete process.env.MOMENTUM_ADMIN_PASSWORD;else process.env.MOMENTUM_ADMIN_PASSWORD=p;if(s===undefined)delete process.env.MOMENTUM_SESSION_SECRET;else process.env.MOMENTUM_SESSION_SECRET=s}
});
