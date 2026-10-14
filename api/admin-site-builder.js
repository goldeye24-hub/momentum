'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');

const ASSETS=new Set(['index.html','editor.css','editor.js','kit.js','presets.json','site-template.css','crm-index.html','crm.css','crm.js','products.json']);
const COOKIE='momentum_admin_session';
const SIX_HOURS=6*60*60;
const MAX_FORM=4096;
const HEADERS={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
function ready(){
 const pass=process.env.MOMENTUM_ADMIN_PASSWORD||'';
 const secret=process.env.MOMENTUM_SESSION_SECRET||'';
 return pass.length>=16&&secret.length>=32?{pass,secret}:null;
}
function safeCompare(a,b){const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function signature(payload,secret){return crypto.createHmac('sha256',secret).update(payload).digest('hex')}
function makeCookie(secret){
 const payload=String(Math.floor(Date.now()/1000));
 const token=payload+'.'+signature(payload,secret);
 return COOKIE+'='+encodeURIComponent(token)+'; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age='+SIX_HOURS;
}
function loggedIn(req,secret){
 const cookies=String(req.headers.cookie||'').split(';').map(x=>x.trim());
 const cookie=cookies.find(x=>x.startsWith(COOKIE+'='));
 if(!cookie)return false;
 let token;try{token=decodeURIComponent(cookie.slice(COOKIE.length+1))}catch{return false}
 const parts=token.split('.');if(parts.length!==2||!/^\d{9,12}$/.test(parts[0]))return false;
 const timestamp=Number(parts[0]),now=Math.floor(Date.now()/1000);
 if(timestamp>now+60||now-timestamp>SIX_HOURS)return false;
 return safeCompare(parts[1],signature(parts[0],secret));
}
function pageError(res,status,message){
 res.statusCode=status;res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="robots" content="noindex"><title>관리자 접근 안내</title><body style="font-family:system-ui;padding:48px;max-width:550px;margin:auto"><h1>'+message+'</h1><p>모멘텀마케팅 관리자 전용 페이지입니다.</p><p><a href="/">고객 사이트로 돌아가기</a></p></body></html>');
}
const LOGIN=String.raw`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>관리자 로그인 | 모멘텀마케팅</title><style>body{min-height:100vh;display:grid;place-items:center;margin:0;background:#111b29;font-family:system-ui,sans-serif;color:#fff}.panel{max-width:440px;width:calc(100% - 40px);background:#fff;color:#1c2737;border-radius:16px;padding:40px;box-sizing:border-box}small{font-weight:750;color:#56739b}h1{font-size:29px;letter-spacing:-.05em}p{color:#617089;line-height:1.65}input,button{box-sizing:border-box;width:100%;padding:15px;border-radius:7px;font-size:16px}input{border:1px solid #ccd6e2}button{background:#183973;border:0;color:#fff;margin-top:15px;font-weight:800;cursor:pointer}.sub{margin-top:20px;font-size:12px}a{color:#315cc2}</style></head><body><main class="panel"><small>MOMENTUM · PRIVATE STUDIO</small><h1>관리자 로그인</h1><p>홈페이지 제작 도구와 거래처·상품 관리는 모멘텀마케팅 운영자만 이용할 수 있습니다.</p><form action="/admin/login" method="post"><label for="password">관리자 비밀번호</label><input id="password" name="password" type="password" required minlength="16" autocomplete="current-password"><button>제작 스튜디오 입장</button></form><p class="sub"><a href="/">공개 홈페이지로 돌아가기</a></p></main></body></html>`;
function formData(req){
 const v=req.body;
 if(typeof v==='string'&&v.length<=MAX_FORM)return new URLSearchParams(v);
 if(v&&typeof v==='object')return new URLSearchParams(v);
 return new URLSearchParams();
}
function originValid(req){
 const origin=req.headers.origin||'';
 if(!origin)return false;
 try{
  const o=new URL(origin);
  return o.protocol==='https:'&&o.host===req.headers.host;
 }catch{return false}
}
module.exports=function(req,res){
 for(const [key,value] of Object.entries(HEADERS))res.setHeader(key,value);
 const config=ready();
 if(!config){return pageError(res,503,'관리자 인증 설정이 필요합니다');}
 const action=typeof req.query?.action==='string'?req.query.action:'';
 const asset=typeof req.query?.asset==='string'?req.query.asset:'';
 const view=typeof req.query?.view==='string'?req.query.view:'';
 const method=String(req.method||'GET').toUpperCase();
 if(method==='POST'){
  if(!originValid(req))return pageError(res,403,'허용되지 않은 요청입니다');
  if(action==='logout'){
   res.statusCode=303;res.setHeader('Set-Cookie',COOKIE+'=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
   res.setHeader('Location','/admin/');return res.end();
  }
  if(action!=='login')return pageError(res,405,'지원하지 않는 요청입니다');
  const password=formData(req).get('password')||'';
  if(password.length>512||!safeCompare(crypto.createHash('sha256').update(password).digest('hex'),crypto.createHash('sha256').update(config.pass).digest('hex'))){
   return pageError(res,401,'관리자 비밀번호가 올바르지 않습니다');
  }
  res.statusCode=303;res.setHeader('Set-Cookie',makeCookie(config.secret));
  res.setHeader('Location','/admin/');return res.end();
 }
 if(method!=='GET')return pageError(res,405,'지원하지 않는 요청입니다');
 if(!loggedIn(req,config.secret)){
  if(asset)return pageError(res,401,'로그인이 필요합니다');
  res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(LOGIN);
 }
 const file=asset||(view==='crm'?'crm-index.html':'index.html');
 if(!ASSETS.has(file))return pageError(res,404,'페이지를 찾을 수 없습니다');
 let data;
 try{data=fs.readFileSync(path.join(__dirname,'..','site-builder',file),'utf8')}
 catch{return pageError(res,503,'관리자 리소스를 불러오지 못했습니다')}
 if(file==='index.html'){
  data=data.replaceAll('/site-builder/','/admin/assets/');
 }
 const MIME={ 'editor.css':'text/css; charset=utf-8','site-template.css':'text/css; charset=utf-8','editor.js':'text/javascript; charset=utf-8','kit.js':'text/javascript; charset=utf-8','presets.json':'application/json; charset=utf-8','crm.js':'text/javascript; charset=utf-8','crm.css':'text/css; charset=utf-8','products.json':'application/json; charset=utf-8'};
 res.setHeader('Content-Type',MIME[file]||'text/html; charset=utf-8');
 return res.end(data);
};
