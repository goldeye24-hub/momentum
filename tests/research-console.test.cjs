'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../api/research-console.js'),'utf8');
const uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',tid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function setup({signedIn=true,hasTarget=true}={}){
 const writes=[],readQueries=[];
 const db={uuid:s=>/^[a-f0-9-]{36}$/i.test(s),request:async(t,o)=>{
  if(o?.method==='POST'&&t.startsWith('momentum_research_')){writes.push({t,body:o.body});return []}
  if(t==='momentum_member_targets'){readQueries.push(o.query);return hasTarget?[{
   id:tid,owner_id:uid,keyword:'포항맛집',place_id:'2085358113',scope:'mobile',label:'퐝물회'
  }]:[]}
  if(t==='momentum_research_keyword_volumes')return [];
  return [];
 }};
 const member={check:()=>signedIn?{userId:uid}:null,configured:()=>true,validOrigin:()=>true};
 const modules={'./_member-session':member,'./_rank-store':db,
 './rank-rebuild':{_scan:async()=>({status:'found',observedPosition:17,observedCount:140,observedAt:'2026-10-28T00:00:00.000Z'})},
 './_research-volume-core':{lookup:async()=>({status:'ok',keyword:'포항맛집',pc:100,mobile:200,pcRaw:'100',mobileRaw:'200',total:300,observedAt:'2026-10-28T00:00:00.000Z'})},
 '../server-handlers/member-auth':()=>{},'../server-handlers/member-watches':()=>{}};
 const m={exports:{}};
 vm.runInNewContext('(function(require,module,exports){'+script+'})',{
  URLSearchParams,URL,Date,Map,Number,String,Array,JSON,Math,console,process:{env:{VERCEL_ENV:'preview'}}
 })(x=>modules[x],m,m.exports);
 async function request(action,method='GET',body={}){
  let status=200,result;const res={setHeader(){},status(s){status=s;return this},json(d){result=d;return this}};
  await m.exports({query:{action,targetId:tid},method,headers:{cookie:'valid',host:'localhost',origin:'https://localhost'},body},res);
  return {status,result};
 }
 return {request,writes,readQueries};
}
test('reject unsigned account operations before touching DB',async()=>{
 const s=setup({signedIn:false});
 assert.equal((await s.request('rank-history')).status,401);
 assert.equal(s.writes.length,0);
});
test('refuse to access a target not owned by logged-in account',async()=>{
 const s=setup({hasTarget:false});
 assert.equal((await s.request('scan-rank','POST',{targetId:tid})).status,404);
 assert.equal(s.writes.length,0);
});
test('never trust supplied rank; persist only observed rank with owner and target',async()=>{
 const s=setup();
 assert.equal((await s.request('scan-rank','POST',{targetId:tid,rank:1})).status,200);
 assert.equal(s.writes.length,1);
 assert.equal(s.writes[0].body.owner_id,uid);
 assert.equal(s.writes[0].body.target_id,tid);
 assert.equal(s.writes[0].body.rank,17);
 assert.ok(s.readQueries.every(q=>q.owner_id==='eq.'+uid));
});
test('store verified API monthly keyword volume as dated record',async()=>{
 const s=setup();
 assert.equal((await s.request('scan-volume','POST',{keyword:'포항맛집',total:999999})).status,200);
 assert.equal(s.writes[0].body.owner_id,uid);
 assert.equal(s.writes[0].body.total_count,300);
 assert.match(s.writes[0].body.measured_date,/^\d{4}-\d{2}-\d{2}$/);
});
