'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const db=require('../api/_rank-store'),auth=require('../api/_admin-auth-provider');
const keys=['MOMENTUM_RANK_DB_URL','MOMENTUM_RANK_DB_SERVICE_KEY','MOMENTUM_ADMIN_AUTH_ANON_KEY','MOMENTUM_MEMBER_ANON_KEY'];
async function simulate({adminKey,publicKey,useLegacy=false},work){
 const prior=Object.fromEntries(keys.map(k=>[k,process.env[k]])),fetchBefore=global.fetch;
 process.env.MOMENTUM_RANK_DB_URL='https://testproject.supabase.co';
 process.env.MOMENTUM_RANK_DB_SERVICE_KEY=adminKey;
 if(useLegacy){delete process.env.MOMENTUM_ADMIN_AUTH_ANON_KEY;process.env.MOMENTUM_MEMBER_ANON_KEY=publicKey;}
 else{process.env.MOMENTUM_ADMIN_AUTH_ANON_KEY=publicKey;delete process.env.MOMENTUM_MEMBER_ANON_KEY;}
 const requests=[];
 global.fetch=async(url,options)=>{
  requests.push({url:String(url),headers:options.headers,method:options.method});
  return {ok:true,status:200,text:async()=>JSON.stringify([]),json:async()=>({})};
 };
 try{await work(requests)}finally{
  global.fetch=fetchBefore;
  for(const k of keys)if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];
 }
}
test('admin Supabase secret and publishable keys remain apikey-only',async()=>{
 await simulate({adminKey:'sb_secret_'+'a'.repeat(41),publicKey:'sb_publishable_'+'b'.repeat(41)},async calls=>{
  assert.ok(db.config());assert.ok(auth.configured());
  await db.request('rank_keyword_snapshots',{query:{limit:1}});
  await auth.authCall('settings',{method:'GET'});
  assert.equal(calls.length,2);
  assert.match(calls[0].url,/\/rest\/v1\/rank_keyword_snapshots/);
  assert.match(calls[1].url,/\/auth\/v1\/settings/);
  assert.equal(calls[0].headers.apikey,process.env.MOMENTUM_RANK_DB_SERVICE_KEY);
  assert.equal(calls[1].headers.apikey,process.env.MOMENTUM_ADMIN_AUTH_ANON_KEY);
  assert.equal(calls[0].headers.Authorization,undefined);
  assert.equal(calls[1].headers.Authorization,undefined);
 });
});
test('legacy Supabase keys may serve only allowlisted admin OTP operations',async()=>{
 await simulate({adminKey:'eyJ.'+'s'.repeat(70)+'.sig',publicKey:'eyJ.'+'p'.repeat(70)+'.sig',useLegacy:true},async calls=>{
  await db.request('rank_keyword_entries',{query:{limit:1}});
  await auth.authCall('verify',{body:{email:'admin@example.invalid',token:'123456',type:'email'}});
  assert.equal(calls[0].headers.Authorization,'Bearer '+process.env.MOMENTUM_RANK_DB_SERVICE_KEY);
  assert.equal(calls[1].headers.Authorization,'Bearer '+process.env.MOMENTUM_MEMBER_ANON_KEY);
  await assert.rejects(auth.authCall('signup',{body:{email:'stranger@example.invalid'}}),/unsupported_admin_auth_operation/);
 });
});
