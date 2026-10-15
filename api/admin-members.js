'use strict';
const admin=require('./admin-site-builder'),db=require('./_rank-store');
function origin(req){try{const o=new URL(String(req.headers?.origin||''));return o.protocol==='https:'&&o.host===req.headers?.host}catch{return false}}
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Robots-Tag','noindex,nofollow');
 if(!admin.isAuthorized?.(req))return res.status(401).json({error:'운영 관리자 로그인이 필요합니다.'});
 if(!db.config())return res.status(503).json({error:'회원 DB 연결 설정이 필요합니다.'});
 const method=String(req.method||'GET').toUpperCase();
 if(!['GET','POST'].includes(method))return res.status(405).json({error:'GET과 POST만 가능합니다.'});
 try{
  if(method==='GET'){
   const rows=await db.request('rpc/momentum_admin_member_summary',{
    method:'POST',body:{},prefer:'return=representation'
   });
   if(!Array.isArray(rows))throw Error('invalid member summary');
   return res.status(200).json({accounts:rows,
    notice:'내부 시험 운영용 회원·슬롯 현황입니다. 결제 확인이나 구독 상태로 사용하지 마세요.'});
  }
  if(!origin(req))return res.status(403).json({error:'허용되지 않은 요청 출처입니다.'});
  let data=req.body;
  if(typeof data==='string'){if(data.length>1000)return res.status(413).json({error:'요청이 너무 깁니다.'});
   try{data=JSON.parse(data)}catch{return res.status(400).json({error:'JSON 형식을 확인하세요.'})}}
  if(!data||typeof data!=='object'||Array.isArray(data)||data.action!=='set_pilot_slots')
   return res.status(400).json({error:'지원하지 않는 변경 요청입니다.'});
  const limit=Number(data.limit),reason=String(data.reason||'').trim();
  if(!db.uuid(data.userId)||!Number.isInteger(limit)||limit<1||limit>200||reason.length<5||reason.length>200)
   return res.status(400).json({error:'회원 ID, 슬롯 수(1~200), 변경 사유(5~200자)를 확인하세요.'});
  const changed=await db.request('rpc/momentum_admin_set_pilot_slots',{method:'POST',
   body:{p_user:data.userId,p_limit:limit,p_reason:reason},
   prefer:'return=representation'
  });
  return res.status(200).json({changed,notice:'내부 시험용 슬롯 배정만 변경했습니다. 유료 결제·요금제는 변경하지 않았습니다.'});
 }catch{
  return res.status(502).json({error:'회원 DB 조회 또는 시험용 슬롯 변경에 실패했습니다. 사용 중인 슬롯보다 낮출 수 없습니다.'});
 }
};