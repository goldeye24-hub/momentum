'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const script=fs.readFileSync('site-builder/crm.js','utf8');
const start=script.indexOf('function icsEscape(');
const end=script.indexOf('function setup(){',start);
assert.ok(start>=0&&end>start,'CRM calendar logic should be present');
const calendarLogic=script.slice(start,end);

function runCalendar({contracts=[],bundles=[],customers=[{id:'customer-1',name:'부산 테스트 식당'}]}={}){
 const output=[],messages=[];
 const data={contracts};
 const context={
  db:data,
  window:{MomentumCommerce:{read:()=>({bundles})}},
  customer:id=>customers.find(c=>c.id===id),
  product:id=>({name:id}),
  daysUntil:date=>Math.round((new Date(date+'T12:00:00')-new Date('2026-10-15T12:00:00'))/86400000),
  dl:(filename,body,mime)=>output.push({filename,body,mime}),
  message:value=>messages.push(value),
 };
 vm.runInNewContext(calendarLogic,context,{timeout:2000});
 context.calendar();
 return {output,messages};
}

test('calendar exports single contract, domain and bundled product dates',()=>{
 const result=runCalendar({
  contracts:[{id:'single-1',customerId:'customer-1',productId:'홈페이지 제작',status:'진행중',endDate:'2026-11-15',domainEnd:'2027-01-01'}],
  bundles:[{id:'bundle-1',customerId:'customer-1',title:'가을 온라인 광고',status:'진행중',endDate:'2026-12-01',lines:[
   {id:'line-1',productId:'blog',productName:'블로그체험단',endDate:'2026-11-05'},
   {id:'line-2',productId:'reels',productName:'릴스 제작',endDate:''}
  ]}]
 });
 assert.equal(result.output.length,1);
 const {filename,body,mime}=result.output[0];
 assert.equal(filename,'momentum-contract-renewals.ics');
 assert.equal(mime,'text/calendar');
 assert.equal((body.match(/BEGIN:VEVENT/g)||[]).length,4);
 assert.match(body,/DTSTART;VALUE=DATE:20261115/);
 assert.match(body,/DTSTART;VALUE=DATE:20270101/);
 assert.match(body,/DTSTART;VALUE=DATE:20261105/);
 assert.match(body,/DTSTART;VALUE=DATE:20261201/);
 assert.match(body,/UID:bundle-bundle-1-line-2-renewal@momentum-crm/);
 assert.match(body,/블로그체험단 묶음계약 만료/);
 assert.equal((body.match(/BEGIN:VALARM/g)||[]).length,12);
});

test('calendar does not schedule draft, ended, expired or unlinked bundles',()=>{
 const result=runCalendar({
  bundles:[
   {id:'draft',customerId:'customer-1',title:'초안',status:'견적',endDate:'2026-12-01',lines:[{id:'l1',productName:'상품',endDate:''}]},
   {id:'ended',customerId:'customer-1',title:'완료',status:'종료',endDate:'2026-12-01',lines:[{id:'l2',productName:'상품',endDate:''}]},
   {id:'expired',customerId:'customer-1',title:'과거',status:'계약',endDate:'2026-09-01',lines:[{id:'l3',productName:'상품',endDate:''}]},
   {id:'unknown',customerId:'missing',title:'다른 고객',status:'계약',endDate:'2026-12-01',lines:[{id:'l4',productName:'상품',endDate:''}]},
  ]
 });
 assert.equal(result.output.length,0);
 assert.match(result.messages.join(' '),/미래 만료일/);
});

test('calendar escapes customer text to avoid injecting extra ICS fields',()=>{
 const result=runCalendar({
  customers:[{id:'customer-1',name:'테스트,업체\nLOCATION:fake'}],
  bundles:[{id:'safe',customerId:'customer-1',title:'설명;확인',status:'계약',endDate:'2026-12-01',lines:[{id:'item',productName:'광고',endDate:''}]}]
 });
 assert.equal(result.output.length,1);
 const body=result.output[0].body;
 assert.match(body,/SUMMARY:테스트\\,업체\\nLOCATION:fake/);
 assert.match(body,/DESCRIPTION:모멘텀마케팅 묶음 계약/);
 assert.match(body,/설명\\;확인/);
 assert.equal((body.match(/\r\nLOCATION:fake/g)||[]).length,0);
});
