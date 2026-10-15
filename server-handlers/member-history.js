'use strict';
const member=require('../api/_member-session'),db=require('../api/_rank-store');
const model=require('../api/_member-history-model');
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Robots-Tag','noindex,nofollow');
 const session=member.check(req);
 if(!session)return res.status(401).json({error:'회원 로그인이 필요합니다.'});
 if(String(req.method||'GET').toUpperCase()!=='GET')
  return res.status(405).json({error:'읽기 전용 조회만 가능합니다.'});
 if(!member.configured())return res.status(503).json({error:'회원 데이터베이스가 연결되지 않았습니다.'});
 const q=req.query||{},targetId=String(q.targetId||'');
 const days=[7,30,90].includes(Number(q.days))?Number(q.days):30;
 if(!db.uuid(targetId))return res.status(400).json({error:'등록된 추적 대상 ID를 선택하세요.'});
 try{
  // Ownership is checked before querying history; SQL independently enforces it.
  const rows=await db.request('momentum_member_targets',{query:{
   select:'id,label,keyword,place_id,scope',id:'eq.'+targetId,
   owner_id:'eq.'+session.userId,limit:'1'
  }});
  const target=rows?.[0];
  if(!target)return res.status(404).json({error:'본인 계정에 등록된 추적 대상을 찾지 못했습니다.'});
  if(!target.place_id||target.scope!=='mobile')return res.status(422).json({
   code:'requires_place_id',error:'정확한 순위 이력을 보려면 숫자 플레이스 ID로 등록한 모바일 추적 대상이 필요합니다.'
  });
  const history=await db.request('rpc/momentum_member_daily_history',{
   method:'POST',body:{p_user:session.userId,p_target:targetId,p_days:days},
   prefer:'return=representation'
  });
  if(!Array.isArray(history))throw Error('Invalid history response');
  return res.status(200).json({target:{id:target.id,label:target.label,keyword:target.keyword,
   placeId:target.place_id,scope:'mobile'},...model.summarize(history,days)});
 }catch{
  return res.status(502).json({error:'이력 데이터를 조회하지 못했습니다. 최신 Supabase SQL 연결을 확인하세요.'});
 }
};
