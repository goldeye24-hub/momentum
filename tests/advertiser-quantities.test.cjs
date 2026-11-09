'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function mount(){
 const ids=['advertiserSearch','stageFilter','sortFilter','refreshList','metricTotal','metricContracted','metricFollowup','metricExpiring','resultCount','emptyState','advertiserRows','closeDetails','closeDetailsBottom','detailsDialog','detailTitle','detailContent','editAdvertiser','actionCount','actionQueue','contractSearch','contractActionFilter','scheduleCount','scheduleEmpty','contractScheduleRows'];
 const elements={};
 for(const id of ids)elements[id]={
  value:id==='sortFilter'?'name':id==='contractActionFilter'?'all':'',
  textContent:'',innerHTML:'',hidden:false,handlers:{},
  addEventListener(type,fn){this.handlers[type]=fn},
  showModal(){this.open=true},close(){this.open=false},focus(){}
 };
 const date=n=>{const d=new Date(),v=new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);return [v.getFullYear(),String(v.getMonth()+1).padStart(2,'0'),String(v.getDate()).padStart(2,'0')].join('-')};
 const data={
  'momentum-internal-crm-mvp-v1':JSON.stringify({customers:[{id:'c1',name:'가상 고깃집',stage:'계약고객'},{id:'c2',name:'이전 계약 업체',stage:'계약고객'}],contracts:[
   {id:'s1',customerId:'c1',productId:'p1',status:'진행중',endDate:date(7),amount:300000,quantity:10,usedQuantity:3,unit:'건'},
   {id:'s2',customerId:'c2',productId:'p2',status:'계약',endDate:date(25),amount:100000}
  ],customProducts:[]}),
  'momentum-internal-crm-commerce-v1':JSON.stringify({bundles:[{id:'b1',customerId:'c1',title:'복합 캠페인',status:'진행중',endDate:date(7),lines:[
   {productId:'p1',productName:'체험단',quantity:8,unit:'팀',unitPrice:10000,usageLog:[{quantity:2},{quantity:4,canceled:true},{quantity:1}]},
   {productId:'p2',productName:'상세페이지',quantity:1,unit:'개',unitPrice:150000,usageLog:[]}
  ]}]})
 };
 const document={readyState:'complete',getElementById:id=>elements[id],addEventListener(){}};
 const window={addEventListener(){},confirm(){return true},alert(){}};
 const localStorage={getItem:key=>data[key]||null,setItem(key,value){data[key]=value}};
 const fetch=async()=>({ok:true,json:async()=>({products:[{id:'p1',name:'블로그 기자단'},{id:'p2',name:'상세페이지 제작'}]})});
 new Function('document','window','localStorage','sessionStorage','fetch','location',read('site-builder/advertisers.js'))(
  document,window,localStorage,{setItem(){}},fetch,{assign(){}}
 );
 return {elements,data};
}
test('single contracts show contracted, consumed and remaining quantities',async()=>{
 const {elements}=mount();
 for(let i=0;i<12;i++)await Promise.resolve();
 const text=elements.contractScheduleRows.innerHTML;
 assert.match(text,/계약 <b>10건<\/b>/);
 assert.match(text,/사용 <b>3건<\/b>/);
 assert.match(text,/잔여 <b>7건<\/b>/);
 assert.match(text,/수량 미등록/);
 assert.match(read('site-builder/advertisers-index.html'),/계약·사용·잔여수량/);
});
test('bundle usage excludes canceled logs and preserves each product unit',async()=>{
 const {elements}=mount();
 for(let i=0;i<12;i++)await Promise.resolve();
 const text=elements.contractScheduleRows.innerHTML;
 assert.match(text,/계약 <b>8팀<\/b>/);
 assert.match(text,/사용 <b>3팀<\/b>/);
 assert.match(text,/잔여 <b>5팀<\/b>/);
 assert.match(text,/계약 <b>1개<\/b>/);
 assert.match(text,/잔여 <b>1개<\/b>/);
});
test('same quantity data appears in contract detail and prioritized renewal queue',async()=>{
 const {elements}=mount();
 for(let i=0;i<12;i++)await Promise.resolve();
 elements.advertiserRows.handlers.click({target:{closest:()=>({dataset:{detail:'c1'}})}});
 assert.match(elements.detailContent.innerHTML,/계약수량 · 사용수량 · 잔여수량/);
 assert.match(elements.detailContent.innerHTML,/잔여 <b>7건<\/b>/);
 assert.match(elements.actionQueue.innerHTML,/잔여 <b>7건<\/b>/);
});
test('single contract edit includes independent quantity and usage fields and validation',()=>{
 const html=read('site-builder/crm-index.html');
 const js=read('site-builder/crm.js');
 for(const name of ['quantity','usedQuantity','unit'])assert.match(html,new RegExp('name="'+name+'"'));
 assert.match(js,/사용수량은 계약수량을 초과할 수 없습니다/);
 assert.match(js,/quantity:qtyValue\(x\.quantity\)/);
 assert.match(js,/usedQuantity:qtyValue\(x\.usedQuantity\)/);
});
