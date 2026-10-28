'use strict';
/**
 * Admin research console. Reuses the *existing* momentum_admin_session cookie,
 * verified by admin-site-builder.isAuthorized. No second password or member
 * impersonation. Only available via the /admin/research/api rewrite.
 */
const admin=require('./admin-site-builder');
const member=require('./_member-session');
const db=require('./_rank-store');
const place=require('./rank-rebuild');
const searchVolume=require('./_research-volume-core');
const lastCall=new Map();
const fail=(res,status,code,message)=>res.status(status).json({status:code,message});
const kw=value=>{
 const s=String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');
 return s.length>=2&&s.length<=40&&!/[\x00-\x1f<>]/.test(s)?s:null;
};
const label=value=>{
 const s=String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');
 return s.length>=1&&s.length<=70&&!/[\x00-\x1f<>]/.test(s)?s:null;
};
const placeId=value=>/^\d{6,20}$/.test(String(value||''))?String(value):null;
const kst=iso=>new Date(new Date(iso).getTime()+9*3600000).toISOString().slice(0,10);
// When a new research table hasn't been applied yet, reuse the existing
// private administrator rank-watch tables. Never swallow permission errors.
function missingTable(error){
 return error?.code==='database_error'&&error?.status===404&&
   (!error.upstreamCode||['PGRST205','PGRST116'].includes(error.upstreamCode));
}
async function useExistingWatchStore(){
 try{
  await db.request('momentum_research_admin_targets',{query:{select:'id',limit:'1'}});
  return false;
 }catch(e){if(!missingTable(e))throw e;return true}
}
async function targetFor(id){
 if(!db.uuid(id))return null;
 let legacy=false,rows;
 try{
  rows=await db.request('momentum_research_admin_targets',{
   query:{select:'id,label,keyword,place_id,created_at',id:'eq.'+id,limit:'1'}});
 }catch(e){
  if(!missingTable(e))throw e;
  legacy=true;
  rows=await db.request('rank_watch_targets',{query:{
    select:'id,label,keyword,place_id,created_at,scope,active,last_run_at',
    id:'eq.'+id,scope:'eq.mobile',limit:'1'}});
 }
 return rows?.[0]?{...rows[0],_legacy:legacy}:null;
}
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Robots-Tag','noindex,nofollow');
 res.setHeader('X-Content-Type-Options','nosniff');
 // Cryptographically validates existing administrator session.
 const authorized=admin.isAuthorized(req)===true;
 const action=String(req.query?.action||'');
 if(action==='auth'&&req.method==='GET')return res.status(200).json(
  authorized?{authenticated:true,email:'모멘텀 관리자',role:'admin'}:{authenticated:false}
 );
 if(!authorized)return fail(res,401,'admin_login_required','기존 모멘텀 관리자 인증이 필요합니다. /admin/에서 로그인하세요.');
 if(!['GET','POST'].includes(req.method))return fail(res,405,'method_not_allowed','GET 또는 POST만 허용됩니다.');
 if(req.method==='POST'&&!member.validOrigin(req))return fail(res,403,'invalid_origin','요청 출처가 올바르지 않습니다.');
 if(!db.config())return fail(res,503,'database_not_configured','관리자 기록 DB 연결이 필요합니다.');
 const body=req.method==='POST'?
   (typeof req.body==='string'?(()=>{try{return JSON.parse(req.body)}catch{return null}})():req.body||{}):{};
 if(req.method==='POST'&&(!body||typeof body!=='object'||Array.isArray(body)))return fail(res,400,'invalid_body','요청 형식이 올바르지 않습니다.');
 try{
  if(action==='targets'){
   if(req.method==='GET'){
    let rows,legacy=false;
    try{
     rows=await db.request('momentum_research_admin_targets',{query:{
      select:'id,label,keyword,place_id,created_at',order:'created_at.desc',limit:'200'}});
    }catch(e){
     if(!missingTable(e))throw e;
     legacy=true;
     rows=await db.request('rank_watch_targets',{query:{
      select:'id,label,keyword,place_id,created_at,scope,active,last_run_at',
      scope:'eq.mobile',order:'created_at.desc',limit:'20'}});
    }
    const targets=rows.map(t=>({...t,scope:'mobile'}));
    return res.status(200).json({status:'ok',plan:'admin',store:legacy?'existing_admin_rank_watch':'research_admin',
      slotLimit:legacy?20:200,usedSlots:targets.length,targets});
   }
   const mode=String(body.action||'');
   if(mode!=='add')return fail(res,400,'invalid_action','지원하지 않는 대상 관리 요청입니다.');
   const name=label(body.label),keyword=kw(body.keyword),id=placeId(body.target);
   if(!name||!keyword||!id)return fail(res,400,'invalid_target','업체명·키워드·플레이스 숫자 ID를 확인하세요.');
   const legacy=await useExistingWatchStore();
   if(legacy){
    const prior=await db.request('rank_watch_targets',{query:{
      select:'id',keyword:'eq.'+keyword,place_id:'eq.'+id,scope:'eq.mobile',limit:'1'}});
    if(prior.length)return fail(res,409,'duplicate','이미 등록한 키워드·매장 조합입니다.');
    const count=await db.request('rank_watch_targets',{query:{select:'id',limit:'21'}});
    if(count.length>=20)return fail(res,409,'limit_reached','기존 관리자 모니터링은 최대 20개 업체까지 지원합니다.');
   }
   const rows=await db.request(legacy?'rank_watch_targets':'momentum_research_admin_targets',{method:'POST',
    body:legacy?{label:name,keyword,place_id:id,scope:'mobile',active:true}:{label:name,keyword,place_id:id},
    prefer:'return=representation'});
   return res.status(201).json({target:rows?.[0]||null});
  }
  if(action==='rank-history'&&req.method==='GET'){
   const t=await targetFor(String(req.query?.targetId||''));
   if(!t)return fail(res,404,'not_found','등록 매장이 아닙니다.');
   const days=[7,30,90,365].includes(Number(req.query?.days))?Number(req.query.days):30;
   const table=t._legacy?'rank_watch_observations':'momentum_research_admin_rank_checks';
   const rows=await db.request(table,{query:{
    select:t._legacy?'id,rank,rank_approximate,status,observed_count,observed_at':
      'id,keyword,place_id,observed_at,rank,status,observed_count',
    target_id:'eq.'+t.id,observed_at:'gte.'+new Date(Date.now()-days*86400000).toISOString(),
    order:'observed_at.asc',limit:'500'}});
   const transformed=t._legacy?rows.map(x=>({
    ...x,keyword:t.keyword,place_id:t.place_id,
    status:x.status==='ranked'?'found':x.status==='not_in_block'?'not_found_in_sample':'rank_list_unavailable',
    rank:x.status==='ranked'?x.rank:null
   })):rows;
   return res.status(200).json({status:'ok',target:t,rows:transformed,
    note:'실측 기록만 표시합니다. 미발견 또는 수집 실패는 실제 검색 순위 0위를 뜻하지 않습니다.'});
  }
  if(action==='volume-history'&&req.method==='GET'){
   const days=[7,30,90,365].includes(Number(req.query?.days))?Number(req.query.days):90;
   const keyword=String(req.query?.keyword||'').trim();
   const query={
    select:'keyword,measured_date,observed_at,pc_raw,mobile_raw,pc_count,mobile_count,total_count',
    measured_date:'gte.'+kst(new Date(Date.now()-days*86400000).toISOString()),
    order:'measured_date.asc',limit:'500'};
   if(keyword){const k=kw(keyword);if(!k)return fail(res,400,'invalid_keyword','검색어 형식이 잘못됐습니다.');query.keyword='eq.'+k}
   const rows=await db.request('momentum_research_admin_keyword_volumes',{query});
   return res.status(200).json({status:'ok',rows,note:'조회한 날짜의 최근 한 달 검색량이며 해당 날짜의 일별 검색량이 아닙니다.'});
  }
  if(action==='scan-rank'&&req.method==='POST'){
   const t=await targetFor(String(body.targetId||''));
   if(!t)return fail(res,404,'not_found','등록 매장이 아닙니다.');
   if(Date.now()-(lastCall.get('rank')||0)<45000)return fail(res,429,'slow_down','새 순위 조회 간격은 최소 45초입니다.');
   lastCall.set('rank',Date.now());
   const result=await place._scan(t.keyword,{id:t.place_id});
   if(!['found','not_found_in_sample','found_without_rank','rank_list_unavailable'].includes(result.status)){
    return fail(res,502,result.status||'measurement_error','실제 네이버 업체 목록을 확인하지 못해 저장하지 않았습니다.');
   }
   const rank=result.status==='found'&&Number.isInteger(result.observedPosition)?result.observedPosition:null;
   const observedAt=result.observedAt||new Date().toISOString();
   if(t._legacy){
    const last=Date.parse(t.last_run_at||'');
    if(Number.isFinite(last)&&Date.now()-last<10*60*1000){
     return fail(res,429,'slow_down','기존 관리자 모니터링 대상은 10분 간격으로 조회할 수 있습니다.');
    }
    const legacyStatus=result.status==='found'?'ranked':
      result.status==='not_found_in_sample'?'not_in_block':'unavailable';
    await db.request('rank_watch_observations',{method:'POST',body:{
      target_id:t.id,rank,status:legacyStatus,scope:'mobile',
      source:'mobile_place_browser_research',rank_approximate:rank!==null,
      observed_at:observedAt,observed_count:Number(result.observedCount)||0
    },prefer:'return=minimal'});
    await db.request('rank_watch_targets',{method:'PATCH',
      query:{id:'eq.'+t.id},body:{last_run_at:observedAt},prefer:'return=minimal'});
   }else{
    await db.request('momentum_research_admin_rank_checks',{method:'POST',
     body:{target_id:t.id,keyword:t.keyword,place_id:t.place_id,observed_at:observedAt,
      rank,status:result.status,observed_count:Number(result.observedCount)||0},
     prefer:'return=minimal'});
   }
   return res.status(200).json({status:result.status,saved:true,rank,observedAt,
    observedCount:result.observedCount,message:result.explanation||result.message||'관측 기록 저장 완료'});
  }
  if(action==='scan-volume'&&req.method==='POST'){
   const keyword=kw(body.keyword);
   if(!keyword)return fail(res,400,'invalid_keyword','검색어를 확인하세요.');
   if(Date.now()-(lastCall.get('volume')||0)<5000)return fail(res,429,'slow_down','연속 조회 간격은 최소 5초입니다.');
   lastCall.set('volume',Date.now());
   const date=kst(new Date().toISOString());
   const existing=await db.request('momentum_research_admin_keyword_volumes',{query:{
    select:'keyword,measured_date,observed_at,pc_raw,mobile_raw,pc_count,mobile_count,total_count',
    keyword:'eq.'+keyword,measured_date:'eq.'+date,limit:'1'}});
   if(existing?.length)return res.status(200).json({status:'ok',cachedToday:true,row:existing[0],
    note:'오늘 이미 기록된 월간 검색량입니다. 하루 한 번 기록합니다.'});
   const checked=await searchVolume.lookup(keyword);
   if(checked.status!=='ok')return fail(res,checked.status==='not_configured'?503:502,
    checked.status,checked.message||'검색광고 API 오류');
   const row={keyword,measured_date:date,observed_at:checked.observedAt,
    pc_raw:checked.pcRaw,mobile_raw:checked.mobileRaw,
    pc_count:checked.pc,mobile_count:checked.mobile,total_count:checked.total};
   await db.request('momentum_research_admin_keyword_volumes',{method:'POST',body:row,prefer:'return=minimal'});
   return res.status(200).json({status:'ok',saved:true,row,
    note:'오늘 조회한 최근 한 달 검색량이 날짜별로 저장되었습니다.'});
  }
  return fail(res,404,'unknown_action','지원하지 않는 관리자 연구 기능입니다.');
 }catch(e){
  if(e?.status===409)return fail(res,409,'duplicate','이미 등록한 매장 또는 날짜별 기록입니다.');
  return fail(res,503,'storage_unavailable','연구실 DB 테이블 또는 저장 권한을 확인해 주세요.');
 }
};
