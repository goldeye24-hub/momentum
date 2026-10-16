'use strict';
const auth=require('../api/admin-site-builder');
const db=require('../api/_rank-store');
const observer=require('../api/_place-observe');
const sourceGate=require('../api/_rank-live-shared');
const diagnosis=require('../api/_db-failure');
const clean=(v,max=90)=>String(v??'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex');
 if(!auth.isAuthorized?.(req))return res.status(401).json({error:'관리자 로그인이 필요합니다.'});
 const method=String(req.method||'GET').toUpperCase();
 if(method==='POST'){
  try{const origin=new URL(req.headers?.origin||'');if(origin.protocol!=='https:'||origin.host!==req.headers.host)return res.status(403).json({error:'요청 출처 오류'})}
  catch{return res.status(403).json({error:'허용되지 않은 요청입니다.'})}
 }
 if(!db.config())return res.status(503).json({error:'순위 기록 DB 연결 전입니다. 환경변수 MOMENTUM_RANK_DB_URL / MOMENTUM_RANK_DB_SERVICE_KEY 및 DB 테이블이 필요합니다.',code:'not_configured'});
 try{
  if(method==='GET'){
   const [watch,history]=await Promise.all([
    db.request('rank_watch_targets',{query:{select:'id,label,keyword,place_id,target_name,scope,active,last_run_at,created_at',order:'created_at.desc',limit:'50'}}),
    db.request('rank_watch_observations',{query:{select:'target_id,rank,rank_approximate,status,observed_count,observed_at',order:'observed_at.desc',limit:'100'}})
   ]);
   return res.status(200).json({targets:watch,observations:history});
  }
  if(method!=='POST')return res.status(405).json({error:'GET / POST만 가능합니다.'});
  let data=req.body;
  if(typeof data==='string'){if(data.length>2000)return res.status(413).json({error:'입력 크기 초과'});data=JSON.parse(data)}
  if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({error:'입력을 확인해 주세요.'});
  const action=clean(data.action,15);
  if(action==='measure'){
   if(!db.uuid(data.id))return res.status(400).json({error:'측정 대상 ID를 확인하세요.'});
   const found=await db.request('rank_watch_targets',{query:{
    select:'id,label,keyword,place_id,target_name,scope,active,last_run_at',
    id:'eq.'+data.id,limit:'1'
   }});
   const row=found?.[0];
   if(!row)return res.status(404).json({error:'등록된 측정 대상이 없습니다.'});
   if(!row.active)return res.status(409).json({error:'일시 중지된 대상입니다. 추적을 재개한 후 측정하세요.'});
   const last=Date.parse(row.last_run_at||'');
   if(Number.isFinite(last)&&Date.now()-last<10*60*1000){
    return res.status(429).json({status:'cooldown',error:'동일 대상은 10분 이내 중복 측정할 수 없습니다. 이전 결과를 확인하세요.'});
   }
   const target=row.place_id||observer.normalizeBusinessName(row.target_name);
   const key=row.scope+'\n'+row.keyword+'\n'+target;
   const result=await sourceGate.sharedMeasure({key,scope:row.scope,measure:()=>row.scope==='mobile'?
     observer.runMobile(row.keyword,{id:row.place_id||null,name:row.target_name||null}):
     row.scope==='map'?observer.runMap(row.keyword,row.place_id):
     observer.run(row.keyword,row.place_id)});
   if(result.status==='shared_delayed'||result.status==='blocked'){
    return res.status(503).json({status:result.status,retryAfterSeconds:result.retryAfterSeconds||60,
     error:result.message||'네이버 요청 제한이나 다른 측정으로 새 관측을 진행하지 않았습니다.'});
   }
   const allowed=['ranked','not_in_block','no_place_block','unavailable'];
   const status=allowed.includes(result.status)?result.status:'unavailable';
   const observedAt=new Date().toISOString();
   await db.request('rank_watch_observations',{method:'POST',
    body:{target_id:row.id,rank:status==='ranked'?result.rank:null,
     rank_approximate:result.rankApproximate===true,status,
     observed_count:Number(result.observedCount)||0,source:result.source||'none',
     scope:row.scope,observed_at:observedAt},prefer:'return=minimal'});
   await db.request('rank_watch_targets',{method:'PATCH',
    query:{id:'eq.'+row.id},body:{last_run_at:observedAt},prefer:'return=minimal'});
   return res.status(200).json({status,rank:status==='ranked'?result.rank:null,
    rankApproximate:result.rankApproximate===true,observedAt,
    message:status==='ranked'?'실제 관측된 모바일 또는 PC 순위를 기록했습니다.':
    '관측을 시도했지만 순위가 확인되지 않았습니다. 순위 밖으로 단정하지 않습니다.'});
  }
  if(action==='create'){
   const keyword=observer.validateKeyword(data.keyword),label=clean(data.label,70);
   const scope=data.scope==='integrated'?'integrated':data.scope==='map'?'map':'mobile';
   const rawTarget=data.placeUrl||data.placeId||data.targetName||'';
   const place=observer.placeId(rawTarget);
   const name=scope==='mobile'&&!place?observer.mobileTarget(rawTarget)?.name||null:null;
   if(!keyword||!label||(!place&&!name))return res.status(400).json({error:'업체명 또는 플레이스 ID/주소와 검색어를 확인해 주세요. PC 조회에는 플레이스 ID가 필요합니다.'});
   const existing=await db.request('rank_watch_targets',{query:{select:'id',limit:'30'}});
   if(existing.length>=20)return res.status(409).json({error:'현재 시험 운영은 최대 20개 대상만 등록할 수 있습니다.'});
   const duplicates=await db.request('rank_watch_targets',{query:{select:'id',keyword:'eq.'+keyword,...(place?{place_id:'eq.'+place}:{target_name:'eq.'+name}),scope:'eq.'+scope,limit:'1'}});
   if(duplicates.length)return res.status(409).json({error:'이미 등록된 키워드·플레이스 조합입니다.'});
   const data=await db.request('rank_watch_targets',{method:'POST',body:{keyword,place_id:place||null,target_name:name,scope,label,active:true},prefer:'return=representation'});
   return res.status(201).json({target:data[0]||null});
  }
  if(action==='pause'||action==='resume'||action==='delete'){
   if(!db.uuid(data.id))return res.status(400).json({error:'대상 ID 형식이 올바르지 않습니다.'});
   const id='eq.'+data.id;
   if(action==='delete'){await db.request('rank_watch_targets',{method:'DELETE',query:{id}});return res.status(200).json({deleted:true})}
   await db.request('rank_watch_targets',{method:'PATCH',query:{id},body:{active:action==='resume'}});
   return res.status(200).json({updated:true});
  }
  return res.status(400).json({error:'알 수 없는 관리 명령입니다.'});
 }catch(err){return res.status(err.code==='not_configured'?503:502).json({error:diagnosis.message(err),diagnostic:diagnosis.analyze(err)})}
};
