'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const compact=require('../api/compact');
const active=[
 'admin-keyword-matrix','admin-competitor-compare',
 'admin-place-keyword-insights','admin-rank-watches'
];
const root=path.resolve(__dirname,'..');
function mockResponse(){
 return {code:200,headers:{},data:null,setHeader(k,v){this.headers[k]=v},
  status(n){this.code=n;return this},json(value){this.data=value;return this}};
}
test('the current admin-only site has at most twelve standalone API entrypoints',()=>{
 const names=fs.readdirSync(path.join(root,'api')).filter(n=>n.endsWith('.js')&&!n.startsWith('_'));
 assert.ok(names.length<=12,'Standalone functions: '+names.join(', '));
 assert.ok(names.includes('compact.js'));
 for(const name of active){
  assert.ok(!names.includes(name+'.js'));
  assert.ok(fs.existsSync(path.join(root,'server-handlers',name+'.js')));
 }
 for(const name of ['member-auth','member-watches','member-history','admin-members'])
  assert.ok(!fs.existsSync(path.join(root,'server-handlers',name+'.js')),name);
});
test('only active administrator routes are rewritten into the compact API handler',()=>{
 const cfg=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 for(const name of active){
  assert.ok(cfg.rewrites.some(x=>x.source==='/api/'+name&&x.destination==='/api/compact?op='+name),name);
 }
 for(const [route,op] of [
  ['/admin/keyword-matrix/api','admin-keyword-matrix'],
  ['/admin/place-insights/api','admin-place-keyword-insights'],
  ['/admin/competitors/api','admin-competitor-compare'],
  ['/admin/watches/api','admin-rank-watches'],
  ['/admin/connection/api','admin-connection']
 ]){
  assert.ok(cfg.rewrites.some(x=>x.source===route&&x.destination==='/api/compact?op='+op),route);
 }
 assert.ok(cfg.functions['api/compact.js'].includeFiles.includes('@sparticuz/chromium'));
 for(const name of ['admin-members','member-auth','member-watches','member-history'])
  assert.ok(!cfg.rewrites.some(x=>x.source.includes(name)||x.destination.includes('op='+name)));
});
test('invalid or retired router operations always reject',async()=>{
 for(const op of ['../../_rank-store','admin-members','member-auth','member-watches','member-history']){
  const r=mockResponse();
  await compact({method:'POST',query:{op},headers:{}},r);
  assert.equal(r.code,404,op);assert.match(r.data.error,/지원하지 않는/);
  assert.equal(r.headers['Cache-Control'],'private, no-store');
 }
});
test('active compact handlers remain independently authenticated',async()=>{
 for(const op of [...active,'admin-connection']){
  const r=mockResponse();
  await compact({method:'GET',query:{op},headers:{}},r);
  assert.equal(r.code,401,op);
 }
});
test('admin login routes remain registered while public membership is retired',()=>{
 const cfg=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 for(const route of ['/admin','/admin/','/admin/login','/admin/logout']){
  assert.ok(cfg.rewrites.some(x=>x.source===route),route);
 }
 assert.ok(cfg.redirects.some(x=>x.source==='/platform/:path*'&&x.destination==='/'));
 assert.ok(!cfg.rewrites.some(x=>x.source==='/api/member-auth'||x.source==='/admin/members'));
});
