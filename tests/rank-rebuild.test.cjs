'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../api/rank-rebuild.js'),'utf8');
const shim={exports:{}};
vm.runInNewContext('(function(require,module,exports){'+src+'})',{
 URL,URLSearchParams,Date,Math,Number,String,RegExp,Map,Promise,setTimeout,clearTimeout
})(id=>id==='node:crypto'?require('node:crypto'):{},shim,shim.exports);
const {targetFrom,evaluate,listType}=shim.exports._test;
function parse(anchors){
 const mark='   const visible=await page.evaluate(()=>{';
 const start=src.indexOf(mark),end=src.indexOf('   diagnostic.validCardNodes=',start);
 assert.ok(start>=0&&end>start);
 const part=src.slice(start+mark.length,end);
 const fn=new Function('document',part.slice(0,part.lastIndexOf('});')));
 return fn({querySelectorAll:q=>q.startsWith('a[href')?anchors:[]});
}
function cardLink(id,name,parent){
 const li=parent?{parentElement:parent,querySelector:()=>null,querySelectorAll:()=>[]}:null;
 return {
  getAttribute:()=>'/restaurant/'+id+'?entry=pll',
  innerText:name,textContent:name,
  matches:()=>false,
  classList:{contains:()=>false},
  closest:()=>li,
  querySelector:()=>({textContent:name}),
  querySelectorAll:()=>[]
 };
}
test('place target and keyword parsing',()=>{
 assert.equal(targetFrom('2085358113').id,'2085358113');
 assert.equal(targetFrom('https://m.place.naver.com/restaurant/2085358113').id,'2085358113');
 assert.equal(listType('포항맛집'),'restaurant');
});
test('ignore links outside the main result list even when they precede the target',()=>{
 const list={className:'lst_place',matches:()=>true};
 const promos={className:'recommended',matches:()=>true};
 const extras=Array.from({length:8},(_,i)=>cardLink(String(3000000000+i),'추천매장 '+(i+1),promos));
 const cards=Array.from({length:110},(_,i)=>cardLink(
  i===105?'2085358113':String(2000000000+i),i===105?'퐝물회':'매장 '+(i+1),list
 ));
 const parsed=parse([...extras,...cards]);
 assert.equal(parsed.rawBusinessLinks,118);
 assert.equal(parsed.rows.length,110);
 assert.equal(parsed.rows.findIndex(x=>x.id==='2085358113')+1,106);
 assert.equal(parsed.rankedGroupCandidates[0].container,'lst_place');
});
test('link alone is insufficient to report rank',()=>{
 const parsed=parse([cardLink('2085358113','퐝물회',null)]);
 assert.equal(parsed.rows.length,0);
 assert.equal(parsed.rankListConfirmed,false);
 assert.equal(parsed.rawEntries[0].id,'2085358113');
});
test('menu text must not turn into a business card',()=>{
 const list={className:'lst_place',matches:()=>true};
 const cards=Array.from({length:15},(_,i)=>cardLink(String(2000000000+i),'매장 '+(i+1),list));
 const parsed=parse([...cards,cardLink('9999999999','주간 인기 많은 메뉴',list)]);
 assert.equal(parsed.rows.length,15);
});
test('not found in sample is not a verified 0th or unlisted ranking',()=>{
 const rows=[{id:'1426422581',name:'널판지 포항영일대점',providerRank:null,ad:false}];
 assert.equal(evaluate(rows,{id:'2085358113'}).observedPosition,null);
 assert.equal(evaluate(rows,{id:'2085358113'}).status,'not_found_in_sample');
});
