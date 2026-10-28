'use strict';
// Public anonymous daily free-place lookup allowance. A signed, HttpOnly
// browser cookie is a best-effort daily limit, NOT a cross-device identity.
// An account-scoped durable limit requires a shared server-side database.
const crypto=require('node:crypto');
const member=require('./_member-session');
const COOKIE='momentum_public_rank_day_v1';
const DAY_MS=24*60*60*1000;
const secret=()=>{const s=process.env.MOMENTUM_SESSION_SECRET||'';return s.length>=32?s:null};
const dateKST=(now=Date.now())=>new Date(now+9*60*60*1000).toISOString().slice(0,10);
const nextReset=(now=Date.now())=>{
 const date=dateKST(now);
 return Date.parse(date+'T15:00:00.000Z')+DAY_MS;
};
const sign=(value,key)=>crypto.createHmac('sha256',key).update('public_rank_day_v1\n'+value).digest('hex');
function previouslyUsed(req,now=Date.now()){
 const key=secret();if(!key)return false;
 const raw=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
 if(!raw)return false;
 let value;try{value=decodeURIComponent(raw.slice(COOKIE.length+1))}catch{return false}
 const bits=value.split('.');
 if(bits.length!==3||bits[0]!==dateKST(now)||!/^[0-9a-f]{16}$/.test(bits[1])||!/^[0-9a-f]{64}$/.test(bits[2]))return false;
 const rawPayload=bits[0]+'.'+bits[1],expected=Buffer.from(sign(rawPayload,key),'hex'),actual=Buffer.from(bits[2],'hex');
 return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
}
function check(req,now=Date.now()){
 if(member.check(req,now))return {allowed:true,member:true};
 if(!secret())return {allowed:false,status:503,reason:'anonymous_quota_unavailable',message:'비회원 일일 조회 제한을 확인할 수 없어 자동 조회를 잠시 중단했습니다.'};
 if(previouslyUsed(req,now))return {allowed:false,status:429,reason:'daily_limit_reached',message:'비회원 플레이스 순위 조회는 하루 1회만 가능합니다. 한국시간 자정 이후 다시 이용해 주세요.',retryAfterSeconds:Math.max(1,Math.ceil((nextReset(now)-now)/1000)),resetAt:new Date(nextReset(now)).toISOString()};
 return {allowed:true,member:false};
}
function consume(res,now=Date.now()){
 const key=secret();if(!key)return false;
 const payload=dateKST(now)+'.'+crypto.randomBytes(8).toString('hex');
 const value=payload+'.'+sign(payload,key);
 const ttl=Math.max(1,Math.ceil((nextReset(now)-now)/1000));
 res.setHeader('Set-Cookie',COOKIE+'='+encodeURIComponent(value)+'; Path=/api/place-rank-live; Max-Age='+ttl+'; HttpOnly; Secure; SameSite=Lax');
 return true;
}
module.exports={check,consume,_test:{dateKST,nextReset,previouslyUsed}};
