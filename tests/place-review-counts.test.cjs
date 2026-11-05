'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../api/_place-review-counts.js'),'utf8');
const moduleRef={exports:{}};
const factory=vm.runInNewContext('(function(require,module,exports){'+source+'})',{URL,Date,Map,Number,String,Array,JSON,RegExp,console});
factory(id=>id==='playwright-core'?{}:id==='@sparticuz/chromium'?{}:{},moduleRef,moduleRef.exports);
const {numberFrom,fromEvidence}=moduleRef.exports._test;
test('distinct public visitor and blog review counts',()=>{
 assert.equal(numberFrom('방문자 리뷰 7,790','visitor'),7790);
 assert.equal(numberFrom('블로그 리뷰 4,518','blog'),4518);
 assert.equal(numberFrom('예약 리뷰 46','visitor'),null);
 assert.equal(numberFrom('리뷰 46','blog'),null);
});
test('unknown remains null rather than zero',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(fromEvidence([]))),{visitorCount:null,blogCount:null});
});
test('only count unambiguous label from a matching review link',()=>{
 const evidence=[
  {source:'link',type:'visitor',hrefType:'visitor',text:'방문자 리뷰 7,790'},
  {source:'link',type:'blog',hrefType:'blog',text:'블로그 리뷰 4518'},
  {source:'link',type:'visitor',hrefType:'visitor',text:'예약 리뷰 46'}
 ];
 assert.deepEqual(JSON.parse(JSON.stringify(fromEvidence(evidence))),{visitorCount:7790,blogCount:4518});
});
test('conflicting same-label count is not trusted',()=>{
 assert.equal(numberFrom('방문자 리뷰 20 방문자 리뷰 30','visitor'),null);
});

test('public description metadata shows visitor and blog review totals separately',()=>{
 const evidence=[{source:'metadata',type:'both',text:'방문자리뷰 3,292 · 블로그리뷰 4,510'}];
 assert.deepEqual(JSON.parse(JSON.stringify(fromEvidence(evidence))),{visitorCount:3292,blogCount:4510});
});
test('public description does not confuse review totals with keyword evaluations',()=>{
 const evidence=[
  {source:'metadata',type:'both',text:'방문자리뷰 3,292 · 블로그리뷰 4,510'},
  {source:'label',type:'visitor',text:'이런 점이 좋았어요 3,065회'}
 ];
 assert.deepEqual(JSON.parse(JSON.stringify(fromEvidence(evidence))),{visitorCount:3292,blogCount:4510});
});
test('contradictory labelled review totals do not return fabricated counts',()=>{
 const evidence=[
  {source:'metadata',type:'both',text:'방문자리뷰 3,292 · 블로그리뷰 4,510'},
  {source:'link',type:'visitor',hrefType:'visitor',text:'방문자 리뷰 3,290'}
 ];
 assert.deepEqual(JSON.parse(JSON.stringify(fromEvidence(evidence))),{visitorCount:null,blogCount:4510});
});
