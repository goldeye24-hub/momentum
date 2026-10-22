'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dataLab=require('../server-handlers/datalab-trend');
test('DataLab only accepts one to three distinct keywords and fixed periods',()=>{
 const safe=dataLab.sanitize({keywords:['부산맛집','부산카페'],months:12,timeUnit:'month'});
 assert.deepEqual(safe,{kw:['부산맛집','부산카페'],months:12,timeUnit:'month'});
 assert.throws(()=>dataLab.sanitize({keywords:['맛집','맛집']}),/중복/);
 assert.throws(()=>dataLab.sanitize({keywords:['a','b','c','d']}),/1~3/);
 assert.throws(()=>dataLab.sanitize({keywords:['abc'],months:17}),/기간/);
 assert.throws(()=>dataLab.sanitize({keywords:['<script>']}),/검색어/);
});
test('DataLab uses official endpoint and preserves numeric relative trends',async()=>{
 let request;
 const fakeFetch=async(url,options)=>{
   request={url,options};
   return {ok:true,json:async()=>({results:[{title:'부산맛집',data:[{period:'2026-09-01',ratio:53.2},{period:'2026-10-01',ratio:100}]}]})};
 };
 const result=await dataLab.callProvider({kw:['부산맛집'],months:3,timeUnit:'month'},
   {NAVER_CLIENT_ID:'test-id',NAVER_CLIENT_SECRET:'test-secret'},fakeFetch);
 assert.equal(request.url,'https://openapi.naver.com/v1/datalab/search');
 assert.equal(request.options.headers['X-Naver-Client-Id'],'test-id');
 assert.equal(JSON.parse(request.options.body).keywordGroups[0].groupName,'부산맛집');
 assert.deepEqual(result.series[0].points.map(x=>x.ratio),[53.2,100]);
 assert.match(result.note,/상대/);
});
test('DataLab does not synthesize results without API credentials',async()=>{
 let called=false;
 const output=await dataLab.callProvider({kw:['부산맛집'],months:12,timeUnit:'month'},{},async()=>{called=true;});
 assert.equal(output.status,503);
 assert.equal(called,false);
});
test('Marketing homepage prioritizes ads, separates free and paid services, and links agency',()=>{
 const home=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.match(home,/agency-brand-2026\.css/);
 assert.match(home,/mm-intelligence-board/);
 assert.ok(home.includes('10<span>+</span>'));
 assert.match(home,/href="\/lab\/trends\/"/);
 assert.match(home,/id="open-packages"/);
 assert.match(home,/id="contact"/);
 assert.match(home,/id="requestedProduct"/);
 assert.match(home,/id="services"/);
 assert.match(home,/id="free-tools"/);
 assert.match(home,/id="paid-service"/);
 assert.ok(home.includes('href="/agency/"'));
 assert.doesNotMatch(home,/id="work"|WEBSITE DESIGN LIBRARY/);
 assert.doesNotMatch(home,/지식iN 상위노출|지식인 상위노출/);
});
