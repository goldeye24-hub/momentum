'use strict';
const db=require('./_rank-store'),observer=require('./_place-observe');
const sourceGate=require('./_rank-live-shared');
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'GET만 지원합니다.'});
 const secret=process.env.CRON_SECRET||'',provided=String(req.headers?.authorization||'');
 if(secret.length<24||provided!=='Bearer '+secret)return res.status(401).json({error:'인증되지 않은 예약 작업입니다.'});
 if(process.env.MOMENTUM_RANK_CRON_ENABLED!=='true'||!db.config())return res.status(503).json({status:'disabled',message:'순위 DB와 스케줄 실행 설정이 완료되지 않았습니다.'});
 try{
  const all=await db.request('rank_watch_targets',{query:{select:'id,label,keyword,place_id,target_name,scope,last_run_at',active:'eq.true',order:'last_run_at.asc.nullsfirst',limit:'20'}});
  const day=new Date().toISOString().slice(0,10);
  const due=all.filter(x=>!x.last_run_at||!String(x.last_run_at).startsWith(day)).slice(0,1); // Pilot: a single source-gated measurement per invocation
  const out=[];
  for(const item of due){
   let result;
   try{
    const target=item.place_id||observer.normalizeBusinessName(item.target_name);
    const key=item.scope+'\n'+item.keyword+'\n'+target;
    result=await sourceGate.sharedMeasure({key,scope:item.scope,measure:()=>item.scope==='mobile'?
     observer.runMobile(item.keyword,{id:item.place_id||null,name:item.target_name||null}):item.scope==='map'?
      observer.runMap(item.keyword,item.place_id):observer.run(item.keyword,item.place_id)});
   }
   catch{result={status:'unavailable',rank:null,source:'none',observedCount:0}}
   if(result.status==='shared_delayed'){
    out.push({id:item.id,status:'deferred',retryAfterSeconds:result.retryAfterSeconds});
    continue; // Do not mark as checked: the next invocation may retry after the gate opens.
   }
   if(result.cached===true){
    out.push({id:item.id,status:'cached',rank:result.status==='ranked'?result.rank:null,
     observedAt:result.observedAt||null});
    continue; // A shared snapshot is not a new observation.
   }
   const observed=['ranked','not_in_block','no_place_block'];
   if(result.source!=='browser_observed'||!observed.includes(result.status)){
    out.push({id:item.id,status:'unavailable',rank:null});
    continue; // Failed or ambiguous reads must not overwrite the real rank history.
   }
   const status=result.status;
   const at=Number.isFinite(Date.parse(result.observedAt||''))?result.observedAt:new Date().toISOString();
   await db.request('rank_watch_observations',{method:'POST',body:{target_id:item.id,rank:status==='ranked'?result.rank:null,rank_approximate:result.rankApproximate===true,status,observed_count:result.observedCount||0,source:result.source||'none',scope:item.scope,observed_at:at},prefer:'return=minimal'});
   await db.request('rank_watch_targets',{method:'PATCH',query:{id:'eq.'+item.id},body:{last_run_at:at},prefer:'return=minimal'});
   out.push({id:item.id,status,rank:status==='ranked'?result.rank:null});
  }
  return res.status(200).json({status:'completed',checked:out.length,results:out,remaining:all.length-due.length,note:'파일럿 실행은 호출당 최대 1개를 시도하며 공유 요청 간격 및 네이버 제한을 존중합니다. 자동 일간 측정 보장은 아닙니다.'});
 }catch(err){return res.status(502).json({status:'error',message:'예약 측정 저장 또는 조회에 실패했습니다.'})}
};
