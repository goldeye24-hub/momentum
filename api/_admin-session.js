'use strict';
// Shared admin session independent of legacy admin UI and browser pages.
const crypto=require('node:crypto');
const COOKIE='momentum_admin_session';
const SIX_HOURS=6*60*60;
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

function isAuthorized(req){const config=ready();return !!config&&loggedIn(req,config.secret)}
module.exports={COOKIE,SIX_HOURS,ready,safeCompare,signature,makeCookie,loggedIn,isAuthorized};
