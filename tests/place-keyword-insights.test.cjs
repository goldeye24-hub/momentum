'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../api/_place-keyword-insight-model');
const handler=require('../server-handlers/admin-place-keyword-insights');
const auth=require('../api/admin-site-builder'),db=require('../api/_rank-store');
const place='2085358113';
function response(){return{code:0,data:null,setHeader(){},status(n){this.code=n;return this},json(d){this.data=d;return this}}}
async function stub(config,task){
 const old={a:auth.isAuthorized,c:db.config,r:db.request};
 auth.isAuthorized=()=>config.authorized!==false;
 db.config=()=>config.db===false?null:{base:'https://test.supabase.co',token:'x'};
 if(config.request)db.request=config.request;
 try{await task()}finally{auth.isAuthorized=old.a;db.config=old.c;db.request=old.r}
}
const rows=[
 {keyword:'포항맛집',latest_observed_at:'2026-10-15T09:00:00Z',previous_observed_at:'2026-10-14T09:00:00Z',latest_rank:85,previous_rank:88,latest_approximate:true,previous_approximate:false,matched_name:'퐝물회'},
 {keyword:'영일대 물회',latest_observed_at:'2026-10-15T09:00:00Z',previous_observed_at:'2026-10-14T09:00:00Z',latest_rank:null,previous_rank:7,latest_approximate:null,previous_approximate:false,matched_name:'퐝물회'},
 {keyword:'포항 해산물',latest_observed_at:'2026-10-15T09:00:00Z',previous_observed_at:null,latest_rank:5,previous_rank:null,latest_approximate:false,previous_approximate:null,matched_name:'퐝물회'}
];
test('keyword insights distinguish observed trend from missing recent Place ID',()=>{
 const result=model.summarize(rows,place);
 assert.equal(result.summary.trackedKeywords,3);
 assert.equal(result.summary.visibleInLatest,2);
 assert.equal(result.summary.notObservedLatest,1);
 assert.equal(result.summary.top3,0);
 assert.equal(result.summary.top10,1);
 assert.equal(result.summary.rising,1);
 assert.equal(result.summary.falling,0);
 assert.equal(result.summary.unknownDelta,2);
 const old=result.rows.find(x=>x.keyword==='영일대 물회');
 assert.equal(old.status,'not_observed_in_latest');assert.equal(old.rank,null);assert.equal(old.previousRank,7);assert.equal(old.delta,null);
 assert.match(result.disclaimer,/전수 발굴/);
});
test('private insight API rejects missing auth, ambiguous names and DB absence',async()=>{
 await stub({authorized:false},async()=>{const r=response();await handler({method:'GET',query:{placeId:place}},r);assert.equal(r.code,401)});
 await stub({},async()=>{const r=response();await handler({method:'GET',query:{placeId:'퐝물회'}},r);assert.equal(r.code,400)});
 await stub({},async()=>{const r=response();await handler({method:'GET',query:{placeId:'https://attacker.test/place/'+place}},r);assert.equal(r.code,400)});
 await stub({db:false},async()=>{const r=response();await handler({method:'GET',query:{placeId:place}},r);assert.equal(r.code,503)});
});
test('observed keyword insights use only private stored DB records',async()=>{
 let times=0;
 await stub({request:async(table,opts)=>{
  times++;assert.equal(table,'rpc/momentum_place_keyword_insights');
  assert.deepEqual(opts.body,{p_place_id:place,p_days:30});
  return rows;
 }},async()=>{
  const r=response();await handler({method:'GET',query:{placeId:'https://m.place.naver.com/restaurant/'+place+'/home',days:30}},r);
  assert.equal(r.code,200);assert.equal(r.data.summary.trackedKeywords,3);
  assert.equal(r.data.rows.find(x=>x.keyword==='포항맛집').rank,85);
 });assert.equal(times,1);
});
test('insights SQL and manager UI are read-only, private and deep-link to rank matrix',()=>{
 const sql=fs.readFileSync('db/rank-keyword-history.sql','utf8');
 const ui=fs.readFileSync('site-builder/place-keyword-insights-index.html','utf8');
 const js=fs.readFileSync('site-builder/place-keyword-insights.js','utf8');
 const mx=fs.readFileSync('site-builder/keyword-matrix.js','utf8');
 const api=fs.readFileSync('server-handlers/admin-place-keyword-insights.js','utf8');
 const admin=fs.readFileSync('api/admin-site-builder.js','utf8');
 const cfg=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 assert.match(sql,/momentum_place_keyword_insights/);
 assert.match(sql,/revoke all on function public\.momentum_place_keyword_insights/);
 assert.doesNotMatch(api,/runMobile|fetch\(/);
 assert.match(admin,/view==='insights'/);
 assert.ok(cfg.rewrites.some(r=>r.source==='/admin/place-insights/api'));
 for(const id of ['placeId','insightRows','keywordCount','top3Count','top10Count','filter'])assert.match(ui,new RegExp('id="'+id+'"'));
 assert.match(js,/\/admin\/keyword-matrix\/\?keyword=/);
 assert.match(mx,/URLSearchParams\(location\.search\)/);
 assert.doesNotThrow(()=>new vm.Script(js));assert.doesNotThrow(()=>new vm.Script(mx));
});
