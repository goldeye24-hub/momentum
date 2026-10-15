'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../api/_place-competitor-model');
const handler=require('../api/admin-competitor-compare');
const auth=require('../api/admin-site-builder'),db=require('../api/_rank-store');
const A='2085358113',B='1616273949';
function res(){return{code:0,data:null,setHeader(){},status(code){this.code=code;return this},json(value){this.data=value;return this}}}
async function stub(config,cb){
 const old={auth:auth.isAuthorized,config:db.config,request:db.request};
 auth.isAuthorized=()=>config.authorized!==false;db.config=()=>config.db===false?null:{base:'https://test.supabase.co',token:'x'};
 db.request=config.request||db.request;
 try{await cb()}finally{auth.isAuthorized=old.auth;db.config=old.config;db.request=old.request}
}
const examples=[
 {keyword:'포항맛집',observed_at:'2026-10-15T10:00:00Z',rank_a:85,rank_b:9,approximate_a:false,approximate_b:false,name_a:'퐝물회',name_b:'경쟁업체'},
 {keyword:'포항 해산물',observed_at:'2026-10-15T10:00:00Z',rank_a:20,rank_b:null,approximate_a:true,approximate_b:null,name_a:'퐝물회'},
 {keyword:'영일대맛집',observed_at:'2026-10-15T10:00:00Z',rank_a:null,rank_b:8,approximate_a:null,approximate_b:false,name_b:'경쟁업체'},
 {keyword:'미관측',observed_at:'2026-10-15T10:00:00Z',rank_a:null,rank_b:null}
];
test('comparison distinguishes jointly observed keywords from one-sided missing observations',()=>{
 const result=model.summarize(examples,A,B);
 assert.equal(result.summary.keywordsObserved,3);
 assert.equal(result.summary.both,1);assert.equal(result.summary.onlyA,1);assert.equal(result.summary.onlyB,1);
 assert.equal(result.summary.betterB,1);assert.equal(result.summary.betterA,0);
 assert.equal(result.summary.top10A,0);assert.equal(result.summary.top10B,2);
 assert.equal(result.rows.find(x=>x.keyword==='포항 해산물').approximateA,true);
 assert.equal(result.rows.find(x=>x.keyword==='영일대맛집').rankA,null);
 assert.match(result.disclaimer,/뜻하지 않습니다/);
});
test('comparison endpoint rejects unauthenticated and invalid IDs',async()=>{
 await stub({authorized:false},async()=>{const r=res();await handler({method:'GET',query:{a:A,b:B}},r);assert.equal(r.code,401)});
 await stub({},async()=>{const r=res();await handler({method:'GET',query:{a:A,b:A}},r);assert.equal(r.code,400)});
 await stub({},async()=>{const r=res();await handler({method:'GET',query:{a:'https://evil.test/place/'+A,b:B}},r);assert.equal(r.code,400)});
 await stub({db:false},async()=>{const r=res();await handler({method:'GET',query:{a:A,b:B}},r);assert.equal(r.code,503)});
});
test('comparison GET reads the exact same-snapshot SQL function, not Naver',async()=>{
 let calls=0;
 await stub({request:async(table,opts)=>{
  calls++;
  assert.equal(table,'rpc/momentum_compare_places');
  assert.deepEqual(opts.body,{p_place_a:A,p_place_b:B,p_days:30});
  return examples;
 }},async()=>{
  const r=res();await handler({method:'GET',query:{a:'https://m.place.naver.com/restaurant/'+A+'/home',b:B,days:'30'}},r);
  assert.equal(r.code,200);assert.equal(r.data.scope,'mobile');
  assert.equal(r.data.summary.keywordsObserved,3);
  assert.equal(r.data.placeA,A);assert.equal(r.data.placeB,B);
 });
 assert.equal(calls,1);
});
test('competition view has private DB-only endpoint, accessible admin assets and no client API key',()=>{
 const sql=fs.readFileSync('db/rank-keyword-history.sql','utf8');
 const page=fs.readFileSync('site-builder/competitor-compare-index.html','utf8');
 const js=fs.readFileSync('site-builder/competitor-compare.js','utf8');
 const api=fs.readFileSync('api/admin-competitor-compare.js','utf8');
 const router=fs.readFileSync('api/admin-site-builder.js','utf8');
 const rewrites=JSON.parse(fs.readFileSync('vercel.json','utf8')).rewrites;
 assert.match(sql,/momentum_compare_places/);assert.match(sql,/rank_keyword_entries/);
 assert.match(sql,/revoke all on function public\.momentum_compare_places/);
 assert.match(api,/auth\.isAuthorized/);assert.doesNotMatch(api,/runMobile\(/);
 assert.match(router,/view==='competitors'/);
 assert.ok(rewrites.some(x=>x.source==='/admin/competitors/api'));
 for(const id of ['placeA','placeB','bothCount','aCount','bCount','compareRows','filter'])assert.match(page,new RegExp('id="'+id+'"'));
 assert.doesNotThrow(()=>new vm.Script(js));
});
