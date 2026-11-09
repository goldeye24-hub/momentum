'use strict';
/**
 * Supabase Auth transport for the allowlisted Momentum ADMIN email OTP only.
 * This is not public registration or a customer/member session.
 * Retain the old env name as a fallback during admin credential migration.
 */
const db=require('./_rank-store');
function configured(){
 const config=db.config();
 const anon=process.env.MOMENTUM_ADMIN_AUTH_ANON_KEY||process.env.MOMENTUM_MEMBER_ANON_KEY||'';
 if(!config||anon.length<30)return null;
 return {base:config.base,anon};
}
async function authCall(path,{body,method='POST'}={}){
 if(!['otp','verify','settings'].includes(path))throw Error('unsupported_admin_auth_operation');
 const cfg=configured();
 if(!cfg)throw Object.assign(new Error('admin_auth_config_missing'),{code:'not_configured'});
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8500);
 try{
  const rsp=await fetch(cfg.base+'/auth/v1/'+path,{
   method,signal:ctl.signal,
   headers:{apikey:cfg.anon,...(cfg.anon.startsWith('sb_publishable_')?{}:{Authorization:'Bearer '+cfg.anon}),
    'Content-Type':'application/json',Accept:'application/json'},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  let result={};try{result=await rsp.json()}catch{}
  if(!rsp.ok)throw Object.assign(new Error('Supabase admin email auth error'),{code:'auth_rejected',status:rsp.status});
  return result;
 }finally{clearTimeout(timer)}
}
module.exports={configured,authCall};
