'use strict';
const member=require('./_member-session'),db=require('./_rank-store');
const header=res=>{res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex,nofollow')};
const clean=v=>String(v??'').trim();
module.exports=async function(req,res){
 header(res);
 const method=String(req.method||'GET').toUpperCase();
 if(!['GET','POST'].includes(method))return res.status(405).json({error:'GET 또는 POST만 허용합니다.'});
 const cfg=member.configured();
 if(!cfg)return res.status(503).json({error:'회원 인증 서버가 아직 연결되지 않았습니다.',code:'not_configured'});
 if(method==='GET'){
  const session=member.check(req);
  if(!session)return res.status(200).json({authenticated:false});
  try{
   const accounts=await db.request('momentum_member_accounts',{query:{select:'user_id,email,plan,slot_limit',user_id:'eq.'+session.userId,limit:'1'}});
   if(!accounts?.[0]){res.setHeader('Set-Cookie',member.expired());return res.status(200).json({authenticated:false})}
   const a=accounts[0];
   return res.status(200).json({authenticated:true,email:a.email,plan:a.plan,slotLimit:a.slot_limit});
  }catch{return res.status(503).json({error:'회원 DB 연결 상태를 확인할 수 없습니다.'})}
 }
 if(!member.validOrigin(req))return res.status(403).json({error:'요청 출처가 올바르지 않습니다.'});
 let data=req.body;
 if(typeof data==='string'){if(data.length>1500)return res.status(413).json({error:'요청이 너무 깁니다.'});
  try{data=JSON.parse(data)}catch{return res.status(400).json({error:'JSON 형식 오류'})}}
 if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({error:'요청 형식을 확인하세요.'});
 const action=clean(data.action);
 if(action==='logout'){res.setHeader('Set-Cookie',member.expired());return res.status(200).json({authenticated:false})}
 if(!['signup','login'].includes(action))return res.status(400).json({error:'지원하지 않는 로그인 동작입니다.'});
 const email=clean(data.email).toLowerCase(),password=data.password;
 if(email.length>254||email.length<5||!/^.+@[^@\s]+\.[^@\s]+$/.test(email)||typeof password!=='string'||password.length<10||password.length>128)
  return res.status(400).json({error:'올바른 이메일과 10자 이상의 비밀번호를 입력하세요.'});
 try{
  if(action==='signup'){
   await member.authCall('signup',{body:{email,password}});
   return res.status(200).json({message:'계정 생성 요청을 접수했습니다. 가입 안내 이메일을 확인한 후 로그인하세요.'});
  }
  const response=await member.authCall('token?grant_type=password',{body:{email,password}});
  const user=response?.user;
  if(!response?.access_token||!user||!db.uuid(user.id)||!user.email||!user.email_confirmed_at){
   return res.status(403).json({error:'이메일 인증을 완료한 계정으로 로그인해 주세요.'});
  }
  const account=await db.request('rpc/momentum_member_ensure',{
   method:'POST',body:{p_user:user.id,p_email:user.email},prefer:'return=representation'
  });
  if(!account||account.userId!==user.id)return res.status(503).json({error:'회원 데이터베이스 연결이 완료되지 않았습니다.'});
  const token=member.sign({userId:user.id,email:user.email});
  if(!token)return res.status(503).json({error:'세션 암호화 설정을 확인하세요.'});
  res.setHeader('Set-Cookie',member.cookie(token));
  return res.status(200).json({authenticated:true,email:account.email,plan:account.plan,slotLimit:account.slotLimit});
 }catch(error){
  if(error?.code==='auth_rejected')return res.status(401).json({error:'계정 정보 또는 이메일 인증 상태를 확인하세요.'});
  return res.status(503).json({error:'로그인 서비스 연결을 확인할 수 없습니다. 계정과 DB 설정을 확인해 주세요.'});
 }
};