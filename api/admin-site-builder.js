'use strict';
const crypto=require('node:crypto');
const adminEmail=require('./_admin-email-login');
const fs=require('node:fs');
const path=require('node:path');

const ASSETS=new Set(['index.html','editor.css','editor.js','kit.js','presets.json','site-template.css','advertisers-index.html','advertisers.css','advertisers.js','crm-index.html','crm.css','crm.js','crm-commerce.js','products.json','finance-index.html','finance.css','finance.js','design-editor.html','design-editor.css','design-editor.js','rank-watch-index.html','rank-watch.css','rank-watch.js','keyword-matrix-index.html','keyword-matrix.css','keyword-matrix.js','competitor-compare-index.html','competitor-compare.css','competitor-compare.js','place-keyword-insights-index.html','place-keyword-insights.css','place-keyword-insights.js','member-admin-index.html','member-admin.js','connection-index.html','operations-index.html']);
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
function setupPage(res){
  res.statusCode=503;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Retry-After','300');
  return res.end(String.raw`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>관리자 초기 설정 | 모멘텀마케팅</title><style>body{background:#f3f6f4;color:#1a2c3c;font-family:system-ui,-apple-system,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center}.panel{width:min(540px,calc(100% - 36px));padding:38px;background:white;border:1px solid #dce5e3;border-radius:15px;box-shadow:0 14px 55px #14273710}small{font-weight:850;color:#78905e;letter-spacing:.1em}h1{font-size:28px;letter-spacing:-.05em;line-height:1.3}p,li{font-size:14px;line-height:1.8;color:#5d6d78}code{font-size:12px;word-break:break-all;padding:3px 5px;background:#f0f5ef;border-radius:4px}li{margin:8px 0}a.button{display:inline-block;text-decoration:none;background:#193449;border-radius:8px;color:#fff;padding:12px 17px;font-size:13px;font-weight:800;margin-top:12px}.sub{font-size:12px;color:#8998a1}</style></head><body><main class="panel"><small>MOMENTUM · PRIVATE CRM</small><h1>관리자 초기 보안 설정이 필요합니다.</h1><p>관리자 사이트는 배포되었습니다. 다만 인증 비밀번호와 세션 비밀키가 아직 설정되지 않아 고객정보 보호를 위해 로그인을 차단하고 있습니다.</p><ol><li>Vercel에서 <b>momentum</b> 프로젝트의 <b>Settings → Environment Variables</b>를 여세요.</li><li><code>MOMENTUM_ADMIN_PASSWORD</code> — 16자 이상의 강력한 관리자 비밀번호</li><li><code>MOMENTUM_SESSION_SECRET</code> — 무작위 32자 이상의 별도 비밀 문자열</li><li>두 변수의 <b>Production</b> 환경을 선택해 저장하고 최신 커밋을 재배포하세요.</li></ol><p>비밀번호나 비밀키는 채팅이나 공개 GitHub 코드에 입력하지 마세요.</p><a class="button" href="https://vercel.com/goldeye24-hubs-projects/momentum/settings/environment-variables" target="_blank" rel="noopener">Vercel 보안 설정 열기 ↗</a><p class="sub">설정 완료 후 관리자 주소를 다시 열면 로그인 화면이 나타납니다.</p></main></body></html>`);
}
const LOGIN=String.raw`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>관리자 로그인 | 모멘텀마케팅</title><style>body{min-height:100vh;display:grid;place-items:center;margin:0;background:#111b29;font-family:system-ui,sans-serif;color:#fff}.panel{max-width:440px;width:calc(100% - 40px);background:#fff;color:#1c2737;border-radius:16px;padding:40px;box-sizing:border-box}small{font-weight:750;color:#56739b}h1{font-size:29px;letter-spacing:-.05em}p{color:#617089;line-height:1.65}input,button{box-sizing:border-box;width:100%;padding:15px;border-radius:7px;font-size:16px}input{border:1px solid #ccd6e2}.remember-choice{display:flex;align-items:center;gap:10px;margin:15px 0 3px;cursor:pointer;font-size:13px;font-weight:700}.remember-choice input{width:17px;height:17px;padding:0;margin:0;accent-color:#183973}.remember-note{margin:5px 0 0;font-size:11px;line-height:1.6;color:#71849a}.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.login-message{font-size:12px;color:#c02d32;margin:10px 0 0}button{background:#183973;border:0;color:#fff;margin-top:15px;font-weight:800;cursor:pointer}.sub{margin-top:20px;font-size:12px}a{color:#315cc2}</style></head><body><main class="panel"><small>MOMENTUM · PRIVATE STUDIO</small><h1>관리자 로그인</h1><p>홈페이지 제작 도구와 거래처·상품 관리는 모멘텀마케팅 운영자만 이용할 수 있습니다.</p><form action="/admin/login" method="post" id="adminLoginForm"><label class="visually-hidden" for="adminLoginId">관리자 계정</label><input class="visually-hidden" type="text" id="adminLoginId" name="username" value="momentum-admin" autocomplete="username" readonly tabindex="-1" aria-hidden="true"><label for="password">관리자 비밀번호</label><input id="password" name="password" type="password" required minlength="16" autocomplete="off"><label class="remember-choice" for="rememberAdminPassword"><input type="checkbox" id="rememberAdminPassword"><span>관리자 비밀번호 저장</span></label><p class="remember-note">체크하면 이 브라우저의 비밀번호 관리자로 저장을 요청합니다. 사이트는 비밀번호를 따로 저장하지 않습니다.</p><button type="submit" id="adminLoginSubmit">제작 스튜디오 입장</button><p class="login-message" role="status" id="adminLoginMessage" aria-live="polite" hidden></p></form><p class="sub"><a href="/">공개 홈페이지로 돌아가기</a></p></main>
<script>
(function(){
 'use strict';
 const form=document.getElementById('adminLoginForm');
 const checkbox=document.getElementById('rememberAdminPassword');
 const password=document.getElementById('password');
 const button=document.getElementById('adminLoginSubmit');
 const message=document.getElementById('adminLoginMessage');
 const preference='momentum.admin.password-manager.optin.v1';
 const supported=typeof window.PasswordCredential==='function' &&
  !!navigator.credentials && typeof navigator.credentials.store==='function';
 function savePreference(yes){
  try{if(yes)localStorage.setItem(preference,'1');else localStorage.removeItem(preference)}
  catch{/* Browser storage is optional; password remains managed by browser. */}
 }
 function autocomplete(){password.setAttribute('autocomplete',checkbox.checked?'current-password':'off')}
 try{checkbox.checked=localStorage.getItem(preference)==='1'}catch{}
 autocomplete();
 if(checkbox.checked&&navigator.credentials&&typeof navigator.credentials.get==='function'){
  navigator.credentials.get({password:true,mediation:'optional'}).then(function(credential){
   if(checkbox.checked&&credential&&credential.id==='momentum-admin'&&
    typeof credential.password==='string'&&!password.value)password.value=credential.password;
  }).catch(function(){/* Browser password-manager access may require user interaction. */});
 }
 checkbox.addEventListener('change',function(){
  autocomplete();
  if(!checkbox.checked)savePreference(false);
 });
 form.addEventListener('submit',async function(event){
  if(!checkbox.checked||!supported){
   // Standard browser form submission preserves the original login flow.
   // Compatible browser password managers can still offer to save.
   savePreference(checkbox.checked);
   return;
  }
  event.preventDefault();
  button.disabled=true;message.hidden=true;
  try{
   const response=await fetch(form.action,{
    method:'POST',body:new URLSearchParams(new FormData(form)),
    credentials:'same-origin',redirect:'follow',
    headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}
   });
   const destination=new URL(response.url);
   if(!response.ok||!response.redirected||destination.origin!==location.origin||
       destination.pathname!=='/admin/'){
    message.textContent='관리자 비밀번호가 올바르지 않습니다. 다시 확인하세요.';
    message.hidden=false;return;
   }
   savePreference(true);
   try{
    await navigator.credentials.store(new PasswordCredential({
     id:'momentum-admin',password:password.value,name:'모멘텀마케팅 관리자'
    }));
   }catch{/* Browsers may require confirmation or reject password storage. */}
   location.assign('/admin/');
  }catch{
   message.textContent='로그인 연결을 확인할 수 없습니다. 다시 시도하세요.';
   message.hidden=false;
  }finally{button.disabled=false}
 });
})();
</script></body></html>`;
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
module.exports=async function(req,res){
 for(const [key,value] of Object.entries(HEADERS))res.setHeader(key,value);
 const config=ready();
 if(!config){return setupPage(res);}
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
  if(action==='login'&&adminEmail.enabled()){
    const input=formData(req),intent=String(input.get('intent')||'');
    if(intent==='email-send'||intent==='email-verify'){
      const email=String(input.get('email')||'').trim().toLowerCase();
      if(email.length>254)return pageError(res,400,'이메일을 확인해주세요');
      if(intent==='email-send'){
        const sent=await adminEmail.send(email);
        res.setHeader('Content-Type','text/html; charset=utf-8');
        if(!sent){
          res.statusCode=503;
          return res.end(adminEmail.page({
            step:'send',
            error:'인증번호를 발송하지 못했습니다. 메일 발송 설정(SMTP), 허용 수신자 및 발송 한도를 확인해야 합니다. 필요하면 아래 기존 비밀번호 로그인을 이용하세요.'
          }));
        }
        return res.end(adminEmail.page({step:'verify',email}));
      }
      const code=String(input.get('code')||'').trim();
      if(await adminEmail.verify(email,code)){
        res.statusCode=303;res.setHeader('Set-Cookie',makeCookie(config.secret));
        res.setHeader('Location','/admin/');return res.end();
      }
      res.statusCode=401;res.setHeader('Content-Type','text/html; charset=utf-8');
      return res.end(adminEmail.page({step:'verify',email,error:'인증번호가 올바르지 않거나 만료되었습니다.'}));
    }
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
  res.setHeader('Content-Type','text/html; charset=utf-8');
  if(adminEmail.enabled()&&req.query?.mode==='email')return res.end(adminEmail.page());
  return res.end(LOGIN);
 }
 const file=asset||(view==='advertisers'?'advertisers-index.html':view==='crm'?'crm-index.html':view==='finance'?'finance-index.html':view==='designs'?'design-editor.html':view==='watches'?'rank-watch-index.html':view==='keywords'?'keyword-matrix-index.html':view==='competitors'?'competitor-compare-index.html':view==='insights'?'place-keyword-insights-index.html':view==='members'?'member-admin-index.html':view==='connection'?'connection-index.html':view==='studio'?'index.html':'operations-index.html');
 if(!ASSETS.has(file))return pageError(res,404,'페이지를 찾을 수 없습니다');
 let data;
 try{data=fs.readFileSync(path.join(__dirname,'..','site-builder',file),'utf8')}
 catch{return pageError(res,503,'관리자 리소스를 불러오지 못했습니다')}
 if(file==='index.html'){
  data=data.replaceAll('/site-builder/','/admin/assets/');
 }
 const MIME={ 'editor.css':'text/css; charset=utf-8','site-template.css':'text/css; charset=utf-8','editor.js':'text/javascript; charset=utf-8','kit.js':'text/javascript; charset=utf-8','presets.json':'application/json; charset=utf-8','advertisers.css':'text/css; charset=utf-8','advertisers.js':'text/javascript; charset=utf-8','crm.js':'text/javascript; charset=utf-8','crm-commerce.js':'text/javascript; charset=utf-8','crm.css':'text/css; charset=utf-8','finance.css':'text/css; charset=utf-8','finance.js':'text/javascript; charset=utf-8','products.json':'application/json; charset=utf-8','design-editor.js':'text/javascript; charset=utf-8','design-editor.css':'text/css; charset=utf-8','rank-watch.css':'text/css; charset=utf-8','rank-watch.js':'text/javascript; charset=utf-8','keyword-matrix.css':'text/css; charset=utf-8','keyword-matrix.js':'text/javascript; charset=utf-8','competitor-compare.css':'text/css; charset=utf-8','competitor-compare.js':'text/javascript; charset=utf-8','place-keyword-insights.css':'text/css; charset=utf-8','place-keyword-insights.js':'text/javascript; charset=utf-8','member-admin.js':'text/javascript; charset=utf-8'};
 res.setHeader('Content-Type',MIME[file]||'text/html; charset=utf-8');
 return res.end(data);
};

// Shared read-only session verification for authenticated admin API handlers.
module.exports.isAuthorized=function(req){const config=ready();return !!config&&loggedIn(req,config.secret)};
