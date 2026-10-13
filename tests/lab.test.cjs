'use strict';
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('lab/index.html','utf8');
test('lab has 9 working panels and their tabs',()=>{
  for(const id of ['diagnosis','ranks','keywords','area','reviews','creative','utilities','geo','calendar']){
    assert.match(html,new RegExp('id="'+id+'"'));
    assert.match(html,new RegExp('data-tab="'+id+'"'));
  }
});
test('client script parses',()=>{
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(()=>new vm.Script(script));
});
test('root site preserves inquiry form and links to lab',()=>{
  const root=fs.readFileSync('index.html','utf8');
  assert.match(root,/href="\/lab\/"/);
  assert.match(root,/api\.web3forms\.com\/submit/);
  assert.match(root,/id="services"/);
  assert.match(root,/id="contact"/);
});
test('serverless place endpoint declines calls when credentials disabled',async()=>{
  const prev=process.env.MOMENTUM_PLACE_API_ENABLED;
  delete process.env.MOMENTUM_PLACE_API_ENABLED;
  try{
    const handler=require('../api/place-search.js');
    let code,body;
    const res={setHeader(){},status(n){code=n;return this},json(d){body=d;return this}};
    await handler({method:'GET',query:{provider:'kakao',keyword:'포항횟집'}},res);
    assert.equal(code,503);assert.match(body.error,/활성화/);
  }finally{if(prev!==undefined)process.env.MOMENTUM_PLACE_API_ENABLED=prev}
});
test('serverless review endpoint declines calls when credentials disabled',async()=>{
  const prev=process.env.MOMENTUM_AI_ENABLED;
  delete process.env.MOMENTUM_AI_ENABLED;
  try{
    const handler=require('../api/review-replies.js');
    let code,body;
    const res={setHeader(){},status(n){code=n;return this},json(d){body=d;return this}};
    await handler({method:'POST',headers:{},body:{review:'좋아요'}},res);
    assert.equal(code,503);assert.match(body.error,/활성화/);
  }finally{if(prev!==undefined)process.env.MOMENTUM_AI_ENABLED=prev}
});
test('automatic business lookup form is primary, manual checklist secondary',()=>{
  assert.match(html,/id="runAudit"/);
  assert.match(html,/id="bizurl"/);
  assert.match(html,/id="auditresult"/);
  assert.match(html,/<details class="audit-manual" id="manualaudit">/);
  assert.ok(html.indexOf('id="runAudit"')<html.indexOf('id="checklist"'));
});
test('business audit rejects invalid input and never fakes platform data',async()=>{
 const handler=require('../api/business-audit.js');
 const mock=(body)=>{let code,data;const res={setHeader(){},status(n){code=n;return this},json(d){data=d;return this}};return handler({method:"POST",headers:{},body},res).then(()=>({code,data}))};
 let p=await mock({name:"A"});
 assert.equal(p.code,400);
 p=await mock({name:"포항 묵돌이",placeUrl:"http://127.0.0.1/admin"});
 assert.equal(p.code,400);
 const prev=process.env.MOMENTUM_PLACE_API_ENABLED;
 delete process.env.MOMENTUM_PLACE_API_ENABLED;
 try{
  p=await mock({name:"포항 묵돌이",placeUrl:"https://m.place.naver.com/restaurant/123"});
  assert.equal(p.code,200);
  assert.equal(p.data.coverage.officialApiMatched,0);
  assert.equal(p.data.platforms.google.status,"not_configured");
  assert.equal(p.data.platforms.kakao.status,"not_configured");
  assert.equal(p.data.platforms.naver.status,"manual_required");
  assert.equal(p.data.input.provider,"naver");
 }finally{if(prev!==undefined)process.env.MOMENTUM_PLACE_API_ENABLED=prev}
});

test('SEO GEO has evidence-based tools and no old manual checklist',()=>{
 const html=fs.readFileSync('lab/index.html','utf8');
 assert.match(html,/id="techcheck"/);
 assert.match(html,/id="observegeo"/);
 assert.match(html,/id="rankCopied"/);
 assert.match(html,/id="keywordsCSV"/);
 assert.match(html,/id="shopsCsv"/);
 assert.match(html,/id="exportCalendar"/);
 assert.doesNotMatch(html,/const geoTitles=/);
 assert.match(html,/tools-v2\.js/);
 assert.match(html,/tools-v2\.css/);
});
test('add-on front-end script parses',()=>{
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync('lab/tools-v2.js','utf8')));
});
test('technical SEO URL validator blocks internal or map URLs',()=>{
 const {validateUrl}=require('../api/website-seo.js');
 assert.equal(validateUrl('http://127.0.0.1/admin'),null);
 assert.equal(validateUrl('http://localhost/private'),null);
 assert.equal(validateUrl('http://[::1]/secret'),null);
 assert.equal(validateUrl('https://naver.com/search'),null);
 assert.equal(validateUrl('https://maps.app.goo.gl/abc'),null);
 assert.equal(validateUrl('ftp://example.com'),null);
 assert.equal(validateUrl('https://example.com/#frag'),null);
 assert.equal(validateUrl('https://example.com/a?utm_campaign=x'),'https://example.com/a');
});
test('SEO endpoint rejects missing public URL before calling Google',async()=>{
 const h=require('../api/website-seo.js');
 let code,body;
 const res={setHeader(){},status(n){code=n;return this},json(x){body=x;return this}};
 await h({method:'GET',query:{url:'http://192.168.1.11/admin'}},res);
 assert.equal(code,400);
 assert.match(body.error,/홈페이지/);
});
