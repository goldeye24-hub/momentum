'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const config=JSON.parse(read('vercel.json'));
const gone=[
 'site-builder/advertisers-index.html','site-builder/advertisers.css','site-builder/advertisers.js',
 'site-builder/suppliers-index.html','site-builder/suppliers.css','site-builder/suppliers.js',
 'site-builder/crm-index.html','site-builder/crm.css','site-builder/crm.js','site-builder/crm-commerce.js',
 'site-builder/finance-index.html','site-builder/finance.css','site-builder/finance.js',
 'site-builder/design-editor.html','site-builder/design-editor.css','site-builder/design-editor.js',
 'site-builder/index.html','site-builder/editor.css','site-builder/editor.js','site-builder/kit.js',
 'site-builder/presets.json','site-builder/site-template.css','site-builder/products.json',
 'internal/site-studio-admin-setup.md',
 'tests/advertiser-quantities.test.cjs','tests/advertiser-renewal.test.cjs','tests/crm-flexible-products.test.cjs',
 'tests/studio.browser.cjs','tests/lab.test.cjs','tests/production-browser.cjs'
];
const active=[
 'site-builder/research-index.html','site-builder/rank-watch-index.html',
 'site-builder/keyword-matrix-index.html','site-builder/place-keyword-insights-index.html',
 'site-builder/competitor-compare-index.html','site-builder/connection-index.html',
 'api/admin-site-builder.js','api/_research-admin.js','api/research-admin.js',
 'api/rank-rebuild.js','api/_place-observe.js','api/compact.js',
 'api/inquiries.js','private-keyword-workbench/index.html','index.html'
];
test('legacy business/admin pages removed, protected research and public website untouched',()=>{
 for(const p of gone)assert.equal(fs.existsSync(path.join(root,p)),false,p);
 for(const p of active)assert.equal(fs.existsSync(path.join(root,p)),true,p);
 const obsolete=['overview','studio','advertisers','suppliers','crm','finance','designs'];
 for(const name of obsolete)for(const suffix of ['','/']){
  const route='/admin/'+name+suffix;
  assert.ok(!config.rewrites.some(x=>x.source===route),'retired admin route '+route);
 }
 for(const route of ['/admin/','/admin/login','/admin/logout','/admin/research/','/admin/research/api',
   '/admin/watches/','/admin/watches/api','/admin/keyword-matrix/api','/admin/place-insights/api',
   '/admin/competitors/api','/private/kw/:access']){
  assert.ok(config.rewrites.some(x=>x.source===route),route);
 }
 const app=read('api/admin-site-builder.js'),lab=read('api/_research-admin.js');
 assert.match(app,/module\.exports\.isAuthorized/);
 assert.match(lab,/require\('\.\/rank-rebuild'\)/);
 assert.match(read('api/rank-rebuild.js'),/@sparticuz\/chromium/);
 assert.match(read('site-builder/research-index.html'),/scan-rank-direct/);
 assert.ok(!app.includes('crm-index.html'));
 assert.ok(!app.includes('design-editor.html'));
 assert.ok(!read('site-builder/operations-index.html').includes('/admin/crm/'));
 assert.ok(config.functions['api/research-admin.js'].includeFiles.includes('chromium'));
});
function res(){
 return {statusCode:200,headers:{},body:'',
  setHeader(k,v){this.headers[k]=v},end(body){this.body=String(body||'');return this}};
}
async function env(callback){
 const keys=['MOMENTUM_ADMIN_PASSWORD','MOMENTUM_SESSION_SECRET'],prev=keys.map(k=>process.env[k]);
 process.env.MOMENTUM_ADMIN_PASSWORD='Test-only-admin-password-2026!';
 process.env.MOMENTUM_SESSION_SECRET='r'.repeat(64);
 try{return await callback()}finally{keys.forEach((k,i)=>{if(prev[i]===undefined)delete process.env[k];else process.env[k]=prev[i]})}
}
test('admin session still grants research access while deleted screens return 404',async()=>env(async()=>{
 const handler=require('../api/admin-site-builder');
 const hostname='momentum-orcin-delta.vercel.app';
 const login=res();
 await handler({method:'POST',query:{action:'login'},
  headers:{origin:'https://'+hostname,host:hostname},
  body:{password:'Test-only-admin-password-2026!'}},login);
 assert.equal(login.statusCode,303);
 const cookie=login.headers['Set-Cookie'].split(';')[0];
 assert.match(cookie,/momentum_admin_session=/);
 for(const query of [{},{view:'research'},{view:'watches'}]){
  const r=res();await handler({method:'GET',query,headers:{cookie}},r);
  assert.equal(r.statusCode,200,JSON.stringify(query));
  assert.match(r.body,/플레이스|순위/);
 }
 for(const query of [{view:'studio'},{view:'crm'},{view:'advertisers'},{view:'finance'},{view:'designs'},{asset:'crm.js'},{asset:'editor.js'}]){
  const r=res();await handler({method:'GET',query,headers:{cookie}},r);
  assert.equal(r.statusCode,404,JSON.stringify(query));
 }
 const anon=res();await handler({method:'GET',query:{view:'research'},headers:{}},anon);
 assert.equal(anon.statusCode,200);
 assert.match(anon.body,/관리자 로그인/);
}));
