'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const handler=require('../server-handlers/admin-connection');
const admin=require('../api/admin-site-builder'),db=require('../api/_rank-store');
function res(){return{statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(x){this.body=x;return this}}}
async function mocked(opts,run){
 const prev={authorized:admin.isAuthorized,config:db.config,request:db.request};
 admin.isAuthorized=()=>opts.auth!==false;
 db.config=()=>opts.dbConfig===false?null:{base:'https://test.supabase.co'};
 db.request=opts.dbRequest||(()=>Promise.resolve([]));
 try{await run()}finally{admin.isAuthorized=prev.authorized;db.config=prev.config;db.request=prev.request;}
}
test('admin-only database diagnosis rejects unauthenticated and non-GET requests',async()=>{
 await mocked({auth:false},async()=>{
  const r=res();await handler({method:'GET',headers:{}},r);assert.equal(r.statusCode,401);
 });
 await mocked({},async()=>{
  const r=res();await handler({method:'POST',headers:{}},r);assert.equal(r.statusCode,405);
 });
});
test('only the six operator research tables are checked and no records leak',async()=>{
 const calls=[];
 await mocked({dbRequest:async(table,options)=>{calls.push({table,options});return[{email:'private@customer.invalid',user_id:'private-id'}]}},async()=>{
  const r=res();await handler({method:'GET',headers:{}},r);
  assert.equal(r.statusCode,200);assert.equal(r.body.status,'ok');
  assert.equal(r.body.database.checkedCount,6);assert.equal(r.body.database.passedCount,6);
  assert.equal(r.headers['Cache-Control'],'private, no-store');
  assert.doesNotMatch(JSON.stringify(r.body),/private@customer\.invalid|private-id/);
  assert.equal(r.body.authentication,undefined);
 });
 assert.equal(calls.length,6);
 assert.ok(calls.every(x=>x.options.query.limit===1));
 assert.ok(!calls.some(x=>x.table.includes('member')));
 assert.ok(calls.some(x=>x.table==='rank_keyword_snapshots'));
});
test('database failures never leak credentials and missing configuration fails safely',async()=>{
 await mocked({dbRequest:async()=>{throw Error('secret database URL and service token')}},async()=>{
  const r=res();await handler({method:'GET',headers:{}},r);
  assert.equal(r.statusCode,503);assert.equal(r.body.status,'degraded');
  assert.equal(r.body.database.passedCount,0);
  assert.doesNotMatch(JSON.stringify(r.body),/secret database URL|service token/);
 });
 await mocked({dbConfig:false},async()=>{
  const r=res();await handler({method:'GET',headers:{}},r);
  assert.equal(r.statusCode,503);assert.equal(r.body.status,'not_configured');
 });
});
test('diagnostics remain on the single protected admin API router',()=>{
 const cfg=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 const compact=fs.readFileSync('api/compact.js','utf8');
 const router=fs.readFileSync('api/admin-site-builder.js','utf8');
 const ui=fs.readFileSync('site-builder/connection-index.html','utf8');
 assert.ok(cfg.rewrites.some(x=>x.source==='/admin/connection/api'&&x.destination==='/api/compact?op=admin-connection'));
 assert.ok(cfg.rewrites.some(x=>x.source==='/admin/connection/'&&x.destination.includes('view=connection')));
 assert.match(compact,/admin-connection/);
 assert.match(router,/connection:'connection-index\.html'/);
 assert.match(ui,/\/admin\/connection\/api/);
 assert.doesNotMatch(ui,/service_role|sb_secret_|sb_publishable_|회원 인증/);
 assert.equal(fs.existsSync('api/admin-connection.js'),false);
});
