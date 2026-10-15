'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const db=require('../api/_rank-store');
const shared=require('../api/_rank-live-shared');
const saved={
 status:'ranked',rank:85,observedAt:'2026-10-15T09:22:17.344Z',
 source:'browser_observed',scope:'naver_mobile_place_list'
};
async function isolated(config,request,run){
 const previousConfig=db.config,previousRequest=db.request;
 db.config=config;db.request=request;
 try{await run()}finally{db.config=previousConfig;db.request=previousRequest}
}
test('shared source gate falls back only if no shared store is configured',async()=>{
 await isolated(()=>null,()=>{throw Error('should not request DB')},async()=>{
  let calls=0;
  const result=await shared.sharedMeasure({key:'a',scope:'mobile',measure:()=>{calls++;return Promise.resolve(saved)}});
  assert.equal(result.rank,85);assert.equal(calls,1);
 });
});
test('persistent rank snapshot reuses original observedAt and skips external calls',async()=>{
 await isolated(()=>({base:'https://test.supabase.co',token:'x'}),async(table)=>{
  assert.equal(table,'rank_live_snapshots');
  return [{payload:saved,recorded_at:saved.observedAt,expires_at:'2026-10-15T10:00:00.000Z'}];
 },async()=>{
  const result=await shared.sharedMeasure({key:'a',scope:'mobile',now:()=>Date.parse('2026-10-15T09:30:00Z'),measure:()=>{throw Error('no external read')}});
  assert.equal(result.rank,85);assert.equal(result.cached,true);
  assert.equal(result.observedAt,saved.observedAt);
 });
});
test('atomic shared source gate postpones competing work without retrying',async()=>{
 const seen=[];
 await isolated(()=>({base:'https://test.supabase.co',token:'x'}),async(table)=>{
  seen.push(table);
  if(table==='rank_live_snapshots')return [];
  if(table==='rpc/momentum_rank_claim')return {state:'busy',retryAfterSeconds:41};
  throw Error('unexpected DB call');
 },async()=>{
  const result=await shared.sharedMeasure({key:'a',scope:'mobile',measure:()=>{throw Error('no external read')}});
  assert.equal(result.status,'shared_delayed');assert.equal(result.retryAfterSeconds,41);
  assert.deepEqual(seen,['rank_live_snapshots','rpc/momentum_rank_claim']);
 });
});
test('429 is recorded in shared DB cooldown across workers',async()=>{
 const seen=[];
 await isolated(()=>({base:'https://test.supabase.co',token:'x'}),async(table,opts)=>{
  seen.push(table);
  if(table==='rank_live_snapshots')return [];
  if(table==='rpc/momentum_rank_claim')return {state:'allowed'};
  if(table==='rpc/momentum_rank_block'){assert.equal(opts.body.p_seconds,3600);return {state:'blocked'}}
  throw Error('unexpected DB call');
 },async()=>{
  const result=await shared.sharedMeasure({key:'a',scope:'mobile',measure:async()=>({status:'blocked',providerHttpStatus:429})});
  assert.equal(result.providerHttpStatus,429);
  assert.deepEqual(seen,['rank_live_snapshots','rpc/momentum_rank_claim','rpc/momentum_rank_block']);
 });
});
test('server must fail closed if shared DB is configured but unresponsive',async()=>{
 await isolated(()=>({base:'https://test.supabase.co',token:'x'}),async()=>{throw Error('DB down')},async()=>{
  let calls=0;
  const result=await shared.sharedMeasure({key:'a',scope:'mobile',measure:()=>{calls++;return saved}});
  assert.equal(result.status,'unavailable');assert.equal(calls,0);
 });
});
test('shared cache hash is opaque and does not leak keyword in DB primary key',()=>{
 const key=shared.hash('mobile\n포항맛집\n2085358113');
 assert.match(key,/^[a-f0-9]{64}$/);
 assert.ok(!key.includes('포항'));
});
