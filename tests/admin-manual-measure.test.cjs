'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const auth=require('../api/admin-site-builder'),db=require('../api/_rank-store'),gate=require('../api/_rank-live-shared');
const handle=require('../server-handlers/admin-rank-watches');
const ID='11111111-1111-4111-8111-111111111111';
function reply(){return{code:null,body:null,setHeader(){},status(n){this.code=n;return this},json(x){this.body=x;return this}}}
function request(){return{method:'POST',headers:{origin:'https://momentum.example',host:'momentum.example'},
 body:{action:'measure',id:ID}}}
const base={id:ID,label:'테스트 업체',keyword:'부산미용실',place_id:'2085358113',target_name:null,scope:'mobile',active:true,last_run_at:null};
async function mocked(opts,fn){
 const orig={authorized:auth.isAuthorized,configured:db.config,request:db.request,measure:gate.sharedMeasure};
 auth.isAuthorized=()=>opts.authorized!==false;
 db.config=()=>opts.configured!==false?{base:'https://test.supabase.co'}:null;
 db.request=opts.request||(async()=>[]);
 gate.sharedMeasure=opts.measure||(async()=>({status:'ranked',rank:11,rankApproximate:false,observedCount:90,source:'browser_observed'}));
 try{await fn()}finally{auth.isAuthorized=orig.authorized;db.config=orig.configured;db.request=orig.request;gate.sharedMeasure=orig.measure}
}
test('admin manual measure requires authenticated admin and registered target',async()=>{
 await mocked({authorized:false},async()=>{const r=reply();await handle(request(),r);assert.equal(r.code,401)});
 await mocked({request:async()=>[]},async()=>{const r=reply();await handle(request(),r);assert.equal(r.code,404)});
});
test('manual observation writes only actual measured rank and source, then updates last-run',async()=>{
 const calls=[];let measurement=null;
 await mocked({
  request:async(table,opts)=>{calls.push({table,opts});
   return table==='rank_watch_targets'&&opts?.method!== 'PATCH'?[base]:[]},
  measure:async opts=>{measurement=opts;return {status:'ranked',rank:11,
   rankApproximate:true,observedCount:90,source:'browser_observed',observedAt:'2026-10-15T09:22:17.344Z'}}
 },async()=>{const r=reply();await handle(request(),r);assert.equal(r.code,200);assert.equal(r.body.rank,11)});
 assert.equal(calls.length,3);
 assert.equal(calls[0].table,'rank_watch_targets');
 assert.equal(calls[1].table,'rank_watch_observations');
 assert.equal(calls[1].opts.body.rank,11);
 assert.equal(calls[1].opts.body.rank_approximate,true);
 assert.equal(calls[1].opts.body.source,'browser_observed');
 assert.equal(calls[1].opts.body.observed_at,'2026-10-15T09:22:17.344Z');
 assert.equal(calls[2].opts.method,'PATCH');
 assert.equal(measurement.scope,'mobile');
 assert.equal(measurement.key,'mobile\n부산미용실\n2085358113');
});
test('cached rank reuses the original observation without new DB history or last-run update',async()=>{
 let writes=0;
 await mocked({
  request:async(table,opts)=>{if(opts?.method==='POST'||opts?.method==='PATCH')writes++;
   return table==='rank_watch_targets'?[base]:[]},
  measure:async()=>({status:'ranked',rank:11,rankApproximate:true,observedCount:90,
   source:'browser_observed',cached:true,observedAt:'2026-10-15T09:22:17.344Z'})
 },async()=>{
  const r=reply();await handle(request(),r);
  assert.equal(r.code,200);assert.equal(r.body.cached,true);
  assert.equal(r.body.rank,11);assert.equal(r.body.observedAt,'2026-10-15T09:22:17.344Z');
 });
 assert.equal(writes,0);
});
test('failed or ambiguous source results are not stored as real rank observations',async()=>{
 for(const result of [
  {status:'unavailable',source:'none',message:'공유 DB 오류'},
  {status:'ambiguous',source:'browser_observed',message:'동명 업체'}
 ]){
  let writes=0;
  await mocked({
   request:async(table,opts)=>{if(opts?.method==='POST'||opts?.method==='PATCH')writes++;
    return table==='rank_watch_targets'?[base]:[]},
   measure:async()=>result
  },async()=>{
   const r=reply();await handle(request(),r);
   assert.equal(r.code,503);assert.equal(r.body.rank,null);
  });
  assert.equal(writes,0);
 }
});
test('manual observation respects pause and per-target cooldown without calling provider',async()=>{
 let called=0;
 for(const row of [{...base,active:false},{...base,last_run_at:new Date().toISOString()}]){
  await mocked({request:async()=>[row],measure:async()=>{called++;throw Error('should not call provider')}},
  async()=>{const r=reply();await handle(request(),r);assert.ok([409,429].includes(r.code))});
 }
 assert.equal(called,0);
});
test('429 provider delay cannot be recorded as successful observation',async()=>{
 let writes=0;
 await mocked({
  request:async(table,opts)=>{if(opts?.method==='POST'||opts?.method==='PATCH')writes++;return [base]},
  measure:async()=>({status:'shared_delayed',retryAfterSeconds:60,message:'rate gate'})
 },async()=>{const r=reply();await handle(request(),r);assert.equal(r.code,503);assert.equal(r.body.status,'shared_delayed')});
 assert.equal(writes,0);
});
test('admin UI exposes actionable manual measurement and does not promise automatic scheduling',()=>{
 const js=fs.readFileSync('site-builder/rank-watch.js','utf8');
 const html=fs.readFileSync('site-builder/rank-watch-index.html','utf8');
 assert.match(js,/data-action="measure"/);
 assert.match(js,/action==='measure'/);
 assert.match(html,/CRON_SECRET/);
});
