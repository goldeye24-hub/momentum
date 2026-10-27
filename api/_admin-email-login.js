'use strict';
/**
 * Optional administrator email OTP using Supabase Auth. This module does not
 * grant admin status to normal members; the email must match the Vercel allowlist.
 * No secret, OTP, or access token is stored in GitHub or the client.
 */
const auth = require('./_member-session');
function allowedEmail(){
  const email=String(process.env.MOMENTUM_ADMIN_EMAIL||'').trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,180}\.[^\s@]+$/.test(email)?email:null;
}
function enabled(){
  return process.env.MOMENTUM_ADMIN_EMAIL_LOGIN_ENABLED==='true' &&
    Boolean(allowedEmail()&&auth.configured());
}
const escapeHtml=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function page({step='send',email='',error=''}={}){
  const verify=step==='verify';
  const body=verify
    ? '<label for="code">이메일 인증번호</label><input id="code" name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" maxlength="8" placeholder="6자리 인증번호">'
    : '<label for="email">관리자 이메일</label><input id="email" name="email" required type="email" maxlength="254" autocomplete="email" placeholder="관리자 이메일 입력">';
  const fields=verify
    ? '<input type="hidden" name="email" value="'+escapeHtml(email)+'"><input type="hidden" name="intent" value="email-verify">'
    : '<input type="hidden" name="intent" value="email-send">';
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>관리자 이메일 로그인 | 모멘텀마케팅</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px system-ui,sans-serif;background:#0f203e;color:#192f4e}.panel{background:white;border-radius:16px;padding:35px;width:min(460px,calc(100% - 30px))}.eyebrow{font-size:11px;font-weight:900;letter-spacing:.08em;color:#0d62d1}h1{font-size:28px;letter-spacing:-.06em}p{font-size:13px;line-height:1.75;color:#62758d}label{font-weight:750;display:block;margin:20px 0 8px}input,button{width:100%;padding:14px;border-radius:8px;font:inherit}input{border:1px solid #cbd8e8}button{border:0;background:#0968e8;color:white;font-weight:800;margin-top:16px;cursor:pointer}.error{color:#b62735}a{color:#0c63d9}</style></head><body><main class="panel"><span class="eyebrow">MOMENTUM / PRIVATE ADMIN</span><h1>'+ (verify?'인증번호 확인':'관리자 이메일 로그인') +'</h1><p>'+ (verify?'이메일로 받은 인증번호를 입력하세요.':'승인된 관리자 이메일로만 인증번호를 발송합니다.') +'</p>'+ (error?'<p class="error" role="alert">'+escapeHtml(error)+'</p>':'') +'<form method="post" action="/admin/login">'+fields+body+'<button type="submit">'+(verify?'관리자 로그인':'인증번호 받기')+'</button></form><p><a href="/admin/">처음으로 돌아가기</a> · <a href="/admin/?mode=password">기존 비밀번호로 로그인</a></p></main></body></html>';
}
async function send(email){
  if(!enabled())return false;
  if(String(email||'').trim().toLowerCase()!==allowedEmail())return false;
  try{
    await auth.authCall('otp',{body:{email:allowedEmail(),create_user:true}});
    return true;
  }catch{return false;}
}
async function verify(email,token){
  if(!enabled()||String(email||'').trim().toLowerCase()!==allowedEmail()||
     !/^\d{6,8}$/.test(String(token||'')))return false;
  try{
    const result=await auth.authCall('verify',{body:{email:allowedEmail(),token:String(token),type:'email'}});
    return Boolean(result?.access_token && result?.user?.id &&
      String(result.user.email||'').toLowerCase()===allowedEmail() &&
      result.user.email_confirmed_at);
  }catch{return false;}
}
module.exports={enabled,page,send,verify,allowedEmail};
