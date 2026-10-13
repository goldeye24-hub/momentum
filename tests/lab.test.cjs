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