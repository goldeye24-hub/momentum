'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createOutageLimiter}=require('../api/_rank-outage-fallback');
const {sharedMeasure}=require('../api/_rank-live-shared');
const db=require('../api/_rank-store');

function measured(rank=7){return {status:'ranked',rank,source:'browser_observed',observedAt:'2026-10-28T02:00:00.000Z'};}
test('fallback permits one actual observation, labels local-only storage and never invents a rank',async()=>{
 let t=1000,calls=0;
 const c=createOutageLimiter({now:()=>t});
 const first=await c.handle({scope:'mobile',ip:'1',measure:async()=>{calls++;return measured()}});
 assert.equal(first.status,'ranked');assert.equal(first.rank,7);
 assert.equal(first.degradedMode,true);assert.equal(first.storageMode,'local_browser_only');
 const limit=await c.handle({scope:'mobile',ip:'1',measure:async()=>{calls++;return measured(8)}});
 assert.equal(limit.status,'fallback_rate_limited');assert.equal(limit.rank,null);assert.equal(calls,1);
 t+=3601000;
 const after=await c.handle({scope:'mobile',ip:'1',measure:async()=>{calls++;return {status:'no_place_block',rank:null,source:'none'}}});
 assert.equal(after.rank,null);assert.equal(after.status,'no_place_block');assert.equal(calls,2);
});
test('shared safety lane limits global hourly requests independently of IP',async()=>{
 let t=1000,calls=0;
 const c=createOutageLimiter({now:()=>t,minScopeGapMs:0});
 for(const ip of ['one','two']){
  const r=await c.handle({scope:'mobile',ip,measure:async()=>{calls++;return measured()}});
  assert.equal(r.status,'ranked');
 }
 const third=await c.handle({scope:'mobile',ip:'three',measure:async()=>{calls++;return measured()}});
 assert.equal(third.status,'fallback_rate_limited');assert.equal(calls,2);
});
test('upstream 403 or 429 opens circuit and never tries a different route',async()=>{
 let t=1000,calls=0;
 const c=createOutageLimiter({now:()=>t,minScopeGapMs:0,maxPerWindow:5});
 const blocked=await c.handle({scope:'mobile',ip:'one',measure:async()=>{calls++;return {status:'blocked',providerHttpStatus:429,rank:null}}});
 assert.equal(blocked.status,'blocked');
 const after=await c.handle({scope:'map',ip:'two',measure:async()=>{calls++;return measured()}});
 assert.equal(after.status,'fallback_rate_limited');assert.equal(calls,1);
 t+=86401000;
 const next=await c.handle({scope:'map',ip:'two',measure:async()=>{calls++;return measured()}});
 assert.equal(next.status,'ranked');
});
test('shared backend outage uses fallback only for cache-read network exception and explicit approval flag',async()=>{
 const saved={config:db.config,request:db.request,flag:process.env.MOMENTUM_RANK_DB_OUTAGE_FALLBACK_ENABLED};
 const network=Object.assign(new Error('fetch failed'),{cause:{code:'ENOTFOUND'}});
 try{
  db.config=()=>({base:'https://example.supabase.co',token:'secret'});
  db.request=async()=>{throw network};
  process.env.MOMENTUM_RANK_DB_OUTAGE_FALLBACK_ENABLED='true';
  let calls=0;
  const r=await sharedMeasure({key:'test\nkeyword\nid',scope:'mobile',ip:'unit-test-network',measure:async()=>{calls++;return measured()}});
  assert.equal(r.status,'ranked');assert.equal(r.rank,7);assert.equal(r.sharedStorageDiagnostics.stage,'read-cache');assert.equal(calls,1);
  process.env.MOMENTUM_RANK_DB_OUTAGE_FALLBACK_ENABLED='false';
  const denied=await sharedMeasure({key:'different',scope:'map',ip:'unit-test-denied',measure:async()=>{calls++;return measured()}});
  assert.equal(denied.status,'unavailable');assert.equal(calls,1);
 }finally{
  db.config=saved.config;db.request=saved.request;
  if(saved.flag===undefined)delete process.env.MOMENTUM_RANK_DB_OUTAGE_FALLBACK_ENABLED;
  else process.env.MOMENTUM_RANK_DB_OUTAGE_FALLBACK_ENABLED=saved.flag;
 }
});
test('DB 401/403 errors never authorize outage fallback',async()=>{
 const saved={config:db.config,request:db.request,flag:process.env.MOMENTUM_RANK_DB_OUTAGE_FALLBACK_ENABLED};
 try{
  db.config=()=>({base:'https://example.supabase.co',token:'secret'});
  db.request=async()=>{throw Object.assign(new Error('permission denied'),{code:'database_error',status:403})};
  process.env.MOMENTUM_RANK_DB_OUTAGE_FALLBACK_ENABLED='true';
  let calls=0;
  const r=await sharedMeasure({key:'permission',scope:'mobile',ip:'unit-permission',measure:async()=>{calls++;return measured()}});
  assert.equal(r.status,'unavailable');assert.equal(r.diagnostics.category,'database_http_error');assert.equal(calls,0);
 }finally{
  db.config=saved.config;db.request=saved.request;
  if(saved.flag===undefined)delete process.env.MOMENTUM_RANK_DB_OUTAGE_FALLBACK_ENABLED;
  else process.env.MOMENTUM_RANK_DB_OUTAGE_FALLBACK_ENABLED=saved.flag;
 }
});
