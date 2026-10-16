'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const db=require('../api/_rank-store'),gate=require('../api/_rank-live-shared');
const cron=require('../api/rank-watch-cron');
const ID='22222222-2222-4222-8222-222222222222';
const target={id:ID,label:'검증 업체',keyword:'부산맛집',place_id:'2085358113',target_name:null,
 scope:'mobile',last_run_at:null};
const secret='test-cron-secret-for-momentum-qa-only';
function response(){return{statusCode:null,body:null,setHeader(){},status(n){this.statusCode=n;return this},json(x){this.body=x;return this}}}
async function runWith(result){
 const prior={configured:db.config,request:db.request,measure:gate.sharedMeasure,
  secret:process.env.CRON_SECRET,enabled:process.env.MOMENTUM_RANK_CRON_ENABLED};
 const calls=[];
 process.env.CRON_SECRET=secret;process.env.MOMENTUM_RANK_CRON_ENABLED='true';
 db.config=()=>({base:'https://test.supabase.co'});
 db.request=async(table,opts={})=>{
  calls.push({table,opts});
  if(table==='rank_watch_targets'&&(!opts.method||opts.method==='GET'))return [target];
  return [];
 };
 gate.sharedMeasure=async()=>result;
 const res=response();
 try{await cron({method:'GET',headers:{authorization:'Bearer '+secret}},res)}
 finally{
  db.config=prior.configured;db.request=prior.request;gate.sharedMeasure=prior.measure;
  for(const name of ['CRON_SECRET','MOMENTUM_RANK_CRON_ENABLED']){
   const previous=name==='CRON_SECRET'?prior.secret:prior.enabled;
   if(previous===undefined)delete process.env[name];else process.env[name]=previous;
  }
 }
 return {res,calls,writes:calls.filter(c=>['POST','PATCH','DELETE'].includes(c.opts.method))};
}
test('cron does not create a new daily observation from a shared cached rank',async()=>{
 const {res,writes}=await runWith({status:'ranked',rank:13,source:'browser_observed',cached:true,
  observedAt:'2026-10-15T09:22:17.344Z'});
 assert.equal(res.statusCode,200);assert.equal(res.body.results[0].status,'cached');
 assert.equal(res.body.results[0].observedAt,'2026-10-15T09:22:17.344Z');
 assert.equal(writes.length,0);
});
test('cron does not record blocked, unavailable or ambiguous results as new snapshots',async()=>{
 for(const state of ['blocked','unavailable','ambiguous']){
  const {res,writes}=await runWith({status:state,rank:null,source:'none'});
  assert.equal(res.statusCode,200);
  assert.equal(res.body.results[0].status,'unavailable');
  assert.equal(writes.length,0);
 }
});
test('cron stores fresh browser-observed rank with source observation time',async()=>{
 const at='2026-10-15T09:22:17.344Z';
 const {res,writes}=await runWith({status:'ranked',rank:9,rankApproximate:true,
  observedCount:83,source:'browser_observed',observedAt:at});
 assert.equal(res.statusCode,200);assert.equal(res.body.results[0].rank,9);
 assert.equal(writes.length,2);
 assert.equal(writes[0].table,'rank_watch_observations');
 assert.equal(writes[0].opts.body.observed_at,at);
 assert.equal(writes[0].opts.body.rank,9);
 assert.equal(writes[1].table,'rank_watch_targets');
 assert.equal(writes[1].opts.body.last_run_at,at);
});
