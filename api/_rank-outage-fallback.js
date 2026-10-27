'use strict';
/**
 * Temporary independent measurement lane only when the shared Supabase
 * coordinator is unreachable (network/timeout, never an explicit provider
 * 403/429 or DB HTTP denial). This is deliberately extremely low volume.
 * This guard is per warm worker, NOT distributed and not a replacement for
 * a licensed ranking provider or durable shared rate limiter.
 */
function createOutageLimiter({
 now=()=>Date.now(), windowMs=60*60*1000, maxPerWindow=2,
 minScopeGapMs=5*60*1000, minIpGapMs=60*60*1000,
 providerBlockMs=24*60*60*1000
}={}){
 const scopeLast=new Map(),ipLast=new Map();
 let windowStart=now(),attempts=0,blockedUntil=0;
 function safeWait(ms){return Math.max(1,Math.ceil(ms/1000))}
 function reject(reason,wait){
  return {status:'fallback_rate_limited',rank:null,source:'none',
   degradedMode:true,retryAfterSeconds:safeWait(wait),
   message:reason};
 }
 async function handle({scope,ip,measure}){
  const t=now();
  if(t<blockedUntil)return reject('네이버 요청 제한 이후 보호 대기 중입니다. 자동 측정을 실행하지 않습니다.',blockedUntil-t);
  if(t-windowStart>=windowMs){windowStart=t;attempts=0;ipLast.clear()}
  if(attempts>=maxPerWindow)return reject('안전 모드의 신규 측정 한도(시간당 2회)에 도달했습니다.',windowStart+windowMs-t);
  const lastScope=scopeLast.get(scope);
  if(lastScope!==undefined&&t-lastScope<minScopeGapMs)return reject('네이버 요청을 보호하기 위해 같은 검색 화면 측정을 잠시 제한합니다.',lastScope+minScopeGapMs-t);
  const ipKey=String(ip||'unknown').slice(0,100);
  const lastIp=ipLast.get(ipKey);
  if(lastIp!==undefined&&t-lastIp<minIpGapMs)return reject('안전 모드에서는 1시간에 한 번만 신규 측정할 수 있습니다.',lastIp+minIpGapMs-t);
  attempts++;scopeLast.set(scope,t);ipLast.set(ipKey,t);
  try{
   const result=await measure();
   const upstream=Number(result?.providerHttpStatus||result?.diagnostics?.httpStatus||0);
   if(result?.status==='blocked'&&(upstream===403||upstream===429)){
    const delay=Math.max(providerBlockMs,Math.min(86400000,Number(result.retryAfterSeconds||0)*1000));
    blockedUntil=Math.max(blockedUntil,now()+delay);
    return {...result,degradedMode:true,storageMode:'local_browser_only',
     message:'네이버가 자동 검색을 제한했습니다. 후속 요청을 중단합니다. '+(result.message||'')};
   }
   return {...result,degradedMode:true,storageMode:'local_browser_only',
    message:(result.message||'검색 관측 결과를 확인하세요.')+' · 공유 저장소 장애로 서버 동기화 없이 브라우저에서만 기록됩니다.'};
  }catch(e){
   return {status:'unavailable',rank:null,source:'none',degradedMode:true,
    storageMode:'local_browser_only',message:'안전 모드에서 브라우저 관측에 실패했습니다. 순위를 만들어내지 않습니다.',
    errorType:e?.code==='MODULE_NOT_FOUND'?'browser_package_unavailable':'browser_runtime_or_network'};
  }
 }
 return {handle};
}
const fallbackLimiter=createOutageLimiter();
module.exports={createOutageLimiter,fallbackLimiter};
