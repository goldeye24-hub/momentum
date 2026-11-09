'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const config=JSON.parse(read('vercel.json')),redirect=p=>config.redirects.find(x=>x.source===p);
test('legacy keyword URLs preserve their original destination',()=>{
 for(const p of ['/lab/keywords','/lab/keywords/','/lab/keywords/index.html'])assert.equal(redirect(p)?.destination,'/lab/');
 for(const p of ['lab/keywords/index.html','lab/keywords/keywords.js','lab/keywords/keywords.css'])assert.equal(fs.existsSync(path.join(root,p)),false);
});
test('retired DataLab pages and samples preserve external links',()=>{
 for(const p of ['/lab/trends','/lab/trends/','/lab/trends/index.html'])assert.equal(redirect(p)?.destination,'https://datalab.naver.com/keyword/trendSearch.naver');
 for(const p of ['/website-samples','/website-samples/','/website-samples/index.html'])assert.equal(redirect(p)?.destination,'/portfolio/conversion/');
 assert.match(read('lab/index.html'),/datalab\.naver\.com\/keyword\/trendSearch\.naver/);
});
test('nine obsolete assets and endpoints removed without changing active public and admin entrypoints',()=>{
 const removed=['lab/rank/rank.js','lab/customer.js','lab/intel.js','lab/tools-v2.js','lab/studio.js','lab/self-audit.js','api/search-trends.js','api/keyword-opportunities.js','api/rank-watch-cron.js'];
 for(const p of removed)assert.equal(fs.existsSync(path.join(root,p)),false,p+' should be removed');
 for(const p of ['lab/index.html','lab/rank/index.html','lab/rank/public-rank.js','api/place-rank-live.js','api/rank-rebuild.js','api/research-admin.js','api/_research-admin.js','site-builder/research-index.html','site-builder/index.html','insights/index.html','sitemap.xml'])assert.equal(fs.existsSync(path.join(root,p)),true,p+' should remain');
 assert.match(read('lab/rank/index.html'),/\/lab\/rank\/public-rank\.js/);
 assert.equal(config.rewrites.some(x=>x.source==='/admin/research/api'&&x.destination==='/api/research-admin'),true);
});
test('obsolete one-off rank page redirects to the live single-lookup screen',()=>{
 assert.equal(redirect('/rank-rebuild/')?.destination,'/lab/rank/');
 assert.equal(redirect('/rank-rebuild')?.destination,'/lab/rank/');
 assert.match(read('site-builder/research-index.html'),/href="\/lab\/rank\/"/);
});
