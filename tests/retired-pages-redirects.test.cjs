'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const config=JSON.parse(read('vercel.json')),redirect=p=>config.redirects.find(x=>x.source===p);
test('retired free-tool, advertising and about URLs all redirect to modern landing page',()=>{
 for(const p of ['/lab','/lab/','/lab/index.html','/lab/rank','/lab/rank/','/lab/rank/index.html','/services/search-ads','/services/search-ads/','/services/search-ads/index.html','/about/','/industries/','/lab/keywords/','/rank-rebuild/'])
  assert.equal(redirect(p)?.destination,'/',p);
});
test('official DataLab, portfolio demos and administrator APIs are retained',()=>{
 for(const p of ['/lab/trends','/lab/trends/','/lab/trends/index.html'])
  assert.equal(redirect(p)?.destination,'https://datalab.naver.com/keyword/trendSearch.naver',p);
 for(const p of ['/website-samples','/website-samples/','/website-samples/index.html'])
  assert.equal(redirect(p)?.destination,'/portfolio/conversion/',p);
 for(const p of ['index.html','insights/index.html','portfolio/index.html','api/inquiries.js','api/_place-observe.js','api/rank-rebuild.js','api/research-admin.js','site-builder/research-index.html'])
  assert.ok(fs.existsSync(path.join(root,p)),p);
 assert.ok(config.rewrites.some(x=>x.source==='/admin/research/api'&&x.destination==='/api/research-admin'));
});
