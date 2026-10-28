'use strict';
/** Private research console API, never accepts client-submitted rank/volume values. */
const researchAdmin=require('./_research-admin');
const member=require('./_member-session');
const db=require('./_rank-store');
const observer=require('./rank-rebuild');
const volume=require('./_research-volume-core');
const memberAuth=require('../server-handlers/member-auth');
const memberWatches=require('../server-handlers/member-watches');
const recent=new Map();
const safeKeyword=s=>{const k=String(s||'').normalize('NFKC').trim().replace(/\s+/g,' ');
 return k.length>=2&&k.length<=40&&!/[\x00-\x1f<>]/.test(k)?k:null};
const dateKST=iso=>new Date(new Date(iso).getTime()+9*60*60*1000).toISOString().slice(0,10);
const fail=(res,n,status,message)=>res.status(n).json({status,message});
const number=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
async function owned(req,targetId){
 if(!db.uuid(targetId))return null;
 const session=member.check(req);if(!session)return null;
 const rows=await db.request('momentum_member_targets',{query:{
  select:'id,label,keyword,place_id,target_name,scope,owner_id',
  id:'eq.'+targetId,owner_id:'eq.'+session.userId,limit:'1'}});
 return rows?.[0]||null;
}
module.exports=async function(req,res){
 // Admin mode always verifies the existing signed admin cookie server-side.
 if(req.query?.mode==='admin')return researchAdmin(req,res);
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Robots-Tag','noindex,nofollow');
 if(process.env.VERCEL_ENV==='production')return fail(res,404,'not_available','연구용으로만 제공됩니다.');
 const action=String(req.query?.action||'');
 if(action==='auth')return memberAuth(req,res);
 if(action==='targets')return memberWatches(req,res);
 if(!['GET','POST'].includes(req.method))return fail(res,405,'method_not_allowed','지원하지 않는 요청 방식입니다.');
 const session=member.check(req);
 if(!session)return fail(res,401,'sign_in_required','로그인 후 회원별 기록을 사용할 수 있습니다.');
 if(!member.configured())return fail(res,503,'storage_not_configured','회원 DB 및 인증 환경 설정이 완료되지 않았습니다.');
 if(req.method==='POST'&&!member.validOrigin(req))return fail(res,403,'invalid_origin','요청 출처가 올바르지 않습니다.');
 const body=req.method==='POST'?(typeof req.body==='string'?(()=>{try{return JSON.parse(req.body)}catch{return null}})():req.body):{};
 if(req.method==='POST'&&(!body||typeof body!=='object'||Array.isArray(body)))return fail(res,400,'invalid_body','요청 형식을 확인하세요.');
 try{
  if(action==='rank-history'&&req.method==='GET'){
   const t=await owned(req,String(req.query.targetId||''));
   if(!t)return fail(res,404,'not_found','해당 계정에 등록된 매장이 아닙니다.');
   const days=[7,30,90,365].includes(Number(req.query.days))?Number(req.query.days):30;
   const since=new Date(Date.now()-days*86400000).toISOString();
   const rows=await db.request('momentum_research_rank_checks',{query:{
    select:'id,keyword,place_id,observed_at,rank,status,observed_count,rank_basis',
    owner_id:'eq.'+session.userId,target_id:'eq.'+t.id,
    observed_at:'gte.'+since,order:'observed_at.asc',limit:'500'
   }});
   return res.status(200).json({status:'ok',target:{id:t.id,label:t.label,keyword:t.keyword,placeId:t.place_id},rows,
    note:'수집한 실제 관측값만 표시합니다. 미측정 날짜는 빈칸이며 순위 미발견은 0위가 아닙니다.'});
  }
  if(action==='volume-history'&&req.method==='GET'){
   const days=[7,30,90,365].includes(Number(req.query.days))?Number(req.query.days):90;
   const key=String(req.query.keyword||'').trim();
   const since=dateKST(new Date(Date.now()-days*86400000).toISOString());
   const q={
    select:'keyword,measured_date,observed_at,pc_raw,mobile_raw,pc_count,mobile_count,total_count',
    owner_id:'eq.'+session.userId,measured_date:'gte.'+since,order:'measured_date.asc',limit:'500'};
   if(key){const k=safeKeyword(key);if(!k)return fail(res,400,'invalid_keyword','조회할 검색어를 확인하세요.');q.keyword='eq.'+k}
   const rows=await db.request('momentum_research_keyword_volumes',{query:q});
   return res.status(200).json({status:'ok',rows,
    note:'각 날짜에 조회한 최근 한 달 검색량이며, 해당 날짜 하루의 검색 건수가 아닙니다.'});
  }
  if(action==='scan-rank'&&req.method==='POST'){
   const t=await owned(req,String(body.targetId||''));
   if(!t||!t.place_id||t.scope!=='mobile')return fail(res,404,'not_found','본인 계정에 등록된 숫자 플레이스 ID가 필요합니다.');
   const rateKey='rank:'+session.userId;
   if(Date.now()-(recent.get(rateKey)||0)<45000)return fail(res,429,'slow_down','새 순위 조회 간격은 최소 45초입니다.');
   recent.set(rateKey,Date.now());
   const result=await observer._scan(t.keyword,{id:t.place_id});
   const allowed=['found','not_found_in_sample','found_without_rank','rank_list_unavailable'];
   if(!allowed.includes(result.status)){
    return res.status(502).json({status:result.status||'error',saved:false,
      message:result.message||'네이버 목록 수집에 실패해 기록을 남기지 않았습니다.'});
   }
   const observedAt=result.observedAt||new Date().toISOString();
   const rank=result.status==='found'&&Number.isInteger(result.observedPosition)?
     result.observedPosition:null;
   await db.request('momentum_research_rank_checks',{method:'POST',body:{
    owner_id:session.userId,target_id:t.id,keyword:t.keyword,place_id:t.place_id,
    observed_at:observedAt,rank,status:result.status,
    observed_count:Number(result.observedCount)||0
   },prefer:'return=minimal'});
   return res.status(200).json({status:result.status,saved:true,
    observedAt,rank,observedCount:result.observedCount,
    message:result.explanation||result.message||'측정값을 기록했습니다.',
    note:'광고 제외 공식 순위가 아니라 실제 모바일 수집 목록의 관측 위치입니다.'});
  }
  if(action==='scan-volume'&&req.method==='POST'){
   const k=safeKeyword(body.keyword);
   if(!k)return fail(res,400,'invalid_keyword','검색어를 2~40자로 입력하세요.');
   const rateKey='volume:'+session.userId;
   if(Date.now()-(recent.get(rateKey)||0)<5000)return fail(res,429,'slow_down','연속 조회 간격은 최소 5초입니다.');
   recent.set(rateKey,Date.now());
   const today=dateKST(new Date().toISOString());
   const existing=await db.request('momentum_research_keyword_volumes',{query:{
    select:'keyword,measured_date,observed_at,pc_raw,mobile_raw,pc_count,mobile_count,total_count',
    owner_id:'eq.'+session.userId,keyword:'eq.'+k,measured_date:'eq.'+today,limit:'1'
   }});
   if(existing?.length)return res.status(200).json({status:'ok',cachedToday:true,row:existing[0],
    note:'오늘 이미 조회된 월간 검색량 기록입니다. 하루에 한 건을 저장합니다.'});
   const measure=await volume.lookup(k);
   if(measure.status!=='ok')return res.status(measure.status==='not_configured'?503:502).json({
    status:measure.status,saved:false,message:measure.message});
   const row={
    owner_id:session.userId,keyword:k,measured_date:today,observed_at:measure.observedAt,
    pc_raw:measure.pcRaw,mobile_raw:measure.mobileRaw,pc_count:measure.pc,
    mobile_count:measure.mobile,total_count:measure.total
   };
   await db.request('momentum_research_keyword_volumes',{method:'POST',body:row,
    prefer:'return=minimal'});
   return res.status(200).json({status:'ok',saved:true,row,
    note:'이 날짜에 조회한 최근 한 달 검색량입니다. 해당 일자의 검색 횟수가 아닙니다.'});
  }
  return fail(res,404,'unknown_action','지원하지 않는 기능입니다.');
 }catch(error){
  const dbIssue=error?.code==='database_error';
  return fail(res,503,dbIssue?'storage_error':'service_unavailable',
    dbIssue?'연구실 기록 테이블이 아직 연결되지 않았거나 저장 권한이 없습니다.':
      '연구실 데이터 조회 또는 저장이 완료되지 않았습니다.');
 }
};
