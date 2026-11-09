'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const settings=JSON.parse(read('vercel.json'));
test('active Momentum LAB menu preserves four selected workflows',()=>{
 const ui=read('site-builder/research-index.html');
 for(const label of ['플레이스 순위 모니터링','월간 키워드 검색량','단건 순위 조회','네이버 데이터랩'])assert.ok(ui.includes(label),label);
 assert.match(ui,/href="\/lab\/rank\/"/);
 assert.match(ui,/\/admin\/research\/api/);
 assert.match(ui,/datalab\.naver\.com/);
 assert.match(ui,/로컬 등록/);
 assert.match(ui,/서버 DB 연결 전/);
});
test('admin research route and browser observation code remain present',()=>{
 for(const file of ['site-builder/research-index.html','api/research-admin.js','api/_research-admin.js','api/rank-rebuild.js','api/_place-observe.js','api/place-rank-live.js'])assert.ok(fs.existsSync(path.join(root,file)),file);
 assert.ok(settings.rewrites.some(x=>x.source==='/admin/research/api'&&x.destination==='/api/research-admin'));
 assert.match(read('api/_research-admin.js'),/require\('\.\/rank-rebuild'\)/);
 assert.match(read('api/_place-observe.js'),/playwright-core/);
});
test('single-place public rank lookup remains connected and quota protected',()=>{
 const html=read('lab/rank/index.html'),js=read('lab/rank/public-rank.js');
 assert.match(html,/\/lab\/rank\/public-rank\.js/);
 assert.match(html,/비회원의 경우 1일 1회/);
 assert.match(js,/\/api\/place-rank-live/);
 assert.ok(fs.existsSync(path.join(root,'api/_public-rank-quota.js')));
 assert.ok(settings.functions['api/place-rank-live.js']);
});
test('the exact nine retired files remain absent and protected routes survive',()=>{
 const removed=['lab/rank/rank.js','lab/customer.js','lab/intel.js','lab/tools-v2.js','lab/studio.js','lab/self-audit.js','api/search-trends.js','api/keyword-opportunities.js','api/rank-watch-cron.js'];
 for(const p of removed)assert.equal(fs.existsSync(path.join(root,p)),false,p);
 assert.match(read('lab/index.html'),/href="\/lab\/rank\/"/);
 assert.ok(settings.rewrites.some(x=>x.source==='/admin/research'));
});
