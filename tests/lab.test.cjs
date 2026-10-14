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

test('creative studio replaces single generic poster and supports premium editing',()=>{
 const block=html.slice(html.indexOf('<section id="creative"'),html.indexOf('<section id="calculator"'));
 assert.ok(block.length>3500);
 for(const id of ['studioTemplateGrid','studioBusiness','studioFormat','studioHeadline','studioSubline','studioPhoto','studioLogo','studioZoom','studioPanX','studioPanY','studioBrightness','studioAccent','studioOverlay','studioDownload','studioCaption','poster']){
  assert.match(block,new RegExp('id="'+id+'"'));
 }
 assert.doesNotMatch(block,/id="posterTitle"|id="posterDesc"|id="posterImage"/);
 assert.match(html,/\/lab\/studio\.css/);
 assert.match(html,/\/lab\/studio\.js/);
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync('lab/studio.js','utf8')));
 assert.doesNotMatch(fs.readFileSync('lab/customer.js','utf8'),/function drawPoster\(/);
});
test('studio Canvas draws every preset in every export format',()=>{
 const js=fs.readFileSync('lab/studio.js','utf8');
 const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 const inputs={};
 for(const id of ids)inputs[id]={value:'',innerHTML:'',textContent:'',files:[],addEventListener(name,cb){this._events??={};this._events[name]=cb;},querySelectorAll(selector){
   if(selector==='button'){
     const ids=[...this.innerHTML.matchAll(/data-studio-template="([^"]+)"/g)].map(m=>m[1]);
     return ids.map(id=>({dataset:{studioTemplate:id},onclick:null}));
   }
   return [];
 }};
 const sent=[];
 const ctx=new Proxy({}, {get(target,key){
   if(key==='measureText')return text=>({width:String(text).length*25});
   if(key==='createLinearGradient')return()=>({addColorStop(){}});
   if(key==='fillText')return txt=>{sent.push(String(txt))};
   if(key in target)return target[key];
   return()=>{};
 },set(target,key,value){target[key]=value;return true}});
 const canvas=inputs.poster;
 canvas.getContext=()=>ctx;
 inputs.studioFormat.value='square';
 inputs.studioAccent.value='#eb8f4a';
 for(const id of ['studioHeadline','studioSubline','studioEyebrow','studioPrice','studioCTA','studioFootnote','studioBusiness'])inputs[id].value='';
 const handlers={};
 const document={readyState:'complete',getElementById(id){return inputs[id]||null},querySelector(){return null}};
 const ctxVm={document,localStorage:{getItem(){return null},setItem(){}},requestAnimationFrame(cb){cb();return 1},cancelAnimationFrame(){},URL,alert(){},confirm(){return true},navigator:{clipboard:{writeText:async()=>{}}},Image:function(){}};
 vm.runInNewContext(js,ctxVm,{timeout:5000});
 assert.ok(sent.length>4);
 assert.equal(canvas.width,1080);
 for(const format of [['portrait',1350],['story',1920],['banner',628],['square',1080]]){
  inputs.studioFormat.value=format[0];
  inputs.studioFormat._events.change();
  assert.equal(canvas.height,format[1]);
 }
 assert.match(inputs.studioTemplateGrid.innerHTML,/data-studio-template="beauty"/);
 assert.match(inputs.studioTemplateGrid.innerHTML,/data-studio-template="premium"/);
 assert.equal((inputs.studioTemplateGrid.innerHTML.match(/class="studio-template"/g)||[]).length,8);
});
