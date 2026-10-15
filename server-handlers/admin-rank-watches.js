'use strict';
const auth=require('../api/admin-site-builder');
const db=require('../api/_rank-store');
const observer=require('../api/_place-observe');
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
 }catch(err){return res.status(err.code==='not_configured'?503:502).json({error:err.code==='not_configured'?err.message:'순위 기록 DB 접근에 실패했습니다. 설정 및 테이블을 확인하세요.'})}
};
