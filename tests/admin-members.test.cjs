'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const admin=require('../api/admin-site-builder'),db=require('../api/_rank-store');
const handler=require('../api/admin-members');
const USER='11111111-1111-4111-8111-111111111111';
function response(){return{statusCode:200,data:null,setHeader(){},status(code){this.statusCode=code;return this},json(x){this.data=x;return this}}}
async function mock(props,fn){
 const prev={auth:admin.isAuthorized,config:db.config,request:db.request};
 admin.isAuthorized=()=>props.authorized!==false;
 db.config=()=>props.configured===false?null:{base:'https://example.supabase.co',token:'x'};
 if(props.request)db.request=props.request;
 try{await fn()}finally{admin.isAuthorized=prev.auth;db.config=prev.config;db.request=prev.request}
}
test('admin member summary refuses unauthenticated access and invalid DB',async()=>{
 await mock({authorized:false},async()=>{const r=response();await handler({method:'GET',headers:{}},r);assert.equal(r.statusCode,401)});
 await mock({configured:false},async()=>{const r=response();await handler({method:'GET',headers:{}},r);assert.equal(r.statusCode,503)});
});
test('admin member summary accesses server-only aggregation and never public membership data',async()=>{
 let calls=0;
 await mock({request:async(table,args)=>{calls++;assert.equal(table,'rpc/momentum_admin_member_summary');
  assert.equal(args.method,'POST');
  return [{user_id:USER,email:'test@company.kr',plan:'free',slot_limit:1,used_slots:0}]
 }},async()=>{
  const r=response();await handler({method:'GET',headers:{}},r);
  assert.equal(r.statusCode,200);
  assert.equal(r.data.accounts[0].plan,'free');
  assert.match(r.data.notice,/결제/);
 });
 assert.equal(calls,1);
});
test('admin slot override requires same-origin, reason and free account only in SQL',async()=>{
 await mock({},async()=>{
  const r=response();await handler({method:'POST',headers:{origin:'https://attacker.test',host:'momentum.example'},body:{
   action:'set_pilot_slots',userId:USER,limit:10,reason:'테스트 고객 배정'
  }},r);assert.equal(r.statusCode,403);
 });
 await mock({},async()=>{
  const r=response();await handler({method:'POST',headers:{origin:'https://momentum.example',host:'momentum.example'},body:{
   action:'set_pilot_slots',userId:USER,limit:250,reason:'invalid'
  }},r);assert.equal(r.statusCode,400);
 });
 const observed=[];
 await mock({request:async(table,args)=>{observed.push({table,body:args.body});return {userId:USER,slotLimit:4,plan:'free'}}},async()=>{
  const r=response();await handler({method:'POST',headers:{origin:'https://momentum.example',host:'momentum.example'},body:{
   action:'set_pilot_slots',userId:USER,limit:4,reason:'파일럿 고객 검사'
  }},r);
  assert.equal(r.statusCode,200);assert.equal(r.data.changed.slotLimit,4);
 });
 assert.deepEqual(observed,[{table:'rpc/momentum_admin_set_pilot_slots',body:{p_user:USER,p_limit:4,p_reason:'파일럿 고객 검사'}}]);
 const sql=fs.readFileSync('db/member-portal.sql','utf8');
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/v_plan<>'free'/);
 assert.match(sql,/pilot_limit_below_existing_use/);
 assert.match(sql,/momentum_member_slot_audit/);
 assert.match(sql,/revoke all on function public\.momentum_admin_set_pilot_slots/);
});
test('member operations screen is protected and has valid UI code',()=>{
 const html=fs.readFileSync('site-builder/member-admin-index.html','utf8');
 const js=fs.readFileSync('site-builder/member-admin.js','utf8');
 const router=fs.readFileSync('api/admin-site-builder.js','utf8');
 const cfg=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 assert.match(router,/view==='members'/);
 assert.match(router,/member-admin-index\.html/);
 assert.match(html,/id="rows"/);
 assert.match(html,/내부 시험/);
 assert.match(js,/set_pilot_slots/);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.ok(cfg.rewrites.some(x=>x.source==='/admin/members/api'));
});
