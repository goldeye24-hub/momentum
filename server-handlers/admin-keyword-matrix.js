'use strict';
/** Admin-only mobile keyword snapshots; no public scraping API or paid promises. */
const auth=require('../api/admin-site-builder');
const db=require('../api/_rank-store');
const observer=require('../api/_place-observe');
const {sharedMeasure}=require('../api/_rank-live-shared');
const model=require('../api/_rank-keyword-model');
const validDays=x=>[7,30,90].includes(Number(x))?Number(x):7;
function validOrigin(req){
 try{const value=new URL(String(req.headers?.origin||''));return value.protocol==='https:'&&value.host===req.headers?.host}
 catch{return false}
}
async function readHistory(keyword,days){
 const selected=await db.request('rpc/momentum_keyword_latest_days',{
  method:'POST',body:{p_keyword:keyword,p_days:days},prefer:'return=representation'
 });
 if(!Array.isArray(selected))throw Error('Unexpected rank history shape');
 const groups=[];
 // Standard Supabase PostgREST installations cap one response at 1000 rows.
 for(let i=0;i<selected.length;i+=8)groups.push(selected.slice(i,i+8));
 const batches=await Promise.all(groups.map(batch=>db.request('rank_keyword_entries',{query:{
  select:'snapshot_id,place_id,place_name,rank,rank_approximate,rank_basis',
  snapshot_id:'in.('+batch.map(x=>x.id).join(',')+')',limit:'800'
 }})));
 return model.summarize(selected,batches.flat(),{days});
}
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(!auth.isAuthorized?.(req))return res.status(401).json({error:'관리자 로그인이 필요합니다.'});
 const method=String(req.method||'GET').toUpperCase();
 if(!['GET','POST'].includes(method))return res.status(405).json({error:'GET과 POST만 지원합니다.'});
 if(method==='POST'&&!validOrigin(req))return res.status(403).json({error:'허용되지 않은 요청 출처입니다.'});
 if(!db.config())return res.status(503).json({error:'순위 서버 DB 설정이 필요합니다.',code:'not_configured'});
 let payload=method==='GET'?req.query:req.body;
 if(typeof payload==='string'){if(payload.length>600)return res.status(413).json({error:'너무 긴 요청입니다.'});
  try{payload=JSON.parse(payload)}catch{return res.status(400).json({error:'잘못된 JSON입니다.'})}}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))payload={};
 const keyword=observer.validateKeyword(payload.keyword);
 const days=validDays(payload.days);
 if(!keyword)return res.status(400).json({error:'2~60자 검색 키워드를 입력하세요.'});
 try{
  if(method==='GET'){
   const data=await readHistory(keyword,days);
   return res.status(200).json({keyword,scope:'mobile',...data});
  }
  // Separate admin-triggered list collection; use the very same central gate
  // and 429 circuit breaker used by ordinary rank checks.
  const result=await sharedMeasure({
   key:'mobile\n'+keyword+'\nlist',
   scope:'mobile',
   measure:()=>observer.runMobileList(keyword)
  });
  if(result.status==='shared_delayed')return res.status(503).json({
   status:'deferred',retryAfterSeconds:result.retryAfterSeconds,message:result.message
  });
  if(result.status==='blocked')return res.status(503).json({
   status:'blocked',retryAfterSeconds:result.retryAfterSeconds||3600,
   message:result.message||'네이버에서 요청을 제한했습니다.'
  });
  if(result.status!=='observed'||result.source!=='browser_observed'||!Array.isArray(result.entries)||!result.entries.length){
   return res.status(503).json({status:'unavailable',
    message:result.message||'모바일 목록을 관측하지 못했습니다. 임의 순위는 기록하지 않습니다.'});
  }
  const saved=await db.request('rpc/momentum_save_keyword_snapshot',{method:'POST',
   body:{p_keyword:keyword,p_observed_at:result.observedAt,p_entries:result.entries},
   prefer:'return=representation'});
  return res.status(200).json({status:'saved',keyword,snapshotId:saved,
   observedAt:result.observedAt,observedCount:result.observedCount,
   maxObservedRank:result.maxObservedRank,cached:result.cached===true,
   message:'관측된 모바일 플레이스 목록만 저장했습니다. 광고 제외 자연검색 순위가 아닙니다.'});
 }catch{
  return res.status(502).json({status:'error',message:'순위 DB 조회나 관측 기록 저장에 실패했습니다. 기존 기록은 유지합니다.'});
 }
};
