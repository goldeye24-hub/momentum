'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const db=require('../api/_rank-store'),member=require('../api/_member-session');
const keys=['MOMENTUM_RANK_DB_URL','MOMENTUM_RANK_DB_SERVICE_KEY','MOMENTUM_MEMBER_ANON_KEY','MOMENTUM_MEMBER_SESSION_SECRET'];
async function simulate({adminKey,publicKey},task){
 const original=Object.fromEntries(keys.map(key=>[key,process.env[key]])),fetchBefore=global.fetch;
 process.env.MOMENTUM_RANK_DB_URL='https://testproject.supabase.co';
 process.env.MOMENTUM_RANK_DB_SERVICE_KEY=adminKey;
 process.env.MOMENTUM_MEMBER_ANON_KEY=publicKey;
 process.env.MOMENTUM_MEMBER_SESSION_SECRET='z'.repeat(64);
 const requests=[];
 global.fetch=async(url,options)=>{
  requests.push({url:String(url),headers:options.headers,method:options.method});
  return {ok:true,status:200,text:async()=>JSON.stringify([]),json:async()=>({user:null})};
 };
 try{await task(requests)}finally{
  global.fetch=fetchBefore;
  for(const key of keys)if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];
 }
}
test('2026 secret and publishable keys authenticate only through apikey; not fake Bearer JWTs',async()=>{
 await simulate({adminKey:'sb_secret_'+'a'.repeat(41),publicKey:'sb_publishable_'+'b'.repeat(41)},async requests=>{
  assert.ok(db.config());assert.ok(member.configured());
  await db.request('rank_keyword_snapshots',{query:{limit:1}});
  await member.authCall('signup',{body:{email:'example@test.invalid',password:'not-a-real-password'}});
  assert.equal(requests.length,2);
  assert.match(requests[0].url,/\/rest\/v1\/rank_keyword_snapshots/);
  assert.match(requests[1].url,/\/auth\/v1\/signup/);
  assert.equal(requests[0].headers.apikey,process.env.MOMENTUM_RANK_DB_SERVICE_KEY);
  assert.equal(requests[1].headers.apikey,process.env.MOMENTUM_MEMBER_ANON_KEY);
  assert.equal(requests[0].headers.Authorization,undefined);
  assert.equal(requests[1].headers.Authorization,undefined);
 });
});
test('legacy service_role and anon JWTs retain compatibility during migrations',async()=>{
 await simulate({adminKey:'eyJ.'+'s'.repeat(70)+'.sig',publicKey:'eyJ.'+'p'.repeat(70)+'.sig'},async requests=>{
  await db.request('rank_keyword_entries',{query:{limit:1}});
  await member.authCall('token?grant_type=password',{body:{email:'example@test.invalid',password:'not-a-real-password'}});
  assert.equal(requests[0].headers.Authorization,'Bearer '+process.env.MOMENTUM_RANK_DB_SERVICE_KEY);
  assert.equal(requests[1].headers.Authorization,'Bearer '+process.env.MOMENTUM_MEMBER_ANON_KEY);
 });
});
