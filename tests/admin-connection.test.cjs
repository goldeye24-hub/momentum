'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const handler=require('../server-handlers/admin-connection');
const admin=require('../api/admin-site-builder'),db=require('../api/_rank-store'),member=require('../api/_member-session');
function res(){return{statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(x){this.body=x;return this}}}
async function mocked(opts,run){
 const old={authorized:admin.isAuthorized,config:db.config,request:db.request,memberConfig:member.configured,auth:member.authCall};
 admin.isAuthorized=()=>opts.auth!==false;
 db.config=()=>opts.dbConfig===false?null:{base:'https://test.supabase.co'};
 member.configured=()=>opts.memberConfig===false?null:{base:'https://test.supabase.co',anon:'public'};
 db.request=opts.dbRequest||((table)=>Promise.resolve([]));
 member.authCall=opts.authCall||(()=>Promise.resolve({external:true}));
 try{await run()}finally{admin.isAuthorized=old.authorized;db.config=old.config;db.request=old.request;member.configured=old.memberConfig;member.authCall=old.auth}
}
test('live database check is administrator-only and read-only',async()=>{
 await mocked({auth:false},async()=>{
  const r=res();await handler({method:'GET',headers:{}},r);
  assert.equal(r.statusCode,401);
 });
 await mocked({},async()=>{
  const r=res();await handler({method:'POST',headers:{}},r);
  assert.equal(r.statusCode,405);
 });
});
test('diagnostics confirm the nine required Supabase tables and Auth without printing records',async()=>{
 const tables=[];
 await mocked({dbRequest:async(table,options)=>{tables.push({table,options});return [{email:'private@customer.invalid',user_id:'private-id'}]}},async()=>{
  const r=res();await handler({method:'GET',headers:{}},r);
  assert.equal(r.statusCode,200);assert.equal(r.body.status,'ok');
  assert.equal(r.body.database.checkedCount,9);assert.equal(r.body.database.passedCount,9);
  assert.equal(r.body.authentication.connectivity,'ok');
  assert.equal(r.headers['Cache-Control'],'private, no-store');
  assert.doesNotMatch(JSON.stringify(r.body),/private@customer\.invalid|private-id/);
 });
 assert.equal(tables.length,9);
 assert.ok(tables.every(x=>x.options.query.limit===1));
 assert.ok(tables.some(x=>x.table==='momentum_member_accounts'));
 assert.ok(tables.some(x=>x.table==='rank_keyword_snapshots'));
});
test('diagnostics report failed database/auth connections without leaking credentials or raw exceptions',async()=>{
 await mocked({dbRequest:async()=>{throw Error('secret database URL and service token')},authCall:async()=>{throw Error('private auth error')}},async()=>{
  const r=res();await handler({method:'GET',headers:{}},r);
  assert.equal(r.statusCode,503);assert.equal(r.body.status,'degraded');
  assert.equal(r.body.database.passedCount,0);
  assert.equal(r.body.authentication.connectivity,'failed');
  assert.doesNotMatch(JSON.stringify(r.body),/token|private auth error|secret database URL/);
 });
 await mocked({dbConfig:false,memberConfig:false},async()=>{
  const r=res();await handler({method:'GET',headers:{}},r);
  assert.equal(r.statusCode,503);assert.equal(r.body.status,'not_configured');
 });
});
test('diagnostic route uses same API function budget, private admin router and no new entrypoint',()=>{
 const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 const app=fs.readFileSync('api/compact.js','utf8');
 const adminRouter=fs.readFileSync('api/admin-site-builder.js','utf8');
 const ui=fs.readFileSync('site-builder/connection-index.html','utf8');
 assert.ok(config.rewrites.some(x=>x.source==='/admin/connection/api'&&x.destination==='/api/compact?op=admin-connection'));
 assert.ok(config.rewrites.some(x=>x.source==='/admin/connection/'&&x.destination.includes('view=connection')));
 assert.match(app,/admin-connection/);
 assert.match(adminRouter,/view==='connection'/);
 assert.match(ui,/\/admin\/connection\/api/);
 assert.doesNotMatch(ui,/service_role|sb_secret_|sb_publishable_/);
 assert.equal(fs.existsSync('api/admin-connection.js'),false);
});
