'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('lab/index.html','utf8');
test('single two-field customer diagnostic form',()=>{
 const form=html.match(/<form id="auditForm"[\s\S]*?<\/form>/)?.[0];
 assert.ok(form);
 assert.deepEqual([...form.matchAll(/<input[^>]+id="([^"]+)"/g)].map(x=>x[1]),['storeName','placeUrl']);
 assert.match(form,/id="start"/);
 assert.doesNotMatch(form,/API.?키|지역|업종|키워드|CSV/);
});
test('all diagnostic tabs share a single store input',()=>{
 for(const id of ['overview','places','ranking','keywords','competition','geo','reviews','creative','calculator','calendar']){
  assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,new RegExp('data-view="'+id+'"'));
 }
 assert.equal((html.match(/id="auditForm"/g)||[]).length,1);
 assert.doesNotMatch(html,/keywordsCSV|shopsCsv|naverPageText|rankCopied/);
});
test('customer UI and application javascript parse',()=>{
 assert.match(html,/\/lab\/customer\.css/);
 assert.match(html,/\/lab\/customer\.js/);
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync('lab/customer.js','utf8')));
});
test('homepage still retains services and inquiry form',()=>{
 const root=fs.readFileSync('index.html','utf8');
 assert.match(root,/href="\/lab\/"/);
 assert.match(root,/id="services"/);
 assert.match(root,/id="contact"/);
 assert.match(root,/api\.web3forms\.com\/submit/);
});
test('business API returns no invented platform data when disconnected',async()=>{
 const prev=process.env.MOMENTUM_PLACE_API_ENABLED;
 delete process.env.MOMENTUM_PLACE_API_ENABLED;
 try{
  const h=require('../api/business-audit.js');
  let code,data; const res={setHeader(){},status(n){code=n;return this},json(d){data=d;return this}};
  await h({method:'POST',headers:{},body:{name:'포항 묵돌이',placeUrl:'https://m.place.naver.com/restaurant/12345/home'}},res);
  assert.equal(code,200);
  assert.equal(data.coverage.officialApiMatched,0);
  assert.equal(data.platforms.google.status,'not_configured');
  assert.equal(data.platforms.kakao.status,'not_configured');
  assert.equal(data.platforms.naver.status,'manual_required');
 }finally{if(prev!==undefined)process.env.MOMENTUM_PLACE_API_ENABLED=prev}
});
test('business API rejects unsupported provider URLs',async()=>{
 const h=require('../api/business-audit.js');
 let code,data; const res={setHeader(){},status(n){code=n;return this},json(d){data=d;return this}};
 await h({method:'POST',headers:{},body:{name:'테스트매장',placeUrl:'https://malicious.example/place'}},res);
 assert.equal(code,400);
 assert.match(data.error,/공식 지도 링크/);
});
test('site SEO rejects private addresses and map URLs',()=>{
 const {validateUrl}=require('../api/website-seo.js');
 for(const x of ['http://localhost','http://127.0.0.1','https://m.place.naver.com','https://maps.app.goo.gl/a','http://192.168.0.10']){
  assert.equal(validateUrl(x),null);
 }
 assert.equal(validateUrl('https://example.com/'),'https://example.com/');
});