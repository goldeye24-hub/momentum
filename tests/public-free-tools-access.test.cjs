'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../api/_public-rank-quota.js'),'utf8');
function load(){
 const m={exports:{}};
 const factory=vm.runInNewContext('(function(require,module,exports){'+source+'})',{
  Date,Math,JSON,String,Number,Buffer,URL,process:{env:{MOMENTUM_SESSION_SECRET:'a'.repeat(48)}}
 });
 factory(id=>id==='node:crypto'?crypto:id==='./_member-session'?{
  check:req=>req?.headers?.member===true?{userId:'member'}:null
 }:null,m,m.exports);
 return m.exports;
}
test('KST date resets at 00:00 Seoul, not 00:00 UTC',()=>{
 const quota=load();
 assert.equal(quota._test.dateKST(Date.parse('2026-10-28T14:59:59Z')),'2026-10-28');
 assert.equal(quota._test.dateKST(Date.parse('2026-10-28T15:00:00Z')),'2026-10-29');
 assert.equal(new Date(quota._test.nextReset(Date.parse('2026-10-28T09:00:00Z'))).toISOString(),'2026-10-28T15:00:00.000Z');
});
test('anonymous gets one completed query per Korean day, cookie is signed and HttpOnly',()=>{
 const quota=load(),today=Date.parse('2026-10-28T09:00:00Z');
 const first={headers:{}};
 assert.equal(quota.check(first,today).allowed,true);
 let cookie='';const response={setHeader:(k,v)=>{if(k==='Set-Cookie')cookie=v}};
 assert.equal(quota.consume(response,today),true);
 assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);
 assert.match(cookie,/Path=\/api\/place-rank-live/);
 const pair=cookie.split(';')[0];
 assert.equal(quota.check({headers:{cookie:pair}},today).reason,'daily_limit_reached');
 assert.equal(quota.check({headers:{cookie:pair}},Date.parse('2026-10-28T15:00:00Z')).allowed,true);
 const altered=pair.slice(0,-1)+(pair.endsWith('0')?'1':'0');
 assert.equal(quota.check({headers:{cookie:altered}},today).allowed,true);
});
test('authenticated member is exempt from anonymous quota',()=>{
 const quota=load();
 assert.deepEqual(JSON.parse(JSON.stringify(quota.check({headers:{member:true}}))),{allowed:true,member:true});
});
test('free tool has no rank history and opens DataLab directly',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../lab/rank/index.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../lab/rank/public-rank.js'),'utf8');
 const lab=fs.readFileSync(path.join(__dirname,'../lab/index.html'),'utf8');
 const keyword=fs.readFileSync(path.join(__dirname,'../api/keyword-opportunities.js'),'utf8');
 const vercel=JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8'));
 assert.match(html,/비회원의 경우 1일 1회만 조회 가능합니다/);
 assert.doesNotMatch(html+js,/localStorage|id="rankTrend"|id="history"/);
 assert.match(lab,/datalab\.naver\.com\/keyword\/trendSearch\.naver/);
 assert.equal(vercel.redirects.some(x=>x.source==='/lab/trends/'&&x.destination.startsWith('https://datalab.naver.com/')),true);
 assert.doesNotMatch(keyword,/tooMany\(ip\)|const limits=new Map\(\)/);
});
