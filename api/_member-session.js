'use strict';
const crypto=require('node:crypto');
const db=require('./_rank-store');
const COOKIE='momentum_member_session',LIFETIME_MS=12*60*60*1000;
const encode=value=>Buffer.from(value).toString('base64url');
const secret=()=>{const s=process.env.MOMENTUM_MEMBER_SESSION_SECRET||'';return s.length>=32?s:null};
function configured(){
 const dbConfig=db.config(),anon=process.env.MOMENTUM_MEMBER_ANON_KEY||'';
 if(!dbConfig||anon.length<30||!secret())return null;
 return {base:dbConfig.base,anon};
}
function sign(data,now=Date.now()){
 const key=secret();
 if(!key||!db.uuid(data?.userId)||typeof data.email!=='string'||data.email.length>254)return null;
 const payload=encode(JSON.stringify({v:1,userId:data.userId,email:data.email,
  exp:now+LIFETIME_MS,nonce:crypto.randomBytes(8).toString('hex')}));
 const mac=crypto.createHmac('sha256',key).update(payload).digest('base64url');
 return payload+'.'+mac;
}
function check(req,now=Date.now()){
 const key=secret();if(!key)return null;
 const cookies=String(req?.headers?.cookie||'').split(';');
 const pair=cookies.map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
 if(!pair)return null;
 let value;try{value=decodeURIComponent(pair.slice(COOKIE.length+1))}catch{return null}
 if(value.length>2000)return null;
 const bits=value.split('.');if(bits.length!==2||bits[0].length>1400||!bits[0])return null;
 // Compare canonical text, not decoded bytes: changing an unused Base64URL
 // padding bit must still invalidate the cookie's serialized signature.
 if(!/^[A-Za-z0-9_-]{43}$/.test(bits[1]))return null;
 const expected=Buffer.from(crypto.createHmac('sha256',key).update(bits[0]).digest('base64url'),'ascii');
 const actual=Buffer.from(bits[1],'ascii');
 if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))return null;
 try{
  const v=JSON.parse(Buffer.from(bits[0],'base64url').toString('utf8'));
  if(v.v!==1||!db.uuid(v.userId)||typeof v.email!=='string'||v.email.length>254||
    !Number.isInteger(v.exp)||v.exp<now||v.exp>now+LIFETIME_MS)return null;
  return {userId:v.userId,email:v.email};
 }catch{return null}
}
function validOrigin(req){
 try{const o=new URL(String(req.headers?.origin||''));return o.protocol==='https:'&&o.host===req.headers?.host}
 catch{return false}
}
function cookie(token){return COOKIE+'='+encodeURIComponent(token)+'; Path=/; Max-Age='+Math.floor(LIFETIME_MS/1000)+'; HttpOnly; Secure; SameSite=Lax'}
function expired(){return COOKIE+'=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'}
async function authCall(path,{body,method='POST'}={}){
 const cfg=configured();if(!cfg)throw Object.assign(new Error('member_config_missing'),{code:'not_configured'});
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8500);
 try{
  const rsp=await fetch(cfg.base+'/auth/v1/'+path,{
   method,signal:ctl.signal,
   headers:{apikey:cfg.anon,Authorization:'Bearer '+cfg.anon,'Content-Type':'application/json',
    Accept:'application/json'},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  let result={};try{result=await rsp.json()}catch{}
  if(!rsp.ok)throw Object.assign(new Error('Supabase member auth error'),{code:'auth_rejected',status:rsp.status});
  return result;
 }finally{clearTimeout(timer)}
}
module.exports={configured,sign,check,validOrigin,cookie,expired,authCall,COOKIE,LIFETIME_MS};
