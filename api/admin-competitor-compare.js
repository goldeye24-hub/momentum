'use strict';
const auth=require('./admin-site-builder'),db=require('./_rank-store');
const observer=require('./_place-observe'),model=require('./_place-competitor-model');
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex,nofollow');
 if(!auth.isAuthorized?.(req))return res.status(401).json({error:'관리자 로그인이 필요합니다.'});
 if(req.method!=='GET')return res.status(405).json({error:'GET 조회만 지원합니다.'});
 const q=req.query||{};
 const idA=observer.placeId(q.a),idB=observer.placeId(q.b);
 if(!idA||!idB||idA===idB)return res.status(400).json({error:'서로 다른 업체의 네이버 플레이스 숫자 ID 또는 URL을 입력하세요.'});
 const days=[7,30,90].includes(Number(q.days))?Number(q.days):30;
 if(!db.config())return res.status(503).json({error:'Supabase 순위 데이터베이스 연결 전입니다.',code:'not_configured'});
 try{
  const rows=await db.request('rpc/momentum_compare_places',{
   method:'POST',body:{p_place_a:idA,p_place_b:idB,p_days:days},prefer:'return=representation'
  });
  if(!Array.isArray(rows))throw Error('Invalid store response');
  return res.status(200).json({days,scope:'mobile',...model.summarize(rows,idA,idB)});
 }catch{
  return res.status(502).json({error:'경쟁업체 키워드 비교 데이터를 조회하지 못했습니다. DB 함수를 확인하세요.'});
 }
};