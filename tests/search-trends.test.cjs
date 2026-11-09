'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const endpoint=require('../api/search-trends.js');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function response(){const r={statusCode:200,headers:{},data:null};r.setHeader=(k,v)=>{r.headers[k]=v;return r};r.status=n=>{r.statusCode=n;return r};r.json=data=>{r.data=data;return r};return r;}
test('NAVER API HUB requests accept valid dates, fixed groups and refuse duplicates',()=>{
 const req={startDate:'2026-03-01',endDate:'2026-09-01',timeUnit:'week',keywordGroups:[{groupName:'부산맛집',keywords:['부산맛집']},{groupName:'부산횟집',keywords:['부산횟집']}]};
 const data=endpoint.parse(req);
 assert.equal(data.keywordGroups.length,2);
 assert.equal(data.timeUnit,'week');
 assert.throws(()=>endpoint.parse({...req,keywordGroups:[req.keywordGroups[0],req.keywordGroups[0]]}),/중복/);
 assert.throws(()=>endpoint.parse({...req,endDate:'2028-01-01'}),/유효한 날짜/);
 assert.throws(()=>endpoint.parse({...req,keywordGroups:[]}),/1~5개/);
});
test('official provider values retain real relative ratios and source labels',()=>{
 const input={startDate:'2026-01-01',endDate:'2026-02-01',timeUnit:'month'};
 const value=endpoint.parseProvider({results:[{title:'부산맛집',data:[{period:'2026-01-01',ratio:20.5},{period:'2026-02-01',ratio:100}]}]},input);
 assert.equal(value.absoluteVolume,false);
 assert.equal(value.series[0].points[1].ratio,100);
 assert.equal(value.series[0].points[0].ratio,20.5);
});
test('missing official credentials returns honest not-connected state, without fake data',async()=>{
 const old={enabled:process.env.MOMENTUM_DATALAB_ENABLED,display:process.env.MOMENTUM_DATALAB_PUBLIC_DISPLAY_APPROVED};
 process.env.MOMENTUM_DATALAB_ENABLED='false';
 process.env.MOMENTUM_DATALAB_PUBLIC_DISPLAY_APPROVED='false';
 try{
  const res=response();
  await endpoint({method:'POST',headers:{host:'example.com','x-forwarded-for':'test-trends'},body:{startDate:'2026-03-01',endDate:'2026-09-01',timeUnit:'month',keywordGroups:[{groupName:'부산맛집',keywords:['부산맛집']}]}},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.data.status,'not_connected');
  assert.ok(!('series' in res.data));
 }finally{
  for(const [key,v] of [['MOMENTUM_DATALAB_ENABLED',old.enabled],['MOMENTUM_DATALAB_PUBLIC_DISPLAY_APPROVED',old.display]]){if(v===undefined)delete process.env[key];else process.env[key]=v;}
 }
});
test('retired trend explorer paths redirect to the official service',()=>{
 const cfg=JSON.parse(read('vercel.json'));
 for(const source of ['/lab/trends','/lab/trends/','/lab/trends/index.html'])
  assert.ok(cfg.redirects.some(r=>r.source===source&&r.destination==='https://datalab.naver.com/keyword/trendSearch.naver'),'Missing redirect: '+source);
 for(const path of ['lab/trends/index.html','lab/trends/trends.js','lab/trends/trends.css'])
  assert.equal(fs.existsSync(require('node:path').join(root,path)),false,'Legacy trend files must not be deployed: '+path);
 assert.match(read('lab/index.html'),/datalab\.naver\.com\/keyword\/trendSearch\.naver/);
 assert.match(read('api/search-trends.js'),/MOMENTUM_DATALAB_PUBLIC_DISPLAY_APPROVED/);
});
