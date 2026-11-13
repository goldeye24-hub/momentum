'use strict';
// Read-only MCP OAuth primitives. No NAVER credentials or editorial access token leave this server.
const crypto=require('node:crypto');
const admin=require('./_admin-session');
const ORIGIN='https://momentum-orcin-delta.vercel.app';
const RESOURCE=ORIGIN+'/api/mcp';
const SCOPE='keywords:read';
const usedCodes=new Map(); // Best-effort replay defense; durable cross-instance storage required before production.
const b64=value=>Buffer.from(value).toString('base64url');
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('base64url');
const now=()=>Math.floor(Date.now()/1000);
function key(){
 const a=admin.ready();
 if(!a)throw Error('ADMIN_AUTH_NOT_CONFIGURED');
 return crypto.createHmac('sha256',a.secret).update('momentum:mcp-oauth:v1').digest();
}
function safe(a,b){
 const x=Buffer.from(String(a)),y=Buffer.from(String(b));
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
function sign(kind,obj){
 const payload=b64(JSON.stringify(Object.assign({},obj,{type:kind})));
 const mac=crypto.createHmac('sha256',key()).update(kind+'.'+payload).digest('base64url');
 return payload+'.'+mac;
}
function verify(kind,value){
 if(typeof value!=='string'||value.length>12000)return null;
 const p=value.split('.');
 if(p.length!==2||!p[0]||!p[1])return null;
 const expected=crypto.createHmac('sha256',key()).update(kind+'.'+p[0]).digest('base64url');
 if(!safe(expected,p[1]))return null;
 let o;try{o=JSON.parse(Buffer.from(p[0],'base64url').toString('utf8'))}catch{return null}
 if(!o||o.type!==kind||!Number.isInteger(o.exp)||o.exp<=now())return null;
 return o;
}
function validClient(id){
 if(typeof id!=='string'||id.length>1000)return false;
 let u;try{u=new URL(id)}catch{return false}
 return u.protocol==='https:'&&u.hostname==='chatgpt.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname.endsWith('.json');
}
async function verifyClientRedirect(clientId,redirectUri){
 if(!validClient(clientId)||typeof redirectUri!=='string'||redirectUri.length>1500)return false;
 let u;try{u=new URL(redirectUri)}catch{return false}
 if(u.protocol!=='https:'||u.hostname!=='chatgpt.com'||u.username||u.password||u.hash)return false;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),4500);
 try{
  const response=await fetch(clientId,{headers:{Accept:'application/json'},redirect:'error',signal:controller.signal});
  if(!response.ok)return false;
  const j=await response.json();
  return Array.isArray(j.redirect_uris)&&j.redirect_uris.includes(redirectUri);
 }catch{return false}finally{clearTimeout(timer)}
}
function accessFromRequest(req){
 const header=String(req.headers.authorization||'');
 const match=header.match(/^Bearer ([A-Za-z0-9_.-]{20,12000})$/);
 if(!match)return null;
 let payload;try{payload=verify('access',match[1])}catch{return null}
 if(!payload||payload.aud!==RESOURCE||payload.scope!==SCOPE||!validClient(payload.client_id))return null;
 return payload;
}
function challenge(res){
 res.setHeader('WWW-Authenticate','Bearer resource_metadata="'+ORIGIN+'/.well-known/oauth-protected-resource", scope="'+SCOPE+'"');
 return res.status(401).json({error:'unauthorized',message:'OAuth authorization required'});
}
function error(res,status,code,description){
 return res.status(status).json({error:code,error_description:description});
}
function issueAccess(clientId){
 const issued=now();
 return {access_token:sign('access',{client_id:clientId,aud:RESOURCE,scope:SCOPE,exp:issued+3600}),token_type:'Bearer',expires_in:3600,scope:SCOPE,
  refresh_token:sign('refresh',{client_id:clientId,aud:RESOURCE,scope:SCOPE,exp:issued+30*86400})};
}
module.exports={ORIGIN,RESOURCE,SCOPE,now,hash,sign,verify,validClient,verifyClientRedirect,accessFromRequest,challenge,error,issueAccess,usedCodes};