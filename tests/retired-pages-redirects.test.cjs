'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const cfg=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const redirect=source=>cfg.redirects.find(x=>x.source===source);
test('legacy keyword pages and static assets removed with complete redirect coverage',()=>{
 for(const file of ['lab/keywords/index.html','lab/keywords/keywords.js','lab/keywords/keywords.css'])
  assert.equal(fs.existsSync(path.join(root,file)),false,file+' is still present');
 for(const url of ['/lab/keywords','/lab/keywords/','/lab/keywords/index.html'])
  assert.equal(redirect(url)?.destination,'/lab/',url);
});
test('legacy trend pages removed; direct index URL also redirects to Naver DataLab',()=>{
 for(const file of ['lab/trends/index.html','lab/trends/trends.js','lab/trends/trends.css'])
  assert.equal(fs.existsSync(path.join(root,file)),false,file+' is still present');
 for(const url of ['/lab/trends','/lab/trends/','/lab/trends/index.html'])
  assert.equal(redirect(url)?.destination,'https://datalab.naver.com/keyword/trendSearch.naver',url);
});
test('retired website sample landing has an explicit destination even for /index.html',()=>{
 assert.equal(fs.existsSync(path.join(root,'website-samples/index.html')),false);
 for(const url of ['/website-samples','/website-samples/','/website-samples/index.html'])
  assert.equal(redirect(url)?.destination,'/portfolio/conversion/',url);
 for(const url of ['/website-samples/restaurant/','/website-samples/poolvilla/'])
  assert.ok(redirect(url),'Retired campaign URL redirect must remain '+url);
});
test('public ranking, admin site builder, marketing insights, and original APIs are untouched',()=>{
 for(const file of ['lab/rank/index.html','lab/rank/public-rank.js','lab/rank/rank.js',
     'api/place-rank-live.js','api/search-trends.js','api/keyword-opportunities.js',
     'api/blog-rank-observation.js','site-builder/index.html','insights/index.html'])
  assert.equal(fs.existsSync(path.join(root,file)),true,file+' unexpectedly missing');
 const rank=fs.readFileSync(path.join(root,'lab/rank/index.html'),'utf8');
 assert.match(rank,/\/lab\/rank\/public-rank\.js/);
 const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
 assert.doesNotMatch(sitemap,/\/lab\/keywords\/|\/lab\/trends\/|\/website-samples\//);
});
