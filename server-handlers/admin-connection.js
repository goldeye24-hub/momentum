'use strict';
const admin=require('../api/admin-site-builder');
const db=require('../api/_rank-store');
const member=require('../api/_member-session');
const diagnosis=require('../api/_db-failure');
const tables=[
 'momentum_member_accounts','momentum_member_targets','momentum_member_slot_audit',
 'rank_keyword_snapshots','rank_keyword_entries',
 'rank_live_snapshots','rank_live_source_gate',
 'rank_watch_targets','rank_watch_observations'
];
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Robots-Tag','noindex,nofollow');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!admin.isAuthorized?.(req))
  return res.status(401).json({error:'모멘텀 운영 관리자 로그인이 필요합니다.'});
 if(String(req.method||'GET')!=='GET')
  return res.status(405).json({error:'GET 조회만 지원합니다.'});
 const dbReady=Boolean(db.config()),authReady=Boolean(member.configured());
 if(!dbReady)return res.status(503).json({
  status:'not_configured',database:{configured:false},authentication:{configured:authReady},
  note:'모멘텀 전용 Supabase DB 환경변수가 설정되지 않았습니다.'
 });
 const checks=await Promise.all(tables.map(async name=>{
  try{
   const rows=await db.request(name,{query:{select:'*',limit:1}});
   return {name,status:Array.isArray(rows)?'ok':'unexpected_response'};
  }catch(error){
   return {name,status:'failed',...diagnosis.analyze(error)};
  }
 }));
 let authStatus='not_configured';
 if(authReady){
  try{
   const settings=await member.authCall('settings',{method:'GET'});
   authStatus=settings&&typeof settings==='object'?'ok':'unexpected_response';
  }catch{authStatus='failed'}
 }
 const ok=checks.every(v=>v.status==='ok')&&authStatus==='ok';
 return res.status(ok?200:503).json({
  status:ok?'ok':'degraded',
  observedAt:new Date().toISOString(),
  database:{configured:dbReady,tables:checks,checkedCount:checks.length,
   passedCount:checks.filter(v=>v.status==='ok').length},
  authentication:{configured:authReady,connectivity:authStatus},
  note:'저장된 데이터·계정·비밀키는 노출하지 않습니다. 연결 검사만 수행하며 데이터를 수정하지 않습니다.'
 });
};