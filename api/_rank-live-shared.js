'use strict';
/**
 * Optional Supabase-backed cache + serialized source gate.
 * Without DB configuration the existing in-process beta controller is used.
 * When configured, a DB error fails closed to prevent uncoordinated requests.
 * Requires db/rank-live-cache.sql; never expose service-role credentials.
 */
const crypto=require('node:crypto'),db=require('./_rank-store');
const {fallbackLimiter}=require('./_rank-outage-fallback');
const TTL_MS=30*60*1000;
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
async function sharedMeasure({key,scope,ip,measure,now=()=>Date.now()}){
 if(!db.config()){
  if(process.env.MOMENTUM_RANK_DB_OUTAGE_FALLBACK_ENABLED==='true')return fallbackLimiter.handle({scope,ip,measure});
  return {status:'unavailable',rank:null,source:'none',message:'순위 공유 저장소 설정이 없어 자동 측정을 실행하지 않았습니다.'};
 }
 const cacheKey=hash(key);
 let stage='read-cache',measured=null;
 try{
  const rows=await db.request('rank_live_snapshots',{query:{
   select:'payload,recorded_at,expires_at',cache_key:'eq.'+cacheKey,limit:'1'
  }});
  const saved=rows[0];
  if(saved&&Date.parse(saved.expires_at)>now()&&saved.payload?.source==='browser_observed'&&
   ['ranked','not_in_block','observed'].includes(saved.payload?.status)){
   return {...saved.payload,cached:true,observedAt:saved.payload.observedAt||saved.recorded_at};
  }
  stage='claim-gate';
  const gate=await db.request('rpc/momentum_rank_claim',{
   method:'POST',body:{p_source:scope,p_gap_seconds:60},prefer:'return=representation'
  });
  if(gate?.state!=='allowed'){
   const delay=Number(gate?.retryAfterSeconds)||60;
   return {status:'shared_delayed',rank:null,source:'none',retryAfterSeconds:delay,
    message:gate?.state==='blocked'?'네이버의 요청 제한으로 새 관측을 일시 중단했습니다. 이미 저장된 기록은 계속 열람할 수 있습니다.':
     '현재 다른 측정이 진행 중입니다. '+delay+'초 이후에 저장된 결과를 확인하거나 다시 요청해 주세요.'};
  }
  stage='provider-measure';
  const result=measured=await measure();
  const upstream=Number(result?.providerHttpStatus||result?.diagnostics?.httpStatus||0);
  if(result?.status==='blocked'&&(upstream===429||upstream===403)){
   const seconds=Math.min(86400,Math.max(3600,Number(result.retryAfterSeconds)||0));
   stage='provider-block-save';
   await db.request('rpc/momentum_rank_block',{method:'POST',body:{p_source:scope,p_seconds:seconds},prefer:'return=representation'});
  }
  if(result?.source==='browser_observed'&&['ranked','not_in_block','observed'].includes(result.status)){
   const recordedAt=result.observedAt||new Date(now()).toISOString();
   stage='cache-write';
   await db.request('rank_live_snapshots',{
    method:'POST',query:{on_conflict:'cache_key'},
    body:{cache_key:cacheKey,payload:result,recorded_at:recordedAt,expires_at:new Date(now()+TTL_MS).toISOString()},
    prefer:'resolution=merge-duplicates,return=minimal'
   });
  }
  return result;
 }catch(error){
  // Diagnostic codes are provider-safe; never expose raw PostgREST messages,
  // tokens, connection strings or request payloads.
  const safeStatus=Number(error?.status);
  const safeCode=String(error?.upstreamCode||'').slice(0,12);
  const diagnostics={stage,status:Number.isInteger(safeStatus)&&safeStatus>=400&&safeStatus<=599?safeStatus:null,
   code:/^(?:PGRST\d{3}|[0-9A-Z]{5})$/.test(safeCode)?safeCode:null,
   category:error?.code==='not_configured'?'not_configured':error?.code==='database_error'?'database_http_error':
     error?.name==='AbortError'?'timeout':'connection_error',
   networkCode:(()=>{const code=String(error?.cause?.code||error?.code||'');return /^(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET)$/.test(code)?code:null})()};
  console.warn('[rank-live-shared] protected request failed',JSON.stringify(diagnostics));
  // A result actually observed before an optional cache write failed must not
  // disappear. A provider-denied result must still trip the outer 403/429 circuit.
  if(measured&&(stage==='cache-write'||stage==='provider-block-save')){
   return {...measured,storageMode:'local_browser_only',cacheWriteFailed:true,
    message:(measured.message||'실제 관측 결과')+' · 서버 기록 저장에 실패하여 이 브라우저에만 저장됩니다.'};
  }
  // This is NOT a route around an upstream provider denial or a shared-gate
  // rejection. Permit a single conservative emergency attempt only when the
  // shared cache GET never connected, gated by an explicit operator flag.
  if(stage==='read-cache'&&['connection_error','timeout'].includes(diagnostics.category)&&
    process.env.MOMENTUM_RANK_DB_OUTAGE_FALLBACK_ENABLED==='true'){
   const backup=await fallbackLimiter.handle({scope,ip,measure});
   return {...backup,sharedStorageDiagnostics:diagnostics};
  }
  return {status:'unavailable',rank:null,source:'none',diagnostics,
   message:'순위 측정용 공유 저장소 '+(stage==='read-cache'?'조회':'요청 조정')+' 단계에 오류가 있습니다. 안전을 위해 새 네이버 요청을 실행하지 않았습니다. 오류 유형: '+(diagnostics.networkCode||diagnostics.code||diagnostics.category)+'.'};
 }
}
module.exports={sharedMeasure,hash};
