'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../site-builder/advertisers.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../site-builder/advertisers-index.html'),'utf8');
const crm=fs.readFileSync(path.join(__dirname,'../site-builder/crm.js'),'utf8');
const crmHtml=fs.readFileSync(path.join(__dirname,'../site-builder/crm-index.html'),'utf8');
const nextDay=n=>{let d=new Date(),x=new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);return [x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-')};
function setup(){
 const ids=['advertiserSearch','stageFilter','sortFilter','refreshList','metricTotal','metricContracted','metricFollowup','metricExpiring','resultCount','emptyState','advertiserRows','closeDetails','closeDetailsBottom','detailsDialog','detailTitle','detailContent','editAdvertiser','actionCount','actionQueue','contractSearch','contractActionFilter','scheduleCount','scheduleEmpty','contractScheduleRows'];
 const elements={};
 for(const id of ids)elements[id]={value:id==='sortFilter'?'name':id==='contractActionFilter'?'all':'',innerHTML:'',textContent:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn},showModal(){this.open=true},close(){this.open=false},focus(){}};
 const storage={
  'momentum-internal-crm-mvp-v1':JSON.stringify({customers:[{id:'1',name:'테스트점포',stage:'계약고객'}],
   contracts:[{id:'a',customerId:'1',productId:'p1',status:'진행중',signedDate:nextDay(-20),endDate:nextDay(7),amount:300000,paid:100000},
    {id:'b',customerId:'1',productId:'p2',status:'계약',endDate:nextDay(20),amount:200000,paid:0}],customProducts:[]}),
  'momentum-internal-crm-commerce-v1':JSON.stringify({bundles:[{id:'c',customerId:'1',status:'계약',title:'복합 상품',signedDate:nextDay(-15),
   endDate:nextDay(14),lines:[{productId:'p1',productName:'체험단',quantity:3,unit:'팀',unitPrice:100000,endDate:nextDay(7)}]}]})
 };
 const doc={readyState:'complete',getElementById:id=>elements[id],addEventListener(){}};
 const win={addEventListener(){},confirm(){return true},alert(){}};
 const local={getItem:key=>storage[key]||null,setItem(key,value){storage[key]=value}};
 const location={assign(url){this.url=url}};
 const fetch=async()=>({ok:true,json:async()=>({products:[{id:'p1',name:'검색광고'},{id:'p2',name:'홈페이지 제작'}]})});
 new Function('document','window','localStorage','sessionStorage','fetch','location',script)(doc,win,local,{setItem(){}},fetch,location);
 return {elements,storage};
}
test('renewal check defaults to exactly 7 days before expiry and shows actionable contract row',async()=>{
 const {elements}=setup();for(let i=0;i<8;i++)await Promise.resolve();
 assert.equal(elements.actionCount.textContent,'2건');
 assert.match(elements.actionQueue.innerHTML,/재연장 확인 필요/);
 assert.ok(elements.actionQueue.innerHTML.includes('재연장 확인일 '+nextDay(0)));
 assert.match(elements.contractScheduleRows.innerHTML,/검색광고/);
 assert.match(elements.contractScheduleRows.innerHTML,/체험단/);
 assert.match(elements.contractScheduleRows.innerHTML,/300,000/);
 assert.ok(html.includes('id="contractSchedule"'));
});
test('confirming renewal check records action without changing dates or amounts',async()=>{
 const {elements,storage}=setup();for(let i=0;i<8;i++)await Promise.resolve();
 elements.actionQueue.handlers.click({target:{closest(){return {dataset:{markRenewal:'a',markKind:'single'}}}}});
 const contract=JSON.parse(storage['momentum-internal-crm-mvp-v1']).contracts[0];
 assert.equal(contract.renewalCheckedAt,nextDay(0));
 assert.equal(contract.endDate,nextDay(7));
 assert.equal(contract.amount,300000);
 assert.equal(elements.actionCount.textContent,'1건');
});
test('CRM form saves separate renewal date and past dates remain distinguishable',()=>{
 assert.match(crmHtml,/name="renewalCheckDate"/);
 assert.match(crm,/renewalCheckDate:normalizeDate\(d\.renewalCheckDate\)/);
 assert.match(crm,/renewalCheckedAt:old/);
 assert.match(script,/function checkDate/);
});
