'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const observer=require('../api/_place-observe.js');
const matrix=require('../api/_rank-keyword-model.js');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'lab/rank/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'lab/rank/rank.js'),'utf8');

const id=n=>String(10000000+n);
test('mobile metadata rank may be far from card order; show observed position only, flagged approximate',()=>{
 const list=[{id:id(1),name:'첫번째',rank:80},{id:id(2),name:'두번째',rank:81},{id:id(3),name:'세번째',rank:82}];
 const result=observer.reduceMobile(list,{id:id(2)});
 assert.equal(result.status,'ranked');
 assert.equal(result.rank,2);
 assert.equal(result.rankApproximate,true);
 assert.equal(result.rankBasis,'visible_mobile_list_order_estimate');
 assert.match(result.message,/약 2번째/);
 assert.doesNotMatch(result.message,/82위/);
 const snap=matrix.reduceMobileList(list);
 assert.equal(snap.entries[1].rank,2);
 assert.equal(snap.entries[1].approximate,true);
});
test('mobile visible positions are consistent only when provider metadata exactly matches every card',()=>{
 const list=[{id:id(1),name:'첫번째',rank:1},{id:id(2),name:'두번째',rank:2},{id:id(3),name:'세번째',rank:3}];
 const result=observer.reduceMobile(list,{id:id(3)});
 assert.equal(result.rank,3);
 assert.equal(result.rankApproximate,false);
 assert.match(result.message,/3번째/);
});
test('different place IDs sharing an identical name are not resolved by guessing a rank',()=>{
 const list=[{id:id(1),name:'우리매장',rank:1},{id:id(2),name:'우리매장',rank:2}];
 const result=observer.reduceMobile(list,{name:'우리매장'});
 assert.equal(result.status,'ambiguous');assert.equal(result.rank,null);
});
test('map telemetry rank reset never implies that page is ten places long',()=>{
 const list=[{id:id(1),rank:1,name:'A'},{id:id(2),rank:2,name:'B'},{id:id(3),rank:1,name:'C'}];
 const result=observer.reduceMap(list,id(3));
 assert.equal(result.rank,3);
 assert.equal(result.rankApproximate,true);
 assert.equal(result.rankBasis,'visible_list_order_estimate');
 assert.doesNotMatch(result.message,/13위|11위|10위 이후/);
});
test('PC map entries missing telemetry rank remain in visible order instead of disappearing',()=>{
 const list=[{id:id(1),rank:1,name:'첫 매장'},{id:id(2),rank:null,name:'둘째 매장'},{id:id(3),rank:3,name:'셋째 매장'}];
 const result=observer.reduceMap(list,id(3));
 assert.equal(result.rank,3);assert.equal(result.observedCount,3);assert.equal(result.rankApproximate,true);
});
test('map observed rank may be definite only as visible list position, not organic search placement',()=>{
 const result=observer.reduceMap([{id:id(1),rank:1},{id:id(2),rank:2}],id(2));
 assert.equal(result.rank,2);
 assert.equal(result.rankApproximate,false);
 assert.match(result.message,/광고 제외 자연검색 순위와 다를 수/);
});
test('ui distinguishes observed position from official rank, preserves source link and marks stale cache',()=>{
 assert.match(html,/최근 관측 위치/);
 assert.match(html,/openObservedSource/);
 assert.match(html,/실제로 읽은 특정 검색 목록/);
 assert.match(js,/sourceUrl:safeObservedSource/);
 assert.match(js,/30분 이내 기존 관측값 재사용/);
 assert.match(js,/추정치 비교 불가/);
 assert.doesNotThrow(()=>new Function('document','window','localStorage','fetch',js));
});
