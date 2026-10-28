'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../api/rank-rebuild.js'),'utf8');
const mocked={exports:{}};
vm.runInNewContext('(function(require,module,exports){'+src+'})',{URL,URLSearchParams,Date,Math,Number,String,RegExp,Map,Promise,setTimeout,clearTimeout})(id=>id==='node:crypto'?require('node:crypto'):{},mocked,mocked.exports);
const {targetFrom,evaluate,listType}=mocked.exports._test;
function readMockedDOM(anchors){
 const marker='   const visible=await page.evaluate(()=>{';
 const start=src.indexOf(marker);
 const end=src.indexOf('   diagnostic.validCardNodes=',start);
 assert.ok(start>=0&&end>start,'parser must be present');
 const section=src.slice(start+marker.length,end);
 const body=section.slice(0,section.lastIndexOf('});'));
 const evaluateInPage=new Function('document',body);
 const doc={querySelectorAll:selector=>{
  if(selector.startsWith('a[href'))return anchors;
  if(selector==='li.UEzoS')return [];
  return [];
 }};
 return evaluateInPage(doc);
}
function anchor(id,name){
 return {
  getAttribute:()=>'/restaurant/'+id+'?entry=pll',
  innerText:name,
  textContent:name,
  matches:()=>false,
  closest:()=>null,
  querySelector:()=>null,
  querySelectorAll:()=>[]
 };
}
test('accepts valid Place ID and valid restaurant URL',()=>{
 assert.equal(targetFrom('2085358113').id,'2085358113');
 assert.equal(targetFrom('https://m.place.naver.com/restaurant/2085358113').id,'2085358113');
 assert.equal(listType('포항영일대맛집'),'restaurant');
});
test('collect real business links even if li.UEzoS and a.vEZDX are absent',()=>{
 const anchors=Array.from({length:118},(_,i)=>anchor(String(2000000000+i),'식당 '+(i+1)));
 anchors[85]=anchor('2085358113','퐝물회');
 anchors.push(anchor('9999999999','주간 인기 많은 메뉴'));
 const result=readMockedDOM(anchors);
 assert.equal(result.liClassMatches,0);
 assert.equal(result.rawBusinessLinks,119);
 assert.equal(result.rows.length,118);
 assert.equal(result.rows[85].id,'2085358113');
 assert.ok(!result.rows.some(x=>x.name==='주간 인기 많은 메뉴'));
});
test('target absent is unknown, not rank zero or non-exposure',()=>{
 const rows=[{id:'1426422581',name:'널판지 포항영일대점',providerRank:null,ad:false}];
 assert.equal(evaluate(rows,{id:'2085358113'}).observedPosition,null);
 assert.equal(evaluate(rows,{id:'2085358113'}).status,'not_found_in_sample');
 assert.equal(evaluate([...rows,{id:'2085358113',name:'퐝물회',providerRank:null,ad:false}],{id:'2085358113'}).observedPosition,2);
});
