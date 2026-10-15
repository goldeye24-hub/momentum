'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const member=require('../api/_member-session'),db=require('../api/_rank-store');
const model=require('../api/_member-history-model'),handler=require('../server-handlers/member-history');
const USER='11111111-1111-4111-8111-111111111111',TARGET='22222222-2222-4222-8222-222222222222';
function res(){return{code:0,data:null,setHeader(){},status(v){this.code=v;return this},json(v){this.data=v;return this}}}
async function mocked({session=true,configured=true,request},run){
 const before={check:member.check,configured:member.configured,request:db.request};
 member.check=()=>session?{userId:USER,email:'sample@company.kr'}:null;
 member.configured=()=>configured?{base:'https://database.supabase.co'}:null;
 if(request)db.request=request;
 try{await run()}finally{member.check=before.check;member.configured=before.configured;db.request=before.request}
}
test('daily evidence model counts missing-day gaps without fabricating placements',()=>{
 const summary=model.summarize([
  {observation_date:'2026-10-13',observed_at:null,rank:null,observed_count:null},
  {observation_date:'2026-10-14',observed_at:'2026-10-14T07:00:00Z',rank:9,observed_count:15,rank_approximate:false,rank_basis:'provider_list_position'},
  {observation_date:'2026-10-15',observed_at:'2026-10-15T07:00:00Z',rank:null,observed_count:25},
 ],7);
 assert.equal(summary.rows.length,3);assert.equal(summary.summary.daysMeasured,2);
 assert.equal(summary.summary.daysMatched,1);assert.equal(summary.summary.notFoundInList,1);
 assert.equal(summary.summary.noKeywordMeasurement,1);
 assert.equal(summary.rows[0].status,'not_measured');
 assert.equal(summary.rows[2].status,'not_found_in_observed_list');
 assert.equal(summary.summary.change,null);assert.equal(summary.summary.lastRecordedRank,9);
 assert.match(summary.disclaimer,/미노출이나 순위 밖을 확정하지/);
});
test('daily model only reports change when two most recent observations include Place ID',()=>{
 const records=[
  {observation_date:'2026-10-13',observed_at:'2026-10-13T01:00:00Z',rank:11,rank_approximate:false},
  {observation_date:'2026-10-14',observed_at:'2026-10-14T01:00:00Z',rank:8,rank_approximate:false},
  {observation_date:'2026-10-15',observed_at:'2026-10-15T01:00:00Z',rank:5,rank_approximate:true}
 ];
 const result=model.summarize(records,30);
 assert.equal(result.summary.change,3);assert.equal(result.summary.changeFrom,'2026-10-14');
 assert.equal(result.summary.lastRecordedRank,5);assert.equal(result.summary.lastApproximate,true);
 assert.equal(model.summarize(records.slice(0,1),7).summary.change,null);
});
test('member daily API denies anonymous, invalid ID and unsupported methods',async()=>{
 await mocked({session:false},async()=>{const r=res();await handler({method:'GET',query:{targetId:TARGET}},r);assert.equal(r.code,401)});
 await mocked({},async()=>{const r=res();await handler({method:'POST',query:{targetId:TARGET}},r);assert.equal(r.code,405)});
 await mocked({},async()=>{const r=res();await handler({method:'GET',query:{targetId:'abc'}},r);assert.equal(r.code,400)});
 await mocked({configured:false},async()=>{const r=res();await handler({method:'GET',query:{targetId:TARGET}},r);assert.equal(r.code,503)});
});
test('member history must confirm owner before reading exact Place list',async()=>{
 const calls=[];
 await mocked({request:async(table,opts)=>{
  calls.push({table,opts});
  if(table==='momentum_member_targets')return [{id:TARGET,label:'가게',keyword:'포항맛집',place_id:'2085358113',scope:'mobile'}];
  if(table==='rpc/momentum_member_daily_history')return [
   {observation_date:'2026-10-14',observed_at:'2026-10-14T01:00:00Z',rank:44,rank_approximate:false},
   {observation_date:'2026-10-15',observed_at:'2026-10-15T01:00:00Z',rank:42,rank_approximate:true}
  ];
  throw Error('unexpected store table '+table);
 }},async()=>{
  const r=res();await handler({method:'GET',query:{targetId:TARGET,days:7}},r);
  assert.equal(r.code,200);
  assert.equal(r.data.summary.change,2);
  assert.equal(r.data.target.placeId,'2085358113');
  assert.equal(r.data.rows.length,2);
 });
 assert.equal(calls[0].opts.query.owner_id,'eq.'+USER);
 assert.deepEqual(calls[1].opts.body,{p_user:USER,p_target:TARGET,p_days:7});
});
test('member history returns 404 for other owner and 422 for name-only',async()=>{
 await mocked({request:async table=>{assert.equal(table,'momentum_member_targets');return []}},async()=>{
  const r=res();await handler({method:'GET',query:{targetId:TARGET}},r);assert.equal(r.code,404);
 });
 await mocked({request:async table=>{assert.equal(table,'momentum_member_targets');
  return [{id:TARGET,label:'가게',keyword:'포항맛집',place_id:null,scope:'mobile'}]
 }},async()=>{
  const r=res();await handler({method:'GET',query:{targetId:TARGET}},r);assert.equal(r.code,422);
 });
});
test('SQL history is owner-only, service-role-only, and joins exact target without fake data',()=>{
 const sql=fs.readFileSync('db/member-portal.sql','utf8');
 const api=fs.readFileSync('server-handlers/member-history.js','utf8');
 const js=fs.readFileSync('platform/history.js','utf8');
 const portal=fs.readFileSync('platform/index.html','utf8');
 const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 assert.match(sql,/momentum_member_daily_history/);
 assert.match(sql,/where t\.owner_id=p_user and t\.id=p_target/);
 assert.match(sql,/revoke all on function public\.momentum_member_daily_history/);
 assert.match(sql,/grant execute on function public\.momentum_member_daily_history[\s\S]*?to service_role/);
 assert.match(api,/member\.check\(req\)/);assert.match(api,/owner_id:'eq\.'\+session\.userId/);
 assert.doesNotMatch(api,/runMobile|runMap|fetch\(/);
 assert.match(portal,/id="historyChart"/);assert.match(portal,/src="\/platform\/history.js"/);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.ok(config.functions['api/compact.js']);
});
