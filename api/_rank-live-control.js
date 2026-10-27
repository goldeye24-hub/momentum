'use strict';
/**
 * Best-effort protection within one warm Node worker. Cache hits and identical
 * in-flight requests do not generate fresh external traffic or consume quota.
 * This is NOT a distributed rate limit; a licensed data feed or shared durable
 * coordinator is required before selling guaranteed multi-tenant monitoring.
 */
function createController({now=()=>Date.now(),ttlMs=30*60*1000,blockMs=60*60*1000,maxRequests=3,windowMs=10*60*1000}={}){
 const cache=new Map(),active=new Map(),ips=new Map();
 let blockedUntil=0;
 function trim(t){
  if(cache.size>400)for(const [key,entry] of cache)if(t-entry.time>24*60*60*1000)cache.delete(key);
  if(ips.size>1500)for(const [key,entry] of ips)if(t-entry.start>windowMs)ips.delete(key);
 }
 function quota(ip,t){
  const key=String(ip||'unknown').slice(0,100);
  let row=ips.get(key);
  if(!row||t-row.start>=windowMs){row={start:t,used:0};ips.set(key,row)}
  if(row.used>=maxRequests)return Math.ceil((windowMs-(t-row.start))/1000);
  row.used++;return 0;
 }
 function snapshot(entry,{stale=false}={}){
  return {...entry.data,cached:true,stale,observedAt:entry.data.observedAt||new Date(entry.time).toISOString(),
   ...(stale?{message:'새로운 측정이 제한되어 이전 관측 결과를 표시합니다. '+(entry.data.message||'' )}:{})};
 }
 async function handle({key,ip,measure}){
  const t=now();trim(t);
  const prior=cache.get(key);
  if(prior&&t-prior.time<ttlMs)return {code:200,data:snapshot(prior)};
  if(t<blockedUntil){
   const retryAfterSeconds=Math.ceil((blockedUntil-t)/1000);
   if(prior)return {code:200,data:{...snapshot(prior,{stale:true}),retryAfterSeconds}};
   return {code:503,data:{status:'source_rate_limited',rank:null,retryAfterSeconds,message:'네이버가 자동 요청을 제한했습니다. 추가 조회를 중단하고 제한 해제를 기다립니다.'}};
  }
  if(active.has(key)){
   const response=await active.get(key);
   return response.code===200&&response.data?.status!=='source_rate_limited'
    ?{code:200,data:{...response.data,cached:true}}:response;
  }
  const wait=quota(ip,t);
  if(wait>0)return {code:429,data:{status:'rate_limited',rank:null,retryAfterSeconds:wait,message:'현재 10분당 신규 측정은 최대 '+maxRequests+'회입니다. 저장된 결과 재조회는 차감되지 않습니다.'}};
  const pending=(async()=>{
   try{
    const data=await measure();
    const providerCode=Number(data?.providerHttpStatus||data?.diagnostics?.httpStatus||0);
    if(data?.status==='blocked'&&(providerCode===429||providerCode===403)){
     const seconds=providerCode===429?Math.max(blockMs/1000,Number(data.retryAfterSeconds)||0):blockMs/1000;
     blockedUntil=Math.max(blockedUntil,now()+Math.min(seconds,86400)*1000);
     const previous=cache.get(key);
     if(previous)return {code:200,data:{...snapshot(previous,{stale:true}),retryAfterSeconds:Math.ceil((blockedUntil-now())/1000)}};
     return {code:503,data:{status:'source_rate_limited',rank:null,retryAfterSeconds:Math.ceil((blockedUntil-now())/1000),message:'네이버가 추가 검색 요청을 제한했습니다(HTTP '+providerCode+'). 자동 재시도는 하지 않습니다.'}};
    }
    if(data?.status==='shared_delayed')return {code:503,data};
    if(data?.status==='fallback_rate_limited')return {code:429,data};
    if(data?.status==='unavailable')return {code:503,data};
    // A shared DB cache result should be returned without extending its real TTL.
    if(!data?.cached&&(data?.status==='ranked'||data?.status==='not_in_block')&&data?.source==='browser_observed'){
     cache.set(key,{time:now(),data});trim(now());
    }
    return {code:200,data};
   }catch(error){
    return {code:200,data:{status:'unavailable',rank:null,message:'순위 관측 작업을 완료하지 못했습니다. 기존 순위를 임의로 갱신하지 않습니다.',
     errorType:error?.code==='MODULE_NOT_FOUND'?'browser_package_unavailable':'browser_runtime_or_network',source:'none'}};
   }
  })();
  active.set(key,pending);
  try{return await pending}finally{if(active.get(key)===pending)active.delete(key)}
 }
 return {handle};
}
module.exports={createController,controller:createController()};
