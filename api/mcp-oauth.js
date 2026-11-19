'use strict';
const admin=require('./_admin-session');
const c=require('./_mcp-oauth-core');
function noCache(res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('X-Content-Type-Options','nosniff')}
function parseBody(req){
 if(req.body&&typeof req.body==='object'&&!Array.isArray(req.body))return req.body;
 if(typeof req.body==='string'&&req.body.length<16000)return Object.fromEntries(new URLSearchParams(req.body));
 return {};
}
function html(res,status,body){
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
 return res.status(status).end('<!doctype html><html lang="ko"><meta charset="utf-8"><title>모멘텀마케팅 ChatGPT 연결</title><body style="max-width:580px;margin:4rem auto;font:16px/1.7 sans-serif;padding:1rem">'+body+'</body></html>');
}
async function authorize(req,res){
 if(!admin.isAuthorized(req)){
  return html(res,401,'<h1>관리자 확인 필요</h1><p>먼저 모멘텀마케팅 관리자 화면에서 로그인하세요. 로그인 후 이 탭으로 돌아와 새로고침하면 연결을 계속할 수 있습니다.</p><p><a href="/admin/" target="_blank" rel="noopener">관리자 로그인 열기</a></p>');
 }
 if(req.method==='GET'){
  const q=req.query||{},id=String(q.client_id||''),redirect=String(q.redirect_uri||'');
  const challenge=String(q.code_challenge||''),state=String(q.state||'');
  if(q.response_type!=='code'||q.code_challenge_method!=='S256'||!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)||state.length>2048||
     (q.scope&&q.scope!==c.SCOPE)||!(await c.verifyClientRedirect(id,redirect)))
   return html(res,400,'<h1>연결 요청을 확인할 수 없습니다</h1><p>ChatGPT에서 연결을 다시 시작해 주세요.</p>');
  const grant=c.sign('consent',{client_id:id,redirect_uri:redirect,challenge,state,scope:c.SCOPE,exp:c.now()+300});
  return html(res,200,'<h1>모멘텀마케팅 키워드 조회 연결</h1><p>ChatGPT에 네이버 월간 PC·모바일 검색량을 <b>읽는 권한만</b> 허용합니다. 관리자 기능, 설정 변경, 키 발급 권한은 제공하지 않습니다.</p><form action="/admin/mcp-authorize" method="post"><input type="hidden" name="grant" value="'+grant+'"><button style="padding:12px 24px">검색량 읽기 허용</button></form>');
 }
 if(req.method!=='POST')return c.error(res,405,'invalid_request','Unsupported method');
 const body=parseBody(req);
 let grant;try{grant=c.verify('consent',body.grant)}catch{return c.error(res,503,'server_error','Admin OAuth unavailable')}
 if(!grant||!(await c.verifyClientRedirect(grant.client_id,grant.redirect_uri)))return c.error(res,400,'invalid_grant','Invalid or expired request');
 const code=c.sign('code',{client_id:grant.client_id,redirect_uri:grant.redirect_uri,challenge:grant.challenge,scope:c.SCOPE,jti:require('node:crypto').randomBytes(18).toString('base64url'),exp:c.now()+120});
 const u=new URL(grant.redirect_uri);u.searchParams.set('code',code);if(grant.state)u.searchParams.set('state',grant.state);
 res.setHeader('Location',u.toString());return res.status(302).end();
}
function token(req,res){
 if(req.method!=='POST')return c.error(res,405,'invalid_request','POST required');
 const b=parseBody(req);
 if(!c.validClient(b.client_id))return c.error(res,400,'invalid_client','Unsupported client');
 if(b.grant_type==='authorization_code'){
  let code;try{code=c.verify('code',b.code)}catch{return c.error(res,503,'server_error','OAuth unavailable')}
  if(!code||code.client_id!==b.client_id||code.redirect_uri!==b.redirect_uri||!code.jti)return c.error(res,400,'invalid_grant','Invalid or expired code');
  const verifier=String(b.code_verifier||'');
  if(!/^[A-Za-z0-9~._-]{43,128}$/.test(verifier)||!c.hash(verifier).match(/^[A-Za-z0-9_-]+$/)||!admin.safeCompare(c.hash(verifier),code.challenge))
   return c.error(res,400,'invalid_grant','PKCE verification failed');
  const digest=c.hash(b.code);
  if(c.usedCodes.has(digest))return c.error(res,400,'invalid_grant','Authorization code already used');
  c.usedCodes.set(digest,c.now()+120);
  if(c.usedCodes.size>4000)for(const [k,v] of c.usedCodes)if(v<c.now())c.usedCodes.delete(k);
  return res.status(200).json(c.issueAccess(b.client_id));
 }
 if(b.grant_type==='refresh_token'){
  let rt;try{rt=c.verify('refresh',b.refresh_token)}catch{return c.error(res,503,'server_error','OAuth unavailable')}
  if(!rt||rt.client_id!==b.client_id||rt.aud!==c.RESOURCE||rt.scope!==c.SCOPE)return c.error(res,400,'invalid_grant','Invalid refresh token');
  return res.status(200).json(c.issueAccess(b.client_id));
 }
 return c.error(res,400,'unsupported_grant_type','Only authorization_code and refresh_token are supported');
}
module.exports=async function(req,res){
 noCache(res);
 const mode=String(req.query?.action||'');
 if(mode==='server-metadata')return res.status(200).json({
  issuer:c.ORIGIN,authorization_endpoint:c.ORIGIN+'/admin/mcp-authorize',token_endpoint:c.ORIGIN+'/api/mcp-token',
  response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],
  token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],
  scopes_supported:[c.SCOPE],client_id_metadata_document_supported:true
 });
 if(mode==='resource-metadata')return res.status(200).json({
  resource:c.RESOURCE,authorization_servers:[c.ORIGIN],scopes_supported:[c.SCOPE],bearer_methods_supported:['header']
 });
 try{if(mode==='authorize')return await authorize(req,res);if(mode==='token')return token(req,res)}
 catch(e){return c.error(res,503,'server_error','OAuth service temporarily unavailable')}
 return c.error(res,404,'not_found','Unknown OAuth endpoint');
};