'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const settings=JSON.parse(read('vercel.json'));
test('protected admin research retains the live browser observer without retired public menu',()=>{
 const ui=read('site-builder/research-index.html');
 for(const label of ['플레이스 순위 모니터링','월간 키워드 검색량','네이버 데이터랩'])assert.ok(ui.includes(label),label);
 assert.ok(!ui.includes('href="/lab/rank/"'));
 assert.ok(ui.includes('/admin/research/api'));
 for(const p of ['site-builder/research-index.html','api/research-admin.js','api/_research-admin.js','api/rank-rebuild.js','api/_place-observe.js','api/_rank-live-shared.js'])
  assert.ok(fs.existsSync(path.join(root,p)),p);
 assert.ok(settings.rewrites.some(x=>x.source==='/admin/research/api'&&x.destination==='/api/research-admin'));
 assert.ok(read('api/_research-admin.js').includes("require('./rank-rebuild')"));
});
test('public Chromium function retired, admin Chromium and original CRM functions preserved',()=>{
 for(const p of ['api/place-rank-live.js','api/_public-rank-quota.js','lab/rank/index.html','lab/rank/public-rank.js'])
  assert.equal(fs.existsSync(path.join(root,p)),false,p);
 assert.equal(settings.functions['api/place-rank-live.js'],undefined);
 assert.ok(settings.functions['api/research-admin.js'].includeFiles.includes('chromium'));
 for(const p of ['server-handlers/admin-rank-watches.js','server-handlers/admin-keyword-matrix.js','api/compact.js','api/admin-site-builder.js','api/inquiries.js'])
  assert.ok(fs.existsSync(path.join(root,p)),p);
});
