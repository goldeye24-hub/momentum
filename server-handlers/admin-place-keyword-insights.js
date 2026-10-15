'use strict';
const auth=require('../api/admin-site-builder'),db=require('../api/_rank-store');
const observer=require('../api/_place-observe'),model=require('../api/_place-keyword-insight-model');
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex,nofollow');
 if(!auth.isAuthorized?.(req))return res.status(401).json({error:'관리자 로그인이 필요합니다.'});
 if(req.method!=='GET')return res.status(405).json({error:'GET 조회만 가능합니다.'});
 const q=req.query||{},id=observer.placeId(q.placeId||q.placeUrl||q.target);
 if(!id)return res.status(400).json({error:'네이버 플레이스 숫자 ID 또는 URL을 입력하세요. 동명이 업체 오류를 막기 위해 이 화면은 업체명 단독 검색을 지원하지 않습니다.'});
 const days=[7,30,90].includes(Number(q.days))?Number(q.days):30;
 if(!db.config())return res.status(503).json({error:'순위 기록 DB가 아직 연결되지 않았습니다.',code:'not_configured'});
 try{
  const rows=await db.request('rpc/momentum_place_keyword_insights',{
   method:'POST',body:{p_place_id:id,p_days:days},prefer:'return=representation'
  });
  if(!Array.isArray(rows))throw Error('Invalid rank insight response');
  return res.status(200).json({days,scope:'mobile',...model.summarize(rows,id)});
 }catch{
  return res.status(502).json({error:'해당 업체의 관측 키워드를 조회하지 못했습니다. 최신 SQL 함수를 확인하세요.'});
 }
};