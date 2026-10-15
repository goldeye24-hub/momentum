'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const compact=require('../api/compact');
const moved=[
 'admin-keyword-matrix','admin-competitor-compare','admin-members',
 'admin-place-keyword-insights','member-auth','member-watches','member-history','admin-rank-watches'
];
const root=path.resolve(__dirname,'..');
function mockResponse(){
 return {code:200,headers:{},data:null,setHeader(k,v){this.headers[k]=v},
  status(n){this.code=n;return this},json(value){this.data=value;return this}};
}
test('Hobby deployments expose no more than twelve standalone API entrypoints',()=>{
 const filenames=fs.readdirSync(path.join(root,'api')).filter(name=>name.endsWith('.js')&&!name.startsWith('_'));
 assert.ok(filenames.length<=12,'Standalone endpoints '+filenames.length+': '+filenames.join(', '));
 assert.ok(filenames.includes('compact.js'));
 for(const name of moved){
  assert.ok(!filenames.includes(name+'.js'),'Old standalone function must not remain: '+name);
  assert.ok(fs.existsSync(path.join(root,'server-handlers',name+'.js')));
 }
});
test('each former API URL is rewritten to an allowlisted compact handler',()=>{
 const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 for(const name of moved){
  assert.ok(config.rewrites.some(x=>x.source==='/api/'+name&&
    x.destination==='/api/compact?op='+name),'Missing compatibility route: '+name);
 }
 for(const [route,op] of [
  ['/admin/keyword-matrix/api','admin-keyword-matrix'],
  ['/admin/place-insights/api','admin-place-keyword-insights'],
  ['/admin/competitors/api','admin-competitor-compare'],
  ['/admin/members/api','admin-members'],
  ['/admin/watches/api','admin-rank-watches']
 ]){
  assert.ok(config.rewrites.some(x=>x.source===route&&x.destination==='/api/compact?op='+op));
 }
 assert.ok(config.functions['api/compact.js'].includeFiles.includes('@sparticuz/chromium'));
 for(const name of moved)assert.equal(config.functions['api/'+name+'.js'],undefined);
});
test('invalid router operation never reads a handler or leaks an internal error',async()=>{
 const r=mockResponse();
 await compact({method:'POST',query:{op:'../../_rank-store'},headers:{}},r);
 assert.equal(r.code,404);assert.match(r.data.error,/지원하지 않는/);
 assert.equal(r.headers['Cache-Control'],'private, no-store');
});
test('all previously protected API handlers remain independently authenticated',async()=>{
 for(const op of moved){
  const r=mockResponse();
  await compact({method:'GET',query:{op},headers:{}},r);
  if(op==='member-auth'){
   // Login status is deliberately public. An unconfigured Auth service
   // returns 503; a configured service without cookies returns anonymous.
   assert.ok([200,503].includes(r.code));
   if(r.code===200)assert.equal(r.data.authenticated,false);
  }else{
   assert.equal(r.code,401,'Unauthenticated request should fail for '+op);
  }
 }
});

test('legacy Momentum hostname redirects to the one login-cookie origin',()=>{
 const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 const redirect=config.redirects.find(x=>x.has?.some(item=>item.type==='host'&&item.value==='momentum-orcin-delta.vercel.app'));
 assert.ok(redirect);
 assert.equal(redirect.source,'/:path*');
 assert.equal(redirect.destination,'https://momentum-goldeye24-hubs-projects.vercel.app/:path*');
 assert.equal(redirect.permanent,false);
});
