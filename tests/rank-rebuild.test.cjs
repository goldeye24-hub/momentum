'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../api/rank-rebuild.js'),'utf8');
// Mock only the Chromium launch dependencies; no live Naver queries in unit tests.
const moduleShim={exports:{}};
vm.runInNewContext('(function(require,module,exports){'+src+'})', {URL,URLSearchParams,Date,Math,Number,String,RegExp,Map,Promise,setTimeout,clearTimeout})(
 id=>id==='node:crypto'?require('node:crypto'):{},moduleShim,moduleShim.exports
);
const {targetFrom,evaluate,listType}=moduleShim.exports._test;
test('place id parsing',()=>{
 assert.equal(targetFrom('2085358113').id,'2085358113');
 assert.equal(targetFrom('https://m.place.naver.com/restaurant/2085358113').id,'2085358113');
 assert.equal(listType('포항맛집'),'restaurant');
});
test('only business cards are considered, not nested menu li',()=>{
 assert.match(src,/ul\.eDFz9 > li\.UEzoS/);
 assert.doesNotMatch(src,/document\.querySelectorAll\('li'\)/);
 const anchor=(id,name,card)=>({getAttribute:()=>'/restaurant/'+id,closest:()=>card,querySelector:()=>({textContent:name}),innerText:name+'\n주간 인기 많은 메뉴'});
 const card=(id,name)=>{const c={};const a=anchor(id,name,c);c.querySelectorAll=selector=>selector.startsWith('a.vEZDX')?[a]:[];c.querySelector=()=>null;return c};
 const cards=[card('2057035520','호보스피자 효자점'),card('1426422581','널판지 포항영일대점')];
 const a='   const visible=await page.evaluate(()=>{',start=src.indexOf(a),end=src.indexOf('   const before=seen.size;',start);
 assert.ok(start>0&&end>start);
 const section=src.slice(start+a.length,end),body=section.slice(0,section.lastIndexOf('});'));
 const fn=new Function('document',body);
 const result=fn({querySelectorAll:selector=>selector==='ul.eDFz9 > li.UEzoS'?cards:selector==='li'?[...cards, {textContent:'주간 인기 많은 메뉴'}]:[]});
 assert.equal(result.rows.length,2);
 assert.equal(result.rows[0].name,'호보스피자 효자점');
 assert.equal(result.rows[1].id,'1426422581');
});
test('not found is not rank zero, matched id is exact',()=>{
 const rows=[{id:'1426422581',name:'널판지 포항영일대점',providerRank:null,ad:false}];
 assert.equal(evaluate(rows,{id:'2085358113'}).observedPosition,null);
 assert.equal(evaluate(rows,{id:'2085358113'}).status,'not_found_in_sample');
 assert.equal(evaluate([...rows,{id:'2085358113',name:'퐝물회',providerRank:null,ad:false}],{id:'2085358113'}).observedPosition,2);
});
