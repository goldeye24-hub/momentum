'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const config=JSON.parse(read('vercel.json'));
test('search trend menu uses the official Naver DataLab rather than an unconfigured proxy API',()=>{
 assert.match(read('site-builder/research-index.html'),/https:\/\/datalab\.naver\.com\/keyword\/trendSearch\.naver/);
 for(const p of ['/lab/trends','/lab/trends/','/lab/trends/index.html'])assert.equal(config.redirects.find(x=>x.source===p)?.destination,'https://datalab.naver.com/keyword/trendSearch.naver');
 assert.equal(fs.existsSync(path.join(root,'api/search-trends.js')),false);
});
test('retired search-volume proxy is absent while the administrator research interface remains',()=>{
 assert.equal(fs.existsSync(path.join(root,'api/keyword-opportunities.js')),false);
 assert.equal(fs.existsSync(path.join(root,'api/research-admin.js')),true);
 assert.match(read('site-builder/research-index.html'),/월간 키워드 검색량/);
});
