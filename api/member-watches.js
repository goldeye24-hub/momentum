'use strict';
const member=require('./_member-session'),db=require('./_rank-store'),observer=require('./_place-observe');
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Robots-Tag','noindex,nofollow');
 const session=member.check(req);
 if(!session)return res.status(401).json({error:'회원 로그인이 필요합니다.'});
 if(!member.configured())return res.status(503).json({error:'회원 데이터베이스 연결이 필요합니다.'});
 const method=String(req.method||'GET').toUpperCase();
 if(!['GET','POST'].includes(method))return res.status(405).json({error:'GET과 POST만 가능합니다.'});
 try{
  if(method==='GET'){
   const [accounts,targets]=await Promise.all([
    db.request('momentum_member_accounts',{query:{
     select:'user_id,email,plan,slot_limit',user_id:'eq.'+session.userId,limit:'1'
    }}),
    db.request('rpc/momentum_member_overview',{
     method:'POST',body:{p_user:session.userId},prefer:'return=representation'
    })
   ]);
   if(!accounts?.[0])return res.status(401).json({error:'활성 회원 정보가 없습니다. 다시 로그인해 주세요.'});
   return res.status(200).json({plan:accounts[0].plan,slotLimit:accounts[0].slot_limit,
    usedSlots:targets.length,targets,
    disclaimer:'등록은 측정 요청이 아닙니다. 최신 기록은 실제로 저장된 모바일 목록 데이터에서만 표시하며, 비어 있는 값은 순위 밖을 뜻하지 않습니다.'});
  }
  if(!member.validOrigin(req))return res.status(403).json({error:'요청 출처가 올바르지 않습니다.'});
  let data=req.body;
  if(typeof data==='string'){if(data.length>1600)return res.status(413).json({error:'요청이 너무 깁니다.'});
   try{data=JSON.parse(data)}catch{return res.status(400).json({error:'잘못된 JSON입니다.'})}}
  if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({error:'요청 형식이 올바르지 않습니다.'});
  if(data.action==='remove'){
   if(!db.uuid(data.id))return res.status(400).json({error:'잘못된 관리 대상입니다.'});
   const removed=await db.request('rpc/momentum_member_remove_target',{
    method:'POST',body:{p_user:session.userId,p_target:data.id},prefer:'return=representation'
   });
   if(removed!==true)return res.status(404).json({error:'본인 계정에 해당 대상이 없습니다.'});
   return res.status(200).json({removed:true});
  }
  if(data.action!=='add')return res.status(400).json({error:'지원하지 않는 명령입니다.'});
  const label=String(data.label||'').trim().slice(0,70);
  const keyword=observer.validateKeyword(data.keyword);
  const target=observer.mobileTarget(data.target);
  if(!label||!keyword||!target)return res.status(400).json({error:'업체 표시명, 검색 키워드, 업체명 또는 플레이스 ID를 확인하세요.'});
  const added=await db.request('rpc/momentum_member_add_target',{method:'POST',
   body:{p_user:session.userId,p_label:label,p_keyword:keyword,p_place_id:target.id||null,
    p_target_name:target.id?null:target.name,p_scope:'mobile'},
   prefer:'return=representation'
  });
  return res.status(201).json({target:added,
   note:target.id?'플레이스 ID와 모바일 관측 기록이 일치할 때만 순위를 표시합니다.':'동명이 업체가 있을 수 있습니다. 정확한 추적을 위해 플레이스 ID 사용을 권장합니다.'});
 }catch(error){
  if(error?.reason==='slot_limit_reached')return res.status(409).json({error:'현재 요금제의 등록 슬롯을 모두 사용했습니다. 기존 항목을 삭제한 후 등록할 수 있습니다.'});
  if(error?.status===409||error?.status===23505)return res.status(409).json({error:'같은 키워드와 업체가 이미 등록되어 있습니다.'});
  return res.status(502).json({error:'회원 대상 저장소 오류입니다. 서버 DB 설정 및 테이블을 확인해 주세요.'});
 }
};