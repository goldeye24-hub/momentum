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
  assert.equal(data.platforms.naver.status,'not_configured');
  assert.equal(data.input.naverPlaceId,'12345');
  assert.equal(data.coverage.availableProviders,3);
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


test('Naver-first diagnostics use NAVER API HUB and protect public display rights',()=>{
 const hub=require('../api/_naver-hub.js');
 assert.equal(hub.placeIdFromUrl('https://m.place.naver.com/restaurant/1738191111/home'),'1738191111');
 assert.equal(hub.placeIdFromUrl('https://map.naver.com/p/entry/place/123456789'),'123456789');
 assert.equal(hub.placeIdFromUrl('https://naver.me/abcd1234'),null);
 assert.equal(hub.placeIdFromUrl('https://evil.example/restaurant/123456789'),null);
 const result=hub.matchResults([{name:'테스트 카페',address:'주소A'},{name:'테스트 카페',address:'주소B'}],'테스트 카페');
 assert.equal(result.status,'ambiguous','Duplicate business names cannot be auto-matched');
 const candidate=hub.matchResults([{name:'테스트 카페',address:'주소A'}],'테스트 카페');
 assert.equal(candidate.status,'matched');
 const prevEnable=process.env.MOMENTUM_NAVER_API_ENABLED;
 const prevApproval=process.env.MOMENTUM_NAVER_PUBLIC_DISPLAY_APPROVED;
 process.env.MOMENTUM_NAVER_API_ENABLED='true';
 delete process.env.MOMENTUM_NAVER_PUBLIC_DISPLAY_APPROVED;
 try{assert.equal(hub.rightsReady(),false)}finally{
  if(prevEnable===undefined)delete process.env.MOMENTUM_NAVER_API_ENABLED;
  else process.env.MOMENTUM_NAVER_API_ENABLED=prevEnable;
  if(prevApproval===undefined)delete process.env.MOMENTUM_NAVER_PUBLIC_DISPLAY_APPROVED;
  else process.env.MOMENTUM_NAVER_PUBLIC_DISPLAY_APPROVED=prevApproval;
 }
 assert.match(fs.readFileSync('api/_naver-hub.js','utf8'),/naverapihub\.apigw\.ntruss\.com\/search\/v1\/local/);
 assert.match(html,/id="naverFocus"/);
 const client=fs.readFileSync('lab/customer.js','utf8');
 assert.match(client,/p\.naver\?\.store\|\|p\.google/);
});


test('independent first-party engine returns useful plan from only business name and URL',()=>{
 const {analyse,parsePlaceUrl}=require('../api/_momentum-intel.js');
 const data=analyse({name:'포항 묵돌이',placeUrl:'https://m.place.naver.com/restaurant/12345678/home'});
 assert.equal(data.method,'MOMENTUM_INDEPENDENT_INPUT_ONLY');
 assert.equal(data.merchant.identity.placeId,'12345678');
 assert.equal(data.merchant.identity.verifiedIdentity,false);
 assert.equal(data.merchant.region.value,'포항');
 assert.equal(data.merchant.industry.label,'음식점');
 assert.ok(data.keywords.some(x=>x.keyword==='포항 맛집'));
 assert.ok(data.keywords.some(x=>x.keyword==='포항 묵돌이 위치'));
 assert.ok(data.actions.length>=3);
 assert.ok(data.campaigns.length>=3);
 assert.equal(data.measurements.naverMapRank.value,null);
 assert.equal(data.measurements.naverSearchVolume.value,null);
 assert.ok(data.keywords.every(x=>x.searchVolume===null && x.rank===null));
 assert.equal(parsePlaceUrl('https://naver.me/abc123').placeId,null);
 assert.equal(parsePlaceUrl('https://bad.example/restaurant/123456789').valid,false);
 assert.equal(parsePlaceUrl('http://m.place.naver.com/restaurant/123456789').valid,false);
 assert.equal(parsePlaceUrl('https://m.place.naver.com/%ED%A').valid,false);
});
test('marketing hypotheses avoid inventing locations, specialties and numeric rank',()=>{
 const {analyse}=require('../api/_momentum-intel.js');
 const generic=analyse({name:'스위트하우스',placeUrl:'https://naver.me/xya123'});
 assert.equal(generic.merchant.region.value,null);
 assert.equal(generic.merchant.industry.label,null);
 assert.equal(generic.merchant.identity.urlType,'shortlink');
 assert.equal(generic.merchant.identity.placeId,null);
 assert.equal(generic.measurements.storeVisitors.value,null);
 assert.ok(generic.actions.some(x=>x.type==='data_gap'));
 const branded=analyse({name:'수영 엽이네 돼지갈비',placeUrl:'https://m.place.naver.com/restaurant/523412342/home'});
 assert.equal(branded.merchant.region.value,'부산 수영');
 assert.equal(branded.merchant.industry.label,'고기·구이');
 assert.equal(branded.merchant.specialty,'돼지갈비');
 assert.ok(branded.keywords.some(x=>x.keyword.includes('돼지갈비')));
 assert.ok(!branded.keywords.some(x=>x.keyword.includes('회집')));
});
test('server endpoint has no keys, requires only merchant inputs and returns evidence labels',async()=>{
 const handler=require('../api/own-intelligence.js');
 function response(){let code=0,data=null;return {setHeader(){},status(n){code=n;return this},json(v){data=v;return this},get code(){return code},get data(){return data}}}
 const res=response();
 await handler({method:'POST',body:{name:'발몽헤어 부산',placeUrl:'https://m.place.naver.com/hairshop/123456789/home'},headers:{}},res);
 assert.equal(res.code,200);
 assert.equal(res.data.merchant.industry.label,'미용·헤어');
 assert.equal(res.data.merchant.region.value,'부산');
 assert.equal(res.data.merchant.identity.placeId,'123456789');
 assert.equal(res.data.measurements.naverMapRank.value,null);
 const bad=response();
 await handler({method:'POST',body:{name:'업체',placeUrl:'https://example.com/place/123456789'},headers:{}},bad);
 assert.equal(bad.code,400);
 assert.match(html,/id="ownIntel"/);
 assert.match(html,/\/lab\/intel\.js/);
 assert.match(html,/\/lab\/intel\.css/);
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync('lab/intel.js','utf8')));
});


test('homepage offers the approved Momentum marketing products and two open packages',()=>{
 const h=fs.readFileSync('index.html','utf8');
 const products=[
  '키워드 검색광고','바이럴마케팅','블로그 체험단',
  '플레이스 진단 및 SEO 최적화','플레이스 등록 및 수정대행',
  '플레이스 리뷰 신고 및 삭제 요청 지원',
  '오픈마켓 상세페이지 제작','홈페이지 제작','사진촬영',
  '오픈패키지 1','오픈패키지 2'
 ];
 for(const name of products){
  assert.ok(h.includes('data-product="'+name+'"'),'Missing product CTA: '+name);
  assert.ok(h.includes('<option value="'+name+'">'),'Missing product in inquiry form: '+name);
 }
 for(const portal of ['네이버','다음','카카오','구글'])assert.match(h,new RegExp(portal));
 assert.equal((h.match(/class="card service-card/g)||[]).length,9);
 assert.equal((h.match(/class="package-card card/g)||[]).length,2);
 const package1=h.slice(h.indexOf('>오픈패키지 1</div>'),h.indexOf('>오픈패키지 2</div>'));
 for(const service of ['사진촬영','플레이스 등록대행','SEO 최적화','네이버 예약 세팅','블로그 체험단'])assert.ok(package1.includes(service),'Package 1 missing '+service);
 const package2=h.slice(h.indexOf('>오픈패키지 2</div>'),h.indexOf('id="open-packages"')+12000);
 assert.match(package2,/오픈패키지 1 구성 전체 포함/);
 assert.match(package2,/플레이스 광고 세팅/);
 assert.match(package2,/파워링크 광고 세팅/);
 assert.match(h,/등록 및 기본정보 수정은 사업주가 직접 할 수 있는 무료 서비스/);
 assert.match(h,/삭제 여부는 네이버 판단에 따르며 보장하지 않음/);
 assert.match(h,/매체 광고비 별도/);
 assert.doesNotMatch(h,/파워패키지|신규고객 패키지|샤오홍슈/);
});

test('industry FAQ, 28 industry category directory, and four useful dedicated sector pages',()=>{
 const home=fs.readFileSync('index.html','utf8');
 const directory=fs.readFileSync('industries/index.html','utf8');
 const sectors=['restaurant','hairshop','hospital','academy'];
 assert.match(home,/id="industries"/);
 assert.match(home,/음식점·카페·외식업/);
 assert.match(home,/개인사업자부터 법인·기업까지 상담 가능합니다/);
 assert.match(home,/상담 가능 업종 전체 보기/);
 assert.match(home,/href="\/industries\/"/);
 assert.match(directory,/상담 가능한 28개 업종군/);
 const allIndustries=directory.slice(directory.indexOf('>상담 가능한 28개 업종군</h2>'));
 assert.equal((allIndustries.match(/<article class="card"><h3>/g)||[]).length,28);
 for(const slug of sectors){
  const url='/industries/'+slug+'/';
  assert.ok(home.includes('href="'+url+'"'),'Homepage sector link '+slug);
  assert.ok(directory.includes('href="'+url+'"'),'Directory sector link '+slug);
  const detail=fs.readFileSync('industries/'+slug+'/index.html','utf8');
  for(const fragment of ['<title>','<meta name="description"','<h1>','<h2>','href="/#contact"','진단부터 실행까지']){
   assert.ok(detail.includes(fragment),'Sector '+slug+' missing '+fragment);
  }
 }
 assert.match(directory,/의료·법률·금융·주류/);
});

test('local SEO GEO check works honestly without NAVER credentials',()=>{
 const h=fs.readFileSync('lab/index.html','utf8');
 const logic=fs.readFileSync('lab/self-audit.js','utf8');
 assert.match(h,/id="selfAudit"/);
 assert.match(h,/id="selfAuditStatus"/);
 assert.match(h,/\/lab\/self-audit\.js/);
 assert.match(h,/\/lab\/self-audit\.css/);
 assert.match(logic,/const CHECKS=/);
 assert.match(logic,/direct|답변|담당자|확인자/);
 assert.match(logic,/reportLines:lines/);
 assert.match(logic,/실측 데이터 아님/);
 assert.doesNotThrow(()=>new vm.Script(logic));
 const count=(logic.match(/\{id:'[^']+',group:/g)||[]).length;
 assert.equal(count,12);
 const customer=fs.readFileSync('lab/customer.js','utf8');
 assert.match(customer,/MomentumSelfAudit\.reportLines\(\)/);
 assert.match(customer,/content-type/);
});

test('integrated agency visual redesign retains accurate products and live inquiry paths',()=>{
 const home=fs.readFileSync('index.html','utf8');
 const agency=fs.readFileSync('agency.css','utf8');
 assert.match(home,/INTEGRATED DIGITAL AGENCY/);
 assert.match(home,/고객의 선택을 만드는/);
 assert.match(home,/Built for[\s\S]*Your Next Move/);
 assert.match(home,/agency-visual/);
 assert.match(home,/SEARCH ADVERTISING/);
 assert.match(home,/VIRAL & EXPERIENCES/);
 assert.match(home,/BRAND & WEB DESIGN/);
 assert.match(home,/SEO·GEO 직접확인 진단/);
 assert.match(home,/href="\/agency\.css"/);
 assert.match(home,/id="contactForm"/);
 assert.match(home,/id="requestedProduct"/);
 assert.match(home,/href="\/lab\/"/);
 assert.match(home,/id="open-packages"/);
 assert.match(home,/id="industries"/);
 assert.match(home,/실제 월간 검색량·플레이스 순위는 API 미연동/);
 assert.doesNotMatch(home,/class="hero-form"/);
 for(const product of ['키워드 검색광고','바이럴마케팅','블로그 체험단','플레이스 진단 및 SEO 최적화','플레이스 등록 및 수정대행','플레이스 리뷰 신고 및 삭제 요청 지원','오픈마켓 상세페이지 제작','홈페이지 제작','사진촬영','오픈패키지 1','오픈패키지 2']){
  assert.ok(home.includes('data-product="'+product+'"'),product);
 }
 assert.equal((home.match(/class="card service-card/g)||[]).length,9);
 assert.equal((home.match(/class="package-card card/g)||[]).length,2);
 assert.match(agency,/\.agency-hero-grid/);
 assert.match(agency,/\.agency-service-grid/);
 assert.match(agency,/@media\(max-width:760px\)/);
 const lab=fs.readFileSync('lab/customer.css','utf8');
 const industry=fs.readFileSync('industries/site.css','utf8');
 assert.match(lab,/integrated agency identity/);
 assert.match(industry,/Cross-site agency brand/);
});


test('homepage displays editable original templates instead of confusing client screenshots',()=>{
 const home=fs.readFileSync('index.html','utf8');
 const css=fs.readFileSync('website-samples/home-showcase.css','utf8');
 assert.match(home,/id="work"/);
 assert.match(home,/실제 고객 제작 실적이 아닌 편집 가능한 디자인 샘플/);
 assert.match(home,/href="\/website-samples\/"/);
 assert.match(home,/href="\/site-builder\/"/);
 assert.equal((home.match(/class="agency-sample-card"/g)||[]).length,3);
 assert.doesNotMatch(home,/class="agency-work-card /);
 assert.doesNotMatch(home,/src="\/assets\/portfolio-mukdori\.jpg"/);
 assert.match(home,/href="\/website-samples\/restaurant\/"/);
 assert.match(home,/href="\/site-builder\/\?template=beauty"/);
 assert.match(home,/href="\/website-samples\/home-showcase\.css"/);
 assert.match(css,/agency-sample-viewport/);
 assert.equal((home.match(/class="agency-service-family"/g)||[]).length,4);
 assert.equal((home.match(/class="card service-card/g)||[]).length,9);
 // Original verified screenshots/case pages remain separately available; never mislabel mockups as paid work.
 for(const slug of ['mukdori','balmonghair']){
  const page=fs.readFileSync('work/'+slug+'/index.html','utf8');
  assert.match(page,/PROJECT OVERVIEW/);
  const buffer=fs.readFileSync('assets/portfolio-'+slug+'.jpg');
  assert.ok(buffer.length>20000);
 }
});

test('five distinct industry websites are real navigable demo pages with safe HTML builder core',()=>{
 const presets=JSON.parse(fs.readFileSync('site-builder/presets.json','utf8'));
 const code=fs.readFileSync('site-builder/kit.js','utf8');
 const design=fs.readFileSync('site-builder/site-template.css','utf8');
 assert.equal(presets.length,5);
 assert.doesNotThrow(()=>new vm.Script(code));
 const context={window:{}};
 vm.runInNewContext(code,context);
 const kit=context.window.MomentumSiteKit;
 assert.equal(typeof kit.render,'function');
 for(const id of ['restaurant','beauty','academy','clinic','corporate']){
  const preset=presets.find(x=>x.id===id);
  assert.ok(preset,id);
  const page=fs.readFileSync('website-samples/'+id+'/index.html','utf8');
  assert.match(page,/site-builder\/kit\.js/);
  assert.match(page,/site-template\.css/);
  assert.match(page,/noindex,follow/);
  const rendered=kit.render(preset,design);
  assert.match(rendered,/<html lang="ko">/);
  assert.match(rendered,/디자인 시안/);
  assert.match(rendered,/class="site-shell site-hero"/);
  assert.match(rendered,/class="services-grid"/);
  assert.match(rendered,/id="contact"/);
  assert.match(rendered,/src="https:\/\/images\.unsplash\.com\//);
 }
 const sample=kit.copy(presets[0]);
 sample.brand='<script>alert(1)</script>';
 sample.heroImage='javascript:alert(1)';
 sample.services[0].title='<img src=x onerror=alert(2)>';
 const html=kit.render(sample,design);
 assert.doesNotMatch(html,/<script>/);
 assert.doesNotMatch(html,/src="javascript:/);
 assert.match(html,/&lt;script&gt;alert/);
 assert.match(html,/&lt;img src=x onerror/);
 sample.demoMode=false;
 const productionHtml=kit.render(sample,design);
 assert.doesNotMatch(productionHtml,/class="sample-ribbon"/);
 assert.match(productionHtml,/공식 홈페이지/);
});
test('page builder has real section, image, style, reorder, persistence and export controls',()=>{
 const html=fs.readFileSync('site-builder/index.html','utf8');
 const js=fs.readFileSync('site-builder/editor.js','utf8');
 const gallery=fs.readFileSync('website-samples/index.html','utf8');
 assert.match(html,/id="sitePreview"/);
 assert.match(html,/data-tab="sections"/);
 assert.match(html,/data-tab="gallery"/);
 assert.match(html,/id="downloadHtml"/);
 assert.match(html,/id="saveConfig"/);
 assert.match(html,/id="loadConfig"/);
 assert.match(html,/data-viewport="mobile"/);
 assert.doesNotThrow(()=>new vm.Script(js));
 for(const marker of ['localStorage.setItem','canvas.toDataURL','data-move','data-visible','data-add','data-remove','kit.render','Blob('])
  assert.ok(js.includes(marker),marker);
 assert.equal((gallery.match(/class="sample-card"/g)||[]).length,5);
 assert.match(gallery,/data-filter/);
 assert.match(gallery,/샘플은 실제 업체 포트폴리오와 별도로 관리/);
});
