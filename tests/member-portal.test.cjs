'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const member=require('../api/_member-session');
const db=require('../api/_rank-store');
const authHandler=require('../api/member-auth'),watchesHandler=require('../api/member-watches');
const ID='11111111-1111-4111-8111-111111111111';
function response(){return{statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(data){this.body=data;return this}}}
const req=(method,body,extra={})=>({method,body,headers:{host:'momentum.example',origin:'https://momentum.example',...extra}});
async function mock(options,work){
 const orig={check:member.check,configured:member.configured,valid:member.validOrigin,auth:member.authCall,
  sign:member.sign,config:db.config,request:db.request};
 member.check=options.session===false?()=>null:()=>({userId:ID,email:'owner@company.test'});
 member.configured=()=>options.configured===false?null:{base:'https://example.supabase.co',anon:'xx'};
 member.validOrigin=options.origin===false?()=>false:()=>true;
 member.authCall=options.authCall||(()=>Promise.resolve({}));
 member.sign=()=> 'test.signed-cookie';
 db.config=()=>options.db===false?null:{base:'https://example.supabase.co',token:'xx'};
 db.request=options.dbRequest||(()=>Promise.resolve([]));
 try{await work()}finally{
  member.check=orig.check;member.configured=orig.configured;member.validOrigin=orig.valid;
  member.authCall=orig.auth;member.sign=orig.sign;db.config=orig.config;db.request=orig.request;
 }
}
test('member cookies are tamper-evident and expire without backend access',()=>{
 const prev=process.env.MOMENTUM_MEMBER_SESSION_SECRET;
 process.env.MOMENTUM_MEMBER_SESSION_SECRET='a'.repeat(64);
 try{
  const t=Date.now(),token=member.sign({userId:ID,email:'owner@company.test'},t);
  assert.ok(token);
  assert.deepEqual(member.check({headers:{cookie:member.COOKIE+'='+encodeURIComponent(token)}},t+1000),
   {userId:ID,email:'owner@company.test'});
  const [payload,mac]=token.split('.');
  assert.equal(member.check({headers:{cookie:member.COOKIE+'='+payload+'.'+mac.slice(0,-1)+'x'}},t+1000),null);
  assert.equal(member.check({headers:{cookie:member.COOKIE+'='+token}},t+member.LIFETIME_MS+1),null);
  assert.match(member.cookie(token),/HttpOnly; Secure; SameSite=Lax/);
 }finally{if(prev===undefined)delete process.env.MOMENTUM_MEMBER_SESSION_SECRET;
 else process.env.MOMENTUM_MEMBER_SESSION_SECRET=prev}
});
test('sign-up never creates paid plans or sets a customer session',async()=>{
 const calls=[];
 await mock({authCall:async(name,opts)=>{calls.push([name,opts.body.email]);return {user:{id:ID}}}},
 async()=>{
  const res=response();await authHandler(req('POST',{action:'signup',email:'OWNER@COMPANY.TEST',password:'this-is-a-strong-password'}),res);
  assert.equal(res.statusCode,200);assert.match(res.body.message,/이메일/);
  assert.equal(res.headers['Set-Cookie'],undefined);
 });
 assert.deepEqual(calls,[['signup','owner@company.test']]);
});
test('confirmed sign-in creates free member using identity from auth provider, not posted userId',async()=>{
 const calls=[];
 await mock({
  authCall:async()=>({user:{id:ID,email:'verified@company.test',email_confirmed_at:'2026-10-15T00:00:00Z'},access_token:'opaque'}),
  dbRequest:async(table,opts)=>{calls.push({table,body:opts.body});
   return {userId:ID,email:'verified@company.test',plan:'free',slotLimit:1}}
 },async()=>{
  const res=response();await authHandler(req('POST',{action:'login',email:'verified@company.test',
   password:'this-is-a-strong-password',userId:'99999999-9999-4999-8999-999999999999',plan:'agency'}),res);
  assert.equal(res.statusCode,200);assert.equal(res.body.plan,'free');
  assert.match(res.headers['Set-Cookie'],/HttpOnly/);
 });
 assert.deepEqual(calls,[{table:'rpc/momentum_member_ensure',body:{p_user:ID,p_email:'verified@company.test'}}]);
});
test('unverified members and cross-site POSTs cannot set sessions',async()=>{
 await mock({authCall:async()=>({user:{id:ID,email:'owner@company.test',email_confirmed_at:null}})},async()=>{
  const res=response();await authHandler(req('POST',{action:'login',email:'owner@company.test',password:'this-is-a-strong-password'}),res);
  assert.equal(res.statusCode,403);assert.equal(res.headers['Set-Cookie'],undefined);
 });
 await mock({origin:false},async()=>{
  const res=response();await authHandler(req('POST',{action:'signup',email:'owner@company.test',password:'this-is-a-strong-password'}),res);
  assert.equal(res.statusCode,403);
 });
});
test('user-scoped watch GET includes only own target RPC and latest real snapshot values',async()=>{
 const calls=[];
 await mock({dbRequest:async(table,opts)=>{
  calls.push({table,query:opts.query,body:opts.body});
  if(table==='momentum_member_accounts')return [{plan:'free',slot_limit:1}];
  if(table==='rpc/momentum_member_overview')return [{
   id:'22222222-2222-4222-8222-222222222222',label:'내 업체',keyword:'포항맛집',place_id:'2085358113',
   rank:null,observed_at:null
  }];
  throw Error('Unexpected DB access');
 }},async()=>{
  const res=response();await watchesHandler(req('GET'),res);
  assert.equal(res.statusCode,200);assert.equal(res.body.usedSlots,1);
  assert.equal(res.body.targets[0].rank,null);
  assert.match(res.body.disclaimer,/실제로 저장된/);
 });
 assert.equal(calls[0].query.user_id,'eq.'+ID);
 assert.deepEqual(calls[1].body,{p_user:ID});
});
test('watch creation uses only signed session owner and cannot self-award slots',async()=>{
 let params;
 await mock({dbRequest:async(table,opts)=>{params={table,opts};
  return {id:'22222222-2222-4222-8222-222222222222'}}
 },async()=>{
  const res=response();
  await watchesHandler(req('POST',{action:'add',label:'퐝물회',keyword:'포항맛집',
   target:'2085358113',ownerId:'99999999-9999-4999-8999-999999999999',slotLimit:999}),res);
  assert.equal(res.statusCode,201);
 });
 assert.equal(params.table,'rpc/momentum_member_add_target');
 assert.equal(params.opts.body.p_user,ID);
 assert.equal(params.opts.body.p_place_id,'2085358113');
 assert.equal(params.opts.body.p_scope,'mobile');
 assert.equal(Object.hasOwn(params.opts.body,'slotLimit'),false);
});
test('different-owner removal and source-forged edits are rejected safely',async()=>{
 await mock({dbRequest:async(table,opts)=>{
  assert.equal(table,'rpc/momentum_member_remove_target');
  assert.equal(opts.body.p_user,ID);
  return false;
 }},async()=>{
  const res=response();await watchesHandler(req('POST',{action:'remove',id:'33333333-3333-4333-8333-333333333333'}),res);
  assert.equal(res.statusCode,404);
 });
 await mock({session:false},async()=>{
  const res=response();await watchesHandler(req('GET'),res);assert.equal(res.statusCode,401);
 });
 await mock({origin:false},async()=>{
  const res=response();await watchesHandler(req('POST',{action:'add',label:'A',keyword:'포항맛집',target:'2085358113'}),res);
  assert.equal(res.statusCode,403);
 });
});
test('database slot cap is transactional, service-only, and upgrade cannot be client-initiated',()=>{
 const sql=fs.readFileSync('db/member-portal.sql','utf8');
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/if v_used>=v_limit then raise exception 'slot_limit_reached'/);
 assert.match(sql,/momentum_member_accounts/);
 assert.match(sql,/references auth\.users\(id\) on delete cascade/);
 assert.match(sql,/where owner_id=p_user/);
 assert.match(sql,/revoke all on public\.momentum_member_targets from PUBLIC,anon,authenticated/);
 assert.doesNotMatch(fs.readFileSync('api/member-watches.js','utf8'),/update.*slot_limit|upgrade.*plan/);
});
test('member portal is a static responsive page and its JS is browser-valid',()=>{
 const cfg=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 assert.ok(cfg.rewrites.some(x=>x.source==='/platform/'&&x.destination==='/platform/index.html'));
 const html=fs.readFileSync('platform/index.html','utf8');
 const js=fs.readFileSync('platform/portal.js','utf8');
 assert.doesNotThrow(()=>new vm.Script(js));
 for(const id of ['authForm','authPanel','watchForm','watchRows','dashboardMessage','email','password'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/등록만으로 자동 측정이 시작되지는 않습니다/);
 assert.match(js,/\/api\/member-auth/);
});
