'use strict';
/**
 * Optional Supabase-backed cache + serialized source gate.
 * Without DB configuration the existing in-process beta controller is used.
 * When configured, a DB error fails closed to prevent uncoordinated requests.
 * Requires db/rank-live-cache.sql; never expose service-role credentials.
 */
const crypto=require('node:crypto'),db=require('./_rank-store');
const TTL_MS=30*60*1000;
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
async function sharedMeasure({key,scope,measure,now=()=>Date.now()}){
 if(!db.config())return measure();
 const cacheKey=hash(key);
 try{
  const rows=await db.request('rank_live_snapshots',{query:{
   select:'payload,recorded_at,expires_at',cache_key:'eq.'+cacheKey,limit:'1'
  }});
  const saved=rows[0];
  if(saved&&Date.parse(saved.expires_at)>now()&&saved.payload?.source==='browser_observed'&&
   ['ranked','not_in_block','observed'].includes(saved.payload?.status)){
   return {...saved.payload,cached:true,observedAt:saved.payload.observedAt||saved.recorded_at};
  }
  const gate=await db.request('rpc/momentum_rank_claim',{
   method:'POST',body:{p_source:scope,p_gap_seconds:60},prefer:'return=representation'
  });
  if(gate?.state!=='allowed'){
   const delay=Number(gate?.retryAfterSeconds)||60;
   return {status:'shared_delayed',rank:null,source:'none',retryAfterSeconds:delay,
    message:gate?.state==='blocked'?'네이버의 요청 제한으로 새 관측을 일시 중단했습니다. 이미 저장된 기록은 계속 열람할 수 있습니다.':
     '현재 다른 측정이 진행 중입니다. '+delay+'초 이후에 저장된 결과를 확인하거나 다시 요청해 주세요.'};
  }
  const result=await measure();
  const upstream=Number(result?.providerHttpStatus||result?.diagnostics?.httpStatus||0);
  if(result?.status==='blocked'&&(upstream===429||upstream===403)){
   const seconds=Math.min(86400,Math.max(3600,Number(result.retryAfterSeconds)||0));
   await db.request('rpc/momentum_rank_block',{method:'POST',body:{p_source:scope,p_seconds:seconds},prefer:'return=representation'});
  }
  if(result?.source==='browser_observed'&&['ranked','not_in_block','observed'].includes(result.status)){
   const recordedAt=result.observedAt||new Date(now()).toISOString();
   await db.request('rank_live_snapshots',{
    method:'POST',query:{on_conflict:'cache_key'},
    body:{cache_key:cacheKey,payload:result,recorded_at:recordedAt,expires_at:new Date(now()+TTL_MS).toISOString()},
    prefer:'resolution=merge-duplicates,return=minimal'
   });
  }
  return result;
 }catch{
  return {status:'unavailable',rank:null,source:'none',
   message:'공유 순위 저장소 또는 요청 제한 관리가 작동하지 않습니다. 안전을 위해 새 측정을 실행하지 않았습니다.'};
 }
}
module.exports={sharedMeasure,hash};
