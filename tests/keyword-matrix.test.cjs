'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../api/_rank-keyword-model');
const observer=require('../api/_place-observe');
const handler=require('../api/admin-keyword-matrix');
const auth=require('../api/admin-site-builder');
const db=require('../api/_rank-store');
const sid1='11111111-1111-4111-8111-111111111111',sid2='22222222-2222-4222-8222-222222222222';
function res(){return {code:0,data:null,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.data=v;return this}}}
async function withMock({authorized=true,configured=true,request,runMobileList},task){
 const original={auth:auth.isAuthorized,config:db.config,request:db.request,list:observer.runMobileList};
 auth.isAuthorized=()=>authorized;db.config=()=>configured?{base:'https://local.supabase.co',token:'x'}:null;
 if(request)db.request=request;if(runMobileList)observer.runMobileList=runMobileList;
 try{await task()}finally{auth.isAuthorized=original.auth;db.config=original.config;db.request=original.request;observer.runMobileList=original.list}
}

test('reduceMobileList accepts only visible unique IDs, never invents missing positions',()=>{
 const data=model.reduceMobileList([
  {id:'2085358113',name:'퐝물회',rank:85},{id:'2085358113',name:'중복',rank:86},
  {id:'junk',name:'가짜',rank:87},{id:'234567890',name:'테스트 매장',rank:null}
 ]);
 assert.equal(data.status,'observed');assert.equal(data.observedCount,2);
 assert.deepEqual(data.entries.map(x=>x.rank),[85,2]);
 assert.equal(data.entries[0].approximate,false);
 assert.equal(data.entries[1].approximate,true);
 assert.match(data.disclaimer,/자연검색 순위가 아닙니다/);
 assert.equal(model.reduceMobileList([]).status,'no_place_block');
 assert.equal(observer.runMobileList.constructor.name,'AsyncFunction');
});

test('rank metadata restarting inside loaded scroll never produces a false exact rank',()=>{
 const rows=model.reduceMobileList([{id:'1234567',name:'첫 업체',rank:8},{id:'2345678',name:'둘 업체',rank:1},{id:'3456789',name:'셋 업체',rank:2}]).entries;
 assert.deepEqual(rows.map(x=>x.rank),[8,2,3]);
 assert.equal(rows[1].approximate,true);
 assert.equal(rows[2].rankBasis,'visible_list_position_estimate');
});

test('Korea-local dates and snapshots compare the same ID with explicit gaps',()=>{
 assert.equal(model.day('2026-10-15T15:00:00Z'),'2026-10-16');
 const older={id:sid1,observed_at:'2026-10-12T07:00:00Z',observed_count:2,max_observed_rank:85};
 const newer={id:sid2,observed_at:'2026-10-14T07:00:00Z',observed_count:2,max_observed_rank:85};
 const data=model.summarize([older,newer],[
  {snapshot_id:sid1,place_id:'2085358113',place_name:'퐝물회',rank:85,rank_approximate:false,rank_basis:'provider_list_position'},
  {snapshot_id:sid1,place_id:'1234567',place_name:'과거 업체',rank:5,rank_approximate:false,rank_basis:'provider_list_position'},
  {snapshot_id:sid2,place_id:'2085358113',place_name:'퐝물회',rank:82,rank_approximate:true,rank_basis:'visible_list_position_estimate'},
  {snapshot_id:sid2,place_id:'7777777',place_name:'오늘만 관측',rank:6,rank_approximate:false,rank_basis:'provider_list_position'}
 ],{days:7});
 assert.deepEqual(data.columns.map(x=>x.date),['2026-10-12','2026-10-14']);
 assert.equal(data.columns[0].entries.length,2);
 assert.ok(data.columns[0].entries.some(x=>x.name==='과거 업체'));
 assert.equal(data.summary.matchedAcrossLastTwo,1);
 assert.equal(data.summary.rising,1);
 assert.equal(data.movements.find(x=>x.placeId==='2085358113').delta,3);
 assert.equal(data.movements.find(x=>x.placeId==='7777777').delta,null);
 assert.equal(data.movements.find(x=>x.placeId==='2085358113').approximate,true);
 assert.equal(data.summary.uncomparable,1);
 assert.match(data.disclaimer,/미측정 날짜/);
});

test('admin keyword matrix rejects unauthenticated, bad source and missing DB',async()=>{
 const req={method:'GET',query:{keyword:'포항맛집'},headers:{}};
 await withMock({authorized:false},async()=>{const r=res();await handler(req,r);assert.equal(r.code,401)});
 await withMock({configured:false},async()=>{const r=res();await handler(req,r);assert.equal(r.code,503)});
 await withMock({configured:true},async()=>{
  const r=res();await handler({method:'POST',headers:{origin:'https://evil.test',host:'momentum.test'},body:{keyword:'포항맛집'}},r);
  assert.equal(r.code,403);
 });
});

test('history reads preserved snapshots via DB function and never measures Naver',async()=>{
 const olderAt=new Date(Date.now()-86400000).toISOString(),newerAt=new Date().toISOString();
 const calls=[];
 await withMock({request:async(table,opts)=>{
  calls.push({table,opts});
  if(table==='rpc/momentum_keyword_latest_days')return [
   {id:sid2,observed_at:newerAt,observed_count:2,max_observed_rank:85},
   {id:sid1,observed_at:olderAt,observed_count:2,max_observed_rank:88}
  ];
  if(table==='rank_keyword_entries')return [
   {snapshot_id:sid1,place_id:'2085358113',place_name:'퐝물회',rank:88,rank_approximate:true},
   {snapshot_id:sid2,place_id:'2085358113',place_name:'퐝물회',rank:85,rank_approximate:false}
  ];
  throw Error(table);
 },runMobileList:()=>{throw Error('GET must never browse')}},async()=>{
  const r=res();await handler({method:'GET',query:{keyword:'포항맛집',days:7},headers:{}},r);
  assert.equal(r.code,200);assert.equal(r.data.scope,'mobile');
  assert.equal(r.data.summary.latestObservedCount,2);
  assert.equal(r.data.summary.rising,1);
  assert.equal(r.data.movements[0].delta,3);
 });
 assert.deepEqual(calls.map(x=>x.table),['rpc/momentum_keyword_latest_days','rank_keyword_entries']);
 assert.equal(calls[0].opts.body.p_days,7);
});

test('one admin capture uses shared gate and saves only observed provider rows',async()=>{
 const calls=[],at=new Date().toISOString();
 await withMock({request:async(table,opts)=>{
  calls.push(table);
  if(table==='rank_live_snapshots')return [];
  if(table==='rpc/momentum_rank_claim')return {state:'allowed'};
  if(table==='rpc/momentum_save_keyword_snapshot'){
   assert.equal(opts.body.p_keyword,'포항맛집');
   assert.equal(opts.body.p_entries[0].placeId,'2085358113');
   return sid1;
  }
  throw Error(table);
 },runMobileList:async()=>({status:'observed',source:'browser_observed',query:'포항맛집',
   observedAt:at,entries:[{placeId:'2085358113',name:'퐝물회',rank:85,approximate:false,rankBasis:'provider_list_position'}],
   observedCount:1,maxObservedRank:85})},async()=>{
  const r=res();await handler({method:'POST',headers:{origin:'https://momentum.test',host:'momentum.test'},
   body:{keyword:'포항맛집'}},r);
  assert.equal(r.code,200);assert.equal(r.data.status,'saved');
  assert.equal(r.data.observedCount,1);assert.equal(r.data.snapshotId,sid1);
 });
 assert.deepEqual(calls,['rank_live_snapshots','rpc/momentum_rank_claim','rank_live_snapshots','rpc/momentum_save_keyword_snapshot']);
});

test('SQL tables and authenticated UI contain no public snapshot grants',()=>{
 const sql=fs.readFileSync('db/rank-keyword-history.sql','utf8');
 const html=fs.readFileSync('site-builder/keyword-matrix-index.html','utf8');
 const js=fs.readFileSync('site-builder/keyword-matrix.js','utf8');
 const router=fs.readFileSync('api/admin-site-builder.js','utf8');
 const vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 for(const name of ['rank_keyword_snapshots','rank_keyword_entries','momentum_save_keyword_snapshot','momentum_keyword_latest_days'])assert.ok(sql.includes(name));
 assert.match(sql,/revoke all on public\.rank_keyword_snapshots from PUBLIC,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.momentum_keyword_latest_days/);
 for(const id of ['keyword','matrixHead','matrixBody','movementRows','trendChart','exportCsv'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(router,/view==='keywords'/);
 assert.match(router,/keyword-matrix-index\.html/);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.ok(vercel.rewrites.some(x=>x.source==='/admin/keyword-matrix/api'&&x.destination==='/api/admin-keyword-matrix'));
});
