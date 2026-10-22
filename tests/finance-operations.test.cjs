'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('private finance stays behind existing admin cookie and route',()=>{
 const routes=JSON.parse(read('vercel.json'));
 assert.equal(routes.rewrites.find(x=>x.source==='/admin/finance/').destination,'/api/admin-site-builder?view=finance');
 const handler=read('api/admin-site-builder.js');
 assert.match(handler,/view==='finance'\?'finance-index\.html'/);
 assert.match(handler,/if\(!loggedIn\(req,config\.secret\)\)/);
 assert.match(handler,/finance\.js/);
 assert.match(handler,/finance\.css/);
});
test('finance workspace has safe local-only workflow and displays financial distinctions',()=>{
 const html=read('site-builder/finance-index.html');
 const js=read('site-builder/finance.js');
 assert.match(html,/브라우저 저장 시범 운영/);
 assert.match(html,/계약 판매액/);
 assert.match(html,/계약 예정원가/);
 assert.match(html,/실제 매입 지출/);
 assert.match(html,/계산서 수취 여부/);
 assert.match(html,/periodType/);
 assert.match(js,/momentum-internal-crm-mvp-v1/);
 assert.match(js,/momentum-internal-crm-commerce-v1/);
 assert.match(js,/value===?['"]?year/); // period mode uses exact date prefixes, not arbitrary 30-day time windows
 assert.match(js,/Math\.max\(0,subtotal-moneyField/);
 assert.match(js,/document\.createElement\('td'\)/);
 assert.match(js,/toCsv\(latest\(\)\)/);
 assert.doesNotThrow(()=>new vm.Script(js));
});
