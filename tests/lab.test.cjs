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
 for(const id of ['overview','places','ranking','keywords','competition','geo','reviews','calculator','calendar']){
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
test('analytics page header omits Free Workspace menu but retains diagnostics',()=>{
 const html=fs.readFileSync('lab/index.html','utf8');
 const nav=html.match(/<nav class="mainnav">([\s\S]*?)<\/nav>/)?.[1];
 assert.ok(nav);
 assert.doesNotMatch(nav,/무료 작업실|무료작업실/);
 assert.match(nav,/전문 서비스/);
 assert.match(html,/무료 매장 통합진단/);
 assert.match(html,/id="auditForm"/);
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

test('promotion studio no longer appears in public analytics',()=>{
 assert.doesNotMatch(html,/홍보물 제작실|홍보 디자인 스튜디오|id="creative"|data-view="creative"|\/lab\/studio\.(?:css|js)/);
 for(const id of ['overview','places','ranking','keywords','competition','geo','reviews','calculator','calendar'])assert.ok(html.includes('id="'+id+'"'));
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


test('marketing homepage offers approved paid agency products and two open packages',()=>{
 const h=fs.readFileSync('index.html','utf8');
 const keyProducts=['키워드 검색광고','바이럴마케팅','플레이스 진단 및 SEO 최적화',
 '플레이스 리뷰 신고 및 삭제 요청 지원','SNS 광고 및 인플루언서 섭외','언론기사 송출 대행','마케팅 운영 교육',
 '오픈패키지 1','오픈패키지 2'];
 for(const name of keyProducts){
  assert.ok(h.includes('data-product="'+name+'"'),'Missing marketing CTA: '+name);
  assert.ok(h.includes('<option value="'+name+'">'),'Missing marketing inquiry option: '+name);
 }
 for(const channel of ['네이버','카카오','구글'])assert.match(h,new RegExp(channel));
 assert.equal((h.match(/class="mk-service-card(?:\s|")/g)||[]).length,9);
 assert.doesNotMatch(h,/class="mk-photo-service"/);
 assert.match(h,/id="photo-service"/);
 assert.match(h,/블로그·네이버 플레이스용/);
 assert.match(h,/data-product="플레이스 사진촬영"/);
 assert.match(h,/<option value="플레이스 사진촬영">/);
 assert.equal((h.match(/class="package-card card/g)||[]).length,2);
 const package1=h.slice(h.indexOf('>오픈패키지 1</div>'),h.indexOf('>오픈패키지 2</div>'));
 for(const service of ['사진촬영','플레이스 등록대행','SEO 최적화','네이버 예약 세팅','블로그 체험단'])assert.ok(package1.includes(service),'Package 1 missing '+service);
 const package2=h.slice(h.indexOf('>오픈패키지 2</div>'),h.indexOf('id="open-packages"')+12000);
 for(const term of ['오픈패키지 1 구성 전체 포함','플레이스 광고 세팅','파워링크 광고 세팅','매체 광고비 별도'])assert.match(package2,new RegExp(term));
 assert.match(h,/권리침해 등 공식 신고 사유/);
 assert.match(h,/삭제를 보장하지 않습니다/);
 assert.doesNotMatch(h,/파워패키지|신규고객 패키지/);
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

test('Place SEO card describes an SEO audit without registration or editing claims',()=>{
 const home=fs.readFileSync('index.html','utf8');
 const start=home.indexOf('02 / PLACE SEO');
 const end=home.indexOf('03 / REVIEW CARE',start);
 assert.ok(start>=0&&end>start,'Place SEO service card exists');
 const card=home.slice(start,end);
 assert.match(card,/<h3>플레이스<\/h3>/);
 assert.doesNotMatch(card,/등록|수정/);
 assert.match(card,/SEO와 예약 기능을 점검/);
});
test('marketing consultation removes street address and emphasizes advertising strategy',()=>{
 const h=fs.readFileSync('index.html','utf8');
 assert.doesNotMatch(h,/부산 동래구 충렬대로|소재지:|>소재지<|선택한 홈페이지 디자인|selectedDesignWrap/);
 assert.match(h,/맞춤 광고 전략 상담/);
 assert.match(h,/우리 사업에 맞는 광고 전략을 제안받아 보세요/);
 assert.match(h,/광고 전략 상담 신청하기/);
 assert.match(h,/<input type="hidden" id="selectedDesign"/);
 assert.match(h,/id="contactForm"/);
 assert.match(h,/id="requestedProduct"/);
 assert.match(h,/고객센터: 0507-1313-5668/);
});
test('marketing service navigation connects product pages, agency and free tools',()=>{
 const h=fs.readFileSync('index.html','utf8');
 const mapping=[['keyword-ads','keyword-ads'],['place-seo','place-seo'],['review-care','review-care'],['viral-marketing','viral'],['sns-marketing','sns'],['press-pr','press'],['photo-service','photography'],['ad-education','education']];
 const start=h.indexOf('<nav id="agencyNav"'),end=h.indexOf('<div class="momentum-mobile-nav-more">',start);
 assert.ok(start>=0&&end>start);
 const nav=h.slice(start,end);
 assert.equal((nav.match(/<a href=/g)||[]).length,11);
 assert.match(nav,/href="\\/insights\\/" class="momentum-insights-nav"/);
 for(const [card,slug] of mapping){
  const page='services/'+slug+'/index.html';
  assert.ok(fs.statSync(page).isFile(),page);
  assert.match(nav,new RegExp('href="/services/'+slug+'/"'));
  const detail=fs.readFileSync(page,'utf8');
  assert.match(detail,/<h1 id="detailTitle">/);
  for(const section of ['about','who','scope','compare','process','faq'])assert.ok(detail.includes('id="'+section+'"'),page+': '+section);
  assert.match(detail,/\/services\/service-pages\.css/);
  assert.match(detail,/\?service=/);
  assert.match(detail,/noindex,follow/);
 }
 assert.match(nav,/href="\/agency\/"><strong>디자인/);
 assert.match(nav,/href="#free-tools"/);
 assert.equal((h.match(/class="mk-detail-link"/g)||[]).length,8);
 assert.match(h,/모멘텀에이전시 · 포트폴리오 보러가기/);
 assert.match(h,/샤오홍슈/);
 assert.match(h,/삭제를 보장하지 않습니다/);
 const css=fs.readFileSync('services/service-pages.css','utf8');
 assert.match(css,/\.hero-art/);
 assert.match(css,/@media\(max-width:560px\)/);
});
test('keyword advertising diagram uses local brand logos instead of letter placeholders',()=>{
 const h=fs.readFileSync('services/keyword-ads/index.html','utf8');
 for(const brand of ['naver','google','kakao']){
  const file='assets/logos/'+brand+'.svg';
  assert.ok(fs.statSync(file).isFile(),file);
  const svg=fs.readFileSync(file,'utf8');
  assert.match(svg,/<svg/);
  assert.match(svg,/<path /);
  assert.match(h,new RegExp('src="/assets/logos/'+brand+'\\.svg"'));
 }
 assert.doesNotMatch(h,/class="vis-source-icon"/);
 assert.match(h,/공식 제휴·인증을 의미하지 않습니다/);
 const css=fs.readFileSync('services/service-pages.css','utf8');
 assert.match(css,/\.vis-brand-logo--kakao/);
 assert.match(css,/@media\(max-width:560px\)/);
});
test('all eight service detail pages include unique semantic infographics without fabricated growth metrics',()=>{
 const variants=['keyword-ads','place-seo','review-care','viral','sns','press','photography','education'];
 for(const slug of variants){
  const h=fs.readFileSync('services/'+slug+'/index.html','utf8');
  assert.match(h,new RegExp('class="svc-visual svc-visual--'+slug+'"'));
  assert.match(h,new RegExp('aria-labelledby="visual-'+slug+'"'));
  assert.match(h,/class="vis-heading"/);
  assert.match(h,/class="vis-body"/);
  assert.match(h,/class="timeline"/);
  assert.match(h,/noindex,follow/);
  assert.doesNotMatch(h,/(?:portfolio-mukdori|portfolio-balmonghair)\.jpg/);
 }
 const css=fs.readFileSync('services/service-pages.css','utf8');
 for(const selector of ['.vis-inputs','.vis-check-grid','.vis-branches','.vis-two-path','.vis-social','.vis-press-layout','.vis-photo-board','.vis-curriculum']) assert.ok(css.includes(selector),selector);
 assert.match(css,/max-width:560px/);
 const review=fs.readFileSync('services/review-care/index.html','utf8');
 assert.match(review,/삭제를 보장하지 않습니다/);
 const media=fs.readFileSync('services/press/index.html','utf8');
 assert.match(media,/매체 심사/);
});
test('photography guide displays four real reference photos with disclosure',()=>{
 const h=fs.readFileSync('services/photography/index.html','utf8');
 const photos=[...h.matchAll(/<img class="vis-photo-image" src="([^"]+)" alt="([^"]+)"/g)];
 assert.equal(photos.length,4);
 for(const [,src,alt] of photos){assert.match(src,/^https:\/\/images\.unsplash\.com\/photo-/);assert.ok(alt.length>=6)}
 assert.doesNotMatch(h,/class="vis-frame-art/);
 assert.match(h,/실제 고객사 촬영 실적이나 포트폴리오가 아닙니다/);
 const css=fs.readFileSync('services/service-pages.css','utf8');
 assert.match(css,/\.svc-visual--photography \.vis-photo-image/);
 assert.match(css,/object-fit:cover/);
});
test('marketing homepage does not reuse Mukdori or Balmonghair photos',()=>{
 const h=fs.readFileSync('index.html','utf8');
 assert.doesNotMatch(h,/portfolio-(?:mukdori|balmonghair)\.jpg/);
 assert.match(h,/class="mm-intelligence-board v4-hero-visual"/);
 assert.match(h,/class="v4-navigation-ribbon"/);
 assert.match(h,/marketing-v4-enterprise-2026\.css/);
 assert.equal((h.match(/class="mb-package-cover/g)||[]).length,2);
 assert.equal((h.match(/class="mb-industry-cover/g)||[]).length,4);
 const css=fs.readFileSync('marketing-v4-enterprise-2026.css','utf8');
 assert.match(css,/\.v4-hero-visual/);
 assert.match(css,/\.mb-industry-cover/);
});
test('marketing-first homepage separates paid advertising, free tools, and premium membership',()=>{
 const h=fs.readFileSync('index.html','utf8');
 assert.match(h,/DIGITAL MARKETING COMPANY/);
 assert.match(h,/우리 가게를 위한/);
 assert.match(h,/진짜 마케팅 전략/);
 assert.match(h,/mm-intelligence-board/);
 assert.ok(h.includes('10<span>+</span>'));
 assert.ok(h.includes('marketing-home-2026.css'));
 assert.match(h,/id="services"/);
 assert.match(h,/id="free-tools"/);
 assert.match(h,/id="paid-service"/);
 assert.match(h,/id="open-packages"/);
 assert.match(h,/id="contactForm"/);
 assert.match(h,/id="requestedProduct"/);
 assert.ok(h.includes('href="/agency/"'));
 assert.ok(h.includes('href="/platform/"'));
 assert.ok(h.includes('href="/lab/trends/"'));
 assert.match(h,/유료 회원 서비스/);
 assert.match(h,/현재 결제·유료 자동 권한 배정은 미연결/);
 assert.doesNotMatch(h,/id="work"|id="full-catalog"|class="agency-sample-card/);
 assert.doesNotMatch(h,/class="hero-form"/);
 assert.equal((h.match(/class="mk-service-card(?:\s|")/g)||[]).length,9);
 assert.equal((h.match(/class="package-card card/g)||[]).length,2);
 assert.ok(fs.readFileSync('marketing-home-2026.css','utf8').includes('.mk-free-grid'));
});
test('design catalog is no longer on marketing homepage and is accessible via agency entrypoint',()=>{
 const home=fs.readFileSync('index.html','utf8');
 const agency=fs.readFileSync('agency/index.html','utf8');
 assert.ok(home.includes('href="/agency/"'));
 assert.doesNotMatch(home,/id="work"|agency-sample-grid|지금 보는 홈페이지 30만원으로 제작 가능합니다/);
 assert.match(agency,/모멘텀에이전시/);
 assert.match(agency,/독립 도메인·독립 호스팅 배포는 아직 진행하지 않았습니다/);
 for(const p of ['conversion','product-pages','brand-blogs'])assert.match(agency,new RegExp('href="/portfolio/'+p+'/'));
 for(const slug of ['mukdori','balmonghair']){
  const page=fs.readFileSync('work/'+slug+'/index.html','utf8');
  assert.match(page,/PROJECT OVERVIEW/);
  assert.ok(fs.readFileSync('assets/portfolio-'+slug+'.jpg').length>20000);
 }
});
test('retire all 15 common-frame URLs, preserve old visitors with redirects and migrate admin editor to 18 real sites',()=>{
 const retired=['restaurant','foodie','franchise','poolvilla','pension','glamping','petgroom','ladder','movers','cleaning','aircon','beauty','academy','clinic','corporate'];
 const current=['restaurant','beauty','b2b','shop','stay','interior','academy','pet','legal','clinic','auto','fitness','estate','hrd','tax','moving','cleaning','pilates'];
 const vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 const gallery=fs.readFileSync('website-samples/index.html','utf8');
 assert.match(gallery,/portfolio\/conversion/);
 assert.doesNotMatch(gallery,/class="sample-card/);
 for(const id of retired){
  assert.equal(fs.existsSync('website-samples/'+id+'/index.html'),false,'legacy file '+id+' must be removed');
  assert.ok(vercel.redirects.some(r=>r.source==='/website-samples/'+id+'/'),'Redirect absent for retired '+id);
 }
 const editor=fs.readFileSync('site-builder/design-editor.js','utf8');
 const ui=fs.readFileSync('site-builder/design-editor.html','utf8');
 assert.doesNotThrow(()=>new vm.Script(editor));
 assert.match(ui,/디자인 편집 \(18종\)/);
 assert.match(ui,/href="\/portfolio\/conversion\/"/);
 assert.match(editor,/const selectors=/);
 assert.match(editor,/frame.src='\/portfolio\/conversion\//);
 for(const id of current)assert.match(editor,new RegExp(id+':\\{brand:'));
 const builder=fs.readFileSync('site-builder/editor.js','utf8');
 assert.doesNotThrow(()=>new vm.Script(builder));
 assert.match(fs.readFileSync('site-builder/index.html','utf8'),/id="sitePreview"/);
});
test('eighteen independent portfolios have genuinely different semantic structures and working industry interactions',()=>{
 const ids=['restaurant','beauty','b2b','shop','stay','interior','academy','pet','legal','clinic','auto','fitness','estate','hrd','tax','moving','cleaning','pilates'];
 const hub=fs.readFileSync('portfolio/conversion/index.html','utf8');
 assert.equal((hub.match(/class="showcase /g)||[]).length,18);
 const seen=new Set();
 for(const id of ids){
  const h=fs.readFileSync('portfolio/conversion/'+id+'/index.html','utf8');
  assert.equal((h.match(/<h1\b/g)||[]).length,1,id+' H1');
  assert.match(h,/noindex,follow/);
  assert.match(h,/application\/ld\+json/);
  assert.match(h,/지금 보는 홈페이지 30만원으로 제작 가능합니다/);
  assert.match(h,/호스팅비는 별도/);
  assert.match(h,/\/?service=/);
  assert.doesNotMatch(h,/aggregat[e]?Rating|reviewCount|매출 [0-9]+%/);
  assert.match(h,/<style>/);
  assert.doesNotMatch(h,/portfolio\/conversion\/design\.css/);
  seen.add((h.match(/<main[^>]*>[\s\S]{0,300}/)||[''])[0].replace(/\s+/g,' ').slice(0,135));
 }
 assert.equal(seen.size,18,'eighteen sites must have distinct first section structure');
 for(const [id,required] of Object.entries({
  stay:['id="demoBooking"','id="arrival"','id="departure"','id="bookingStatus"'],
  interior:['id="briefForm"','id="spaceType"','id="briefResult"'],
  academy:['role="tablist"','id="coursePanel"','data-level="adult"'],
  pet:['id="petSurvey"','id="surveyOutput"','id="petSize"'],
  shop:['id="addToBag"','id="bagCount"','id="quantity"'],
  legal:['data-topic="corporate"','id="topicStatus"'],
  clinic:['data-check','id="progress"'],
  auto:['id="showInfo"','id="result"'],
  fitness:['data-day="wed"','id="classStatus"'],
  estate:['id="searchForm"','id="searchResult"'],
  hrd:['id="brief"','id="summary"'],
  tax:['data-tax="company"','id="taxTitle"'],
  moving:['id="moveForm"','id="moveResult"'],
  cleaning:['id="cleanCompare"','id="cleanItems"'],
  pilates:['data-day="wed"','id="classSlots"']
 }))for(const marker of required)assert.match(fs.readFileSync('portfolio/conversion/'+id+'/index.html','utf8'),new RegExp(marker));
});
test('all 18 award-inspired fictional websites have business identities, tailored service content, and honest demo disclosure',()=>{
 const brands={
  restaurant:'계절상회',beauty:'온결',b2b:'지음시스템즈',shop:'GOOD BEANS',
  stay:'라움 스테이',interior:'폼스페이스',academy:'봄아카데미',pet:'몽글살롱',
  legal:'베리타스',clinic:'클리어케어',auto:'핏웍스',fitness:'무브모어',
  estate:'룸인덱스',hrd:'런웍스',tax:'밸런스택스',moving:'무브온',cleaning:'클린랩',pilates:'포르마'
 };
 const sig={
  restaurant:'season-atelier',beauty:'ongyeol-book',b2b:'zieum-network',shop:'goodbeans-product',
  stay:'raum-letter',interior:'formspace-plan',academy:'beaum-route',pet:'mongle-play',
  legal:'veritas-notes',clinic:'clinic-visit',auto:'pitworks-parts',fitness:'movemore-tiles',
  estate:'roomindex-properties',hrd:'learnworks-program',tax:'balance-ledger',moving:'moveon-checklist',
  cleaning:'cleanlab-index',pilates:'forma-classes'
 };
 const hub=fs.readFileSync('portfolio/conversion/index.html','utf8');
 assert.match(hub,/18 DIFFERENT/);
 assert.equal((hub.match(/class="showcase /g)||[]).length,18);
 assert.equal((hub.match(/class="case-chip"/g)||[]).length,18);
 assert.equal((hub.match(/class="studio-index"/g)||[]).length,1);
 for(const [id,name] of Object.entries(brands)){
  const html=fs.readFileSync('portfolio/conversion/'+id+'/index.html','utf8');
  assert.ok(html.includes(name),id+' must explain its fictional business identity');
  assert.ok(html.includes('class="'+sig[id]+'"'),id+' must have unique new art-directed section');
  assert.ok(html.includes('id="brand-highlights"'),id+' custom narrative section anchor');
  assert.ok(html.includes('실존 업체가 아닌')||html.includes('가상'),id+' must disclose fictional nature');
  assert.equal((html.match(/<h1\b/g)||[]).length,1,id+' must have one hero H1');
  assert.match(html,/portfolio-creator-cta/);
  assert.match(html,/지금 보는 홈페이지 30만원으로 제작 가능합니다/);
  assert.match(html,/호스팅비는 별도/);
  assert.match(html,/noindex,follow/);
 }
});

test('Naver blog button studio and long-form detailed product portfolio remain intact',()=>{
 const blog=fs.readFileSync('portfolio/brand-blogs/index.html','utf8');
 const buttons=fs.readFileSync('portfolio/brand-blogs/buttons/index.html','utf8');
 const builder=fs.readFileSync('portfolio/brand-blogs/buttons/builder.js','utf8');
 assert.match(blog,/brand-blog-action-nav/);
 assert.match(buttons,/buttonFields/);assert.match(buttons,/hostedImage/);
 assert.match(buttons,/pcCanvas/);assert.match(buttons,/mobileCanvas/);
 assert.match(builder,/toBlob/);assert.match(builder,/image\/png/);
 assert.doesNotThrow(()=>new vm.Script(builder));
 const detail=fs.readFileSync('portfolio/product-pages/index.html','utf8');
 for(const slug of ['moringa','lumin','brew']){
  assert.ok(detail.includes('href="/portfolio/product-pages/'+slug+'/"'),slug+' must have an openable full-page link');
  const product=fs.readFileSync('portfolio/product-pages/'+slug+'/index.html','utf8');
  assert.match(product,/THE BRAND STORY/);
  assert.match(product,/PRODUCT INFORMATION/);
  assert.match(product,/BEFORE YOU CHOOSE/);
  assert.ok((product.match(/<img\b/g)||[]).length>=9,slug+' needs a photo-led long page');
 }
});

test('admin studio supports safe scoped editing without changing other sections',()=>{
 const presets=JSON.parse(fs.readFileSync('site-builder/presets.json','utf8'));
 const code=fs.readFileSync('site-builder/kit.js','utf8');
 const context={window:{}};vm.runInNewContext(code,context);
 const kit=context.window.MomentumSiteKit;
 const a=kit.normalize(presets[0]);
 const before=kit.render(a,'');
 a.sectionStyles.about={background:'#e4e4dd',titleSize:44,spacing:90};
 const after=kit.render(a,'');
 assert.notEqual(before,after);
 assert.match(after,/#about\{background:#e4e4dd/);
 assert.match(after,/#about h1,#about h2\{font-size:clamp\(25px,6vw,44px\)!important/);
 assert.doesNotMatch(after,/#services\{background:/);
 assert.match(after,/오늘의 계절 메뉴/);
 a.sectionStyles.about.titleSize='9999';
 const invalid=kit.render(a,'');
 assert.doesNotMatch(invalid,/9999px/);
 const editor=fs.readFileSync('site-builder/editor.js','utf8');
 assert.match(editor,/interactivePreview/);
 assert.match(editor,/undoStack/);
 assert.match(editor,/momentum-preview-select/);
 const ui=fs.readFileSync('site-builder/index.html','utf8');
 assert.match(ui,/data-tab="part"/);
 assert.match(ui,/id="undoEdit"/);
 assert.match(ui,/sandbox="allow-scripts"/);
});


test('internal CRM product catalog and admin-only authentication protect private files',()=>{
 const catalog=JSON.parse(fs.readFileSync('site-builder/products.json','utf8')).products;
 const names=catalog.map(x=>x.name);
 assert.equal(catalog.length,18);
 assert.equal(new Set(names).size,18);
 for(const name of ['블로그체험단','블로그기자단','카페상위노출','플레이스트래픽','블로그배포','카페건바이','네이버광고대행','블로그상위노출','클립대행','인스타건바이','인스타상위노출','인스타계정대행','쓰레드대행','인플루언서 섭외','외국인 인플루언서 섭외','홈페이지제작','홈페이지재연장','상세페이지제작']){
  assert.ok(names.includes(name),name);
 }
 for(const file of ['crm-index.html','crm.css','crm.js','crm-commerce.js']){
  assert.ok(fs.statSync('site-builder/'+file).size>200,file);
 }
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync('site-builder/crm.js','utf8')));
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync('site-builder/crm-commerce.js','utf8')));
 const html=fs.readFileSync('site-builder/crm-index.html','utf8');
 for(const id of ['customerForm','contractForm','renewalList','catalogFilters','productGrid','recordList','exportCalendar','exportData','importData','supplierForm','supplierRates','bundleForm','bundleLines','bundleRecords','usageForm']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 const v=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 assert.ok(v.rewrites.some(x=>x.source==='/admin/crm/'&&x.destination.includes('view=crm')));
 const handler=require('../api/admin-site-builder.js');
 const password=process.env.MOMENTUM_ADMIN_PASSWORD,secret=process.env.MOMENTUM_SESSION_SECRET;
 const request=(req)=>{
  const res={statusCode:200,headers:{},body:'',setHeader(k,v){this.headers[k.toLowerCase()]=v},end(body){this.body=body==null?'':String(body);return this}};
  handler(req,res);return res;
 };
 try{
  delete process.env.MOMENTUM_ADMIN_PASSWORD;
  delete process.env.MOMENTUM_SESSION_SECRET;
  const setup=request({method:'GET',headers:{host:'momentum.test'},query:{view:'crm'}});
  assert.equal(setup.statusCode,503);
  assert.match(setup.body,/MOMENTUM_ADMIN_PASSWORD/);
  assert.match(setup.body,/MOMENTUM_SESSION_SECRET/);
  assert.doesNotMatch(setup.body,/id="customerForm"/);
  process.env.MOMENTUM_ADMIN_PASSWORD='very-long-test-admin-password';
  process.env.MOMENTUM_SESSION_SECRET='test_secret_0123456789_AABBCC_DDEEFF_XXYY';
  const base={method:'GET',headers:{host:'momentum.test',cookie:''},query:{view:'crm'}};
  const before=request(base);
  assert.equal(before.statusCode,200);
  assert.match(before.body,/관리자 로그인/);
  const blocked=request({...base,query:{asset:'products.json'}});
  assert.equal(blocked.statusCode,401);
  const login=request({method:'POST',headers:{host:'momentum.test',origin:'https://momentum.test'},query:{action:'login'},body:{password:process.env.MOMENTUM_ADMIN_PASSWORD}});
  assert.equal(login.statusCode,303);
  assert.ok(String(login.headers['set-cookie']).includes('HttpOnly'));
  const cookie=String(login.headers['set-cookie']).split(';')[0];
  const authorized=request({...base,headers:{host:'momentum.test',cookie}});
  assert.match(authorized.body,/id="customerForm"/);
  const asset=request({...base,headers:{host:'momentum.test',cookie},query:{asset:'products.json'}});
  assert.equal(asset.statusCode,200);
  assert.equal(JSON.parse(asset.body).products.length,18);
  const module=request({...base,headers:{host:'momentum.test',cookie},query:{asset:'crm-commerce.js'}});
  assert.equal(module.statusCode,200);
  assert.match(module.body,/function saveBundle/);
 }finally{
  if(password===undefined)delete process.env.MOMENTUM_ADMIN_PASSWORD;else process.env.MOMENTUM_ADMIN_PASSWORD=password;
  if(secret===undefined)delete process.env.MOMENTUM_SESSION_SECRET;else process.env.MOMENTUM_SESSION_SECRET=secret;
 }
});


test('independent portfolio design editor has authenticated route and safe local preview controls',()=>{
 const html=fs.readFileSync('site-builder/design-editor.html','utf8');
 const script=fs.readFileSync('site-builder/design-editor.js','utf8');
 const css=fs.readFileSync('site-builder/design-editor.css','utf8');
 const api=fs.readFileSync('api/admin-site-builder.js','utf8');
 const vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 for(const id of ['designSelect','livePreview','headlineInput','heroFile','saveDraft','saveJson','loadJson','exportHtml'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.doesNotThrow(()=>new vm.Script(script));
 assert.match(script,/momentum-independent-design-draft/);
 assert.match(script,/textContent/);
 assert.match(script,/safeImage/);
 assert.match(script,/safeLink/);
 assert.match(script,/Object\.entries\(draft\)/);
 assert.match(css,/previewOuter\.isMobile/);
 for(const name of ['design-editor.html','design-editor.css','design-editor.js'])assert.match(api,new RegExp(name.replace('.','\\\.')));
 assert.match(api,/view==='designs'/);
 assert.ok(vercel.rewrites.some(x=>x.source==='/admin/designs/'&&x.destination.includes('view=designs')));
 assert.match(fs.readFileSync('site-builder/index.html','utf8'),/href="\/admin\/designs\/"/);
});

test('keyword explorer produces intent-first candidates without invented search counts',()=>{
 const engine=require('../api/keyword-opportunities.js');
 const result=engine.generate('부산 사다리차');
 assert.equal(result.region,'부산');
 assert.equal(result.industry,'출장·생활서비스');
 assert.ok(result.candidates.length>=12);
 assert.ok(result.candidates.some(x=>x.keyword.includes('견적')));
 assert.ok(result.candidates.some(x=>x.priority>=75));
 assert.ok(result.candidates.every(x=>x.monthlyTotal===null&&x.source==='heuristic'));
 const joined=engine.joinAds(engine.generate('부산 사다리차'),{status:'connected',rows:[{keyword:'부산사다리차',pc:200,mobile:800,adCompetition:'높음'}]});
 assert.ok(joined.candidates.some(x=>x.source==='naver_searchads'&&x.monthlyTotal===1000));
 assert.equal(engine.parseCount('< 10').lessThan,10);
 assert.equal(engine.parseCount('invalid'),null);
 const html=fs.readFileSync('lab/keywords/index.html','utf8');
 const script=fs.readFileSync('lab/keywords/keywords.js','utf8');
 assert.match(html,/키워드 기회 탐색기/);
 assert.match(html,/실측/);
 assert.match(fs.readFileSync('lab/index.html','utf8'),/href="\/lab\/keywords\/"/);
 assert.doesNotThrow(()=>new vm.Script(script));
});


test('rank tracker distinguishes actual observation from blog API ranking and never invents position',()=>{
 const endpoint=require('../api/blog-rank-observation.js');
 const parsed=endpoint.parseTarget('https://blog.naver.com/testblog/12345678');
 assert.deepEqual({id:parsed.blogId,post:parsed.postId,kind:parsed.kind},{id:'testblog',post:'12345678',kind:'post'});
 assert.throws(()=>endpoint.parseTarget('https://evil.com/blog/testblog/1234'));
 assert.equal(endpoint.enabled(),false);
 assert.deepEqual(endpoint.rankOf([{link:'https://blog.naver.com/otherid/111'},{link:'https://blog.naver.com/testblog/12345678'}],'https://blog.naver.com/testblog/12345678').rank,2);
 assert.equal(endpoint.rankOf([{link:'https://blog.naver.com/testblog/12345679'}],'https://blog.naver.com/testblog/12345678').rank,null);
 assert.equal(endpoint.rankOf([{link:'https://blog.naver.com/testblog/12345679'}],'https://blog.naver.com/testblog').rank,1);
 const page=fs.readFileSync('lab/rank/index.html','utf8');
 const js=fs.readFileSync('lab/rank/rank.js','utf8');
 assert.match(page,/id="rankForm"/);
 assert.match(page,/id="history"/);
 assert.match(page,/블로그 검색 API/);
 assert.match(page,/자동 일간 추적·알림은 아직 연결되지 않았습니다/);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(js,/momentum-rank-observations-v1/);
 assert.match(js,/rankNumber/);
 assert.match(fs.readFileSync('lab/index.html','utf8'),/href="\/lab\/rank\/"/);
});

test('automatic Naver Place-block browser observation is exact-ID matched and scoped',()=>{
 const engine=require('../api/_place-observe.js');
 assert.equal(engine.placeId('https://map.naver.com/p/entry/place/1234567890'),'1234567890');
 assert.equal(engine.placeId('https://m.place.naver.com/place/1234567890'),'1234567890');
 assert.equal(engine.placeId('1234567890'),'1234567890');
 assert.equal(engine.placeId('https://evilnaver.com/place/1234567890'),null);
 assert.equal(engine.placeId('https://naver.com.evil.test/place/1234567890'),null);
 assert.equal(engine.validateKeyword('포항 물회'),'포항 물회');
 assert.equal(engine.validateKeyword('<script>'),null);
 const items=[{id:'7777777',name:'A'},{id:'8888888',name:'B',ad:true},{id:'9999999',name:'C'},{id:'8888888',name:'dup'}];
 assert.equal(engine.reduceResult(items,'9999999').rank,3);
 assert.equal(engine.reduceResult(items,'9999999').adExcludedRank,2);
 assert.equal(engine.reduceResult(items,'8888888').adExcludedRank,null);
 assert.equal(engine.reduceResult(items,'1000000').status,'not_in_block');
 assert.equal(engine.reduceResult(items,'1000000').rank,null);
 assert.equal(engine.reduceResult([], '1000000').status,'no_place_block');
 const live=require('../api/place-rank-live.js');
 assert.equal(typeof live,'function');
 const rank=fs.readFileSync('lab/rank/index.html','utf8');
 assert.match(rank,/value="live"/);
 assert.match(rank,/id="livePanel"/);
 assert.match(fs.readFileSync('lab/rank/rank.js','utf8'),/\/api\/place-rank-live/);
 const cfg=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 assert.equal(cfg.functions['api/place-rank-live.js'].maxDuration,30);
});

test('map list rank uses Naver observed metadata and never guesses beyond observed range',()=>{
 const obs=require('../api/_place-observe.js');
 const records=[{id:'2085358113',rank:1,name:'퐝물회'},{id:'12029183',rank:2,name:'환여횟집'},{id:'13485890',rank:7,name:'포항오대양'}];
 const a=obs.reduceMap(records,'13485890');
 assert.equal(a.rank,7);assert.equal(a.observedCount,3);assert.equal(a.maxObservedRank,7);
 const b=obs.reduceMap(records,'55555555');assert.equal(b.rank,null);assert.equal(b.status,'not_in_block');
 assert.equal(obs.reduceMap([],'55555555').status,'no_place_block');
 const html=fs.readFileSync('lab/rank/index.html','utf8');
 assert.match(html,/id="rankScope"/);
 assert.match(html,/네이버지도 검색 목록/);
});

test('rank-watch back office is protected, secret-less until explicitly configured, with RLS tables',async()=>{
 const auth=require('../api/admin-site-builder.js');
 assert.equal(typeof auth.isAuthorized,'function');
 assert.equal(auth.isAuthorized({headers:{cookie:''}}),false);
 const storage=require('../api/_rank-store.js');
 assert.equal(storage.config(),null);
 assert.equal(storage.uuid('00000000-0000-0000-0000-000000000001'),true);
 assert.equal(storage.uuid('other'),false);
 const sql=fs.readFileSync('db/rank-watch.sql','utf8');
 assert.match(sql,/row level security/g);
 assert.match(sql,/rank_watch_targets/);
 assert.match(sql,/rank_watch_observations/);
 const admin=require('../server-handlers/admin-rank-watches.js');
 let code=0,payload={};
 await admin({method:'GET',headers:{}},{setHeader(){},status(n){code=n;return this},json(obj){payload=obj;return this}});
 assert.equal(code,401);
 const cron=require('../api/rank-watch-cron.js');
 code=0;await cron({method:'GET',headers:{}},{setHeader(){},status(n){code=n;return this},json(obj){payload=obj;return this}});
 assert.equal(code,401);
 const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 assert.ok(config.rewrites.some(x=>x.source==='/admin/watches/api'));
 assert.match(fs.readFileSync('site-builder/index.html','utf8'),/href="\/admin\/watches\/"/);
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync('site-builder/rank-watch.js','utf8')));
});

test('deep list ordering is estimated, not falsely presented as an official Naver map rank',()=>{
 const obs=require('../api/_place-observe.js');
 const rows=[];
 for(let i=0;i<25;i++){const n=i%10+1;rows.push({id:String(10000000+i),rank:n,name:'업체'+i})}
 const result=obs.reduceMap(rows,'10000019');
 assert.equal(result.status,'ranked');
 assert.equal(result.rank,20);
 assert.equal(result.rankApproximate,true);
 assert.equal(result.rankBasis,'estimated_from_loaded_page_order');
 assert.equal(obs.reduceMap(rows,'10000000').rankApproximate,false);
 assert.match(result.message,/추정치/);
 const script=fs.readFileSync('lab/rank/rank.js','utf8');
 assert.match(script,/약 /);
 assert.match(script,/rankApproximate/);
});


test('mobile Place uses separate name-or-ID matching and conservative rank semantics',()=>{
 const engine=require('../api/_place-observe.js');
 assert.equal(engine.placeId('https://m.place.naver.com/restaurant/2085358113/home'),'2085358113');
 assert.equal(engine.mobileTarget('퐝물회').name,'퐝물회');
 assert.equal(engine.mobileTarget('2085358113').id,'2085358113');
 assert.equal(engine.mobileTarget('https://m.place.naver.com/restaurant/2085358113/home').id,'2085358113');
 assert.equal(engine.mobileTarget('https://untrusted.test/place/2085358113'),null);
 const list=[
  {id:'2085358113',name:'퐝물회',rank:null},
  {id:'12029183',name:'환여횟집',rank:null}
 ];
 const idRank=engine.reduceMobile(list,engine.mobileTarget('2085358113'));
 assert.equal(idRank.status,'ranked');
 assert.equal(idRank.rank,1);
 assert.equal(idRank.rankApproximate,true);
 assert.equal(idRank.rankBasis,'visible_mobile_list_order_estimate');
 const nameRank=engine.reduceMobile(list,engine.mobileTarget('퐝물회'));
 assert.equal(nameRank.matchedId,'2085358113');
 assert.equal(engine.reduceMobile(list,engine.mobileTarget('없는업체')).status,'not_in_block');
 const duplicate=engine.reduceMobile([...list,{id:'99999999',name:'퐝물회'}],engine.mobileTarget('퐝물회'));
 assert.equal(duplicate.status,'ambiguous');
 assert.equal(duplicate.rank,null);
 assert.equal(engine.reduceMobile([],engine.mobileTarget('퐝물회')).status,'no_place_block');
 const provider=engine.reduceMobile([{id:'2085358113',name:'퐝물회',rank:5}],engine.mobileTarget('2085358113'));
 assert.equal(provider.rank,5);
 assert.equal(provider.rankApproximate,false);
 const html=fs.readFileSync('lab/rank/index.html','utf8');
 const ui=fs.readFileSync('lab/rank/rank.js','utf8');
 const api=fs.readFileSync('api/place-rank-live.js','utf8');
 assert.match(html,/value="mobile" selected/);
 assert.match(ui,/모바일 플레이스 목록/);
 assert.match(api,/runMobile\(keyword,mobileTarget\)/);
 assert.doesNotThrow(()=>new vm.Script(ui));
});


test('mobile rank admin accepts business-name targets without losing exact Place IDs',()=>{
 const admin=fs.readFileSync('server-handlers/admin-rank-watches.js','utf8');
 const worker=fs.readFileSync('api/rank-watch-cron.js','utf8');
 const sql=fs.readFileSync('db/rank-watch.sql','utf8');
 assert.match(admin,/target_name/);
 assert.match(admin,/observer\.mobileTarget\(rawTarget\)/);
 assert.match(worker,/item\.target_name/);
 assert.match(worker,/observer\.runMobile/);
 assert.match(fs.readFileSync('site-builder/rank-watch-index.html','utf8'),/업체명 또는 플레이스 URL·ID/);
 assert.equal((sql.match(/create table if not exists public\.rank_watch_targets/g)||[]).length,1);
 assert.equal((sql.match(/create table if not exists public\.rank_watch_observations/g)||[]).length,1);
 assert.match(sql,/create unique index if not exists rank_watch_targets_name_scope_unique/);
 assert.match(sql,/alter table public\.rank_watch_targets add column if not exists target_name/);
 assert.match(sql,/scope in \('mobile','map','integrated'\)/);
 assert.doesNotMatch(sql,/\)\s*,\s*target_name text[\s\S]*?create table if not exists public\.rank_watch_observations[\s\S]*?create table if not exists public\.rank_watch_observations/);
});

test('mobile rank is conservative when names overlap or provider positions restart',()=>{
 const observer=require('../api/_place-observe.js');
 const target=observer.mobileTarget('2085358113');
 const nameTarget=observer.mobileTarget('퐝물회');
 const entries=[{id:'5555555',name:'매장1',rank:8},{id:'2085358113',name:'퐝물회',rank:1}];
 const result=observer.reduceMobile(entries,target);
 assert.equal(result.status,'ranked');
 assert.equal(result.rank,2);
 assert.equal(result.rankApproximate,true);
 const byName=observer.reduceMobile([{id:'2085358113',name:'퐝물회',rank:85}],nameTarget);
 assert.equal(byName.rank,85);
 assert.equal(byName.rankApproximate,true);
 assert.equal(byName.rankBasis,'mobile_name_match_requires_id');
 const duplicate=observer.reduceMobile([
  {id:'2085358113',name:'퐝물회',rank:85},
  {id:'777777777',name:'퐝물회',rank:86},
 ],nameTarget);
 assert.equal(duplicate.status,'ambiguous');
 assert.equal(duplicate.rank,null);
});

test('conversion portfolios are standalone sites with different information architecture, menus and interactions',()=>{
 const types={
  restaurant:{hero:'editorial-hero',unique:'menu-story',menu:'restaurant-navigation',marker:'THE MENU BOOK',faq:3},
  beauty:{hero:'cover-grid',unique:'look-strip',menu:'head',marker:'STYLE EDITORIAL',faq:3},
  b2b:{hero:'railnav',unique:'solution-layout',menu:'rail',marker:'BUSINESS QUESTIONS',faq:4},
  shop:{hero:'product-shell',unique:'product-actions',menu:'shop-header',marker:'PACK SIZE',faq:4}
 };
 const hub=fs.readFileSync('portfolio/conversion/index.html','utf8');
 const homepage=fs.readFileSync('index.html','utf8');
 assert.match(homepage,/href="\/portfolio\/conversion\/"/);
 assert.match(hub,/portfolio\/conversion\/restaurant/);
 for(const [id,v] of Object.entries(types)){
  const html=fs.readFileSync('portfolio/conversion/'+id+'/index.html','utf8');
  assert.match(html,/<html lang="ko">/);
  assert.match(html,/<meta name="robots" content="noindex,follow">/);
  assert.match(html,new RegExp('canonical" href="https://momentum-goldeye24-hubs-projects\\.vercel\\.app/portfolio/conversion/'+id+'/'));
  assert.match(html,/<meta name="description" content="[^"]{30,}"/);
  assert.match(html,/<meta property="og:title" /);
  assert.match(html,/<script type="application\/ld\+json">/);
  assert.equal((html.match(/<h1\b/g)||[]).length,1,id+' requires single H1');
  assert.match(html,/<main\b/);
  assert.match(html,/<header\b/);
  assert.match(html,/<footer\b/);
  assert.equal((html.match(/<details\b/g)||[]).length,v.faq,id+' unique FAQ requirements');
  assert.ok(html.includes(v.hero)&&html.includes(v.unique)&&html.includes(v.menu),id+' requires distinct structure');
  assert.ok(html.includes(v.marker),id+' requires industry-specific information');
  assert.match(html,/지금 보는 홈페이지 30만원으로 제작 가능합니다/);
  assert.match(html,/호스팅비는 별도/);
  assert.match(html,/\/?service=/);
  assert.doesNotMatch(html,/<form\b/,'No false ordering/booking form');
  assert.doesNotMatch(html,/aggregateRating|reviewCount|평점 4\.9|매출 [0-9]+%/);
  assert.doesNotMatch(html,/portfolio\/conversion\/design\.css/,'No universal look from conversion shared CSS');
  assert.ok(html.includes('<style>'),id+' needs its own CSS');
 }
 const shop=fs.readFileSync('portfolio/conversion/shop/index.html','utf8');
 for(const marker of ['id="addToBag"','id="quantity"','id="bagCount"','type="radio"','실제 주문은 처리되지 않습니다'])
  assert.ok(shop.includes(marker),marker+' actual demo interaction');
 const b2b=fs.readFileSync('portfolio/conversion/b2b/index.html','utf8');
 assert.match(b2b,/class="rail"/);
 assert.match(b2b,/class="problem-matrix"/);
});

require('./rank-live-control.test.cjs');

require('./rank-live-shared.test.cjs');

require('./keyword-matrix.test.cjs');
require('./competitor-compare.test.cjs');
require('./place-keyword-insights.test.cjs');
require('./member-portal.test.cjs');
require('./admin-members.test.cjs');
require('./member-history.test.cjs');
require('./hobby-function-budget.test.cjs');

require('./supabase-key-compat.test.cjs');

require('./admin-connection.test.cjs');

require('./admin-manual-measure.test.cjs');
require('./admin-password-remember.test.cjs');

require('./db-failure-diagnostics.test.cjs');
require('./three-service-zones.test.cjs');

test('rank-watch UI never treats a failed database request as confirmed zero rows',()=>{
 const source=fs.readFileSync('site-builder/rank-watch.js','utf8');
 assert.match(source,/DB 연결 오류로 등록 내역을 확인할 수 없습니다/);
 assert.match(source,/실제 등록 건수가 0건이라는 뜻은 아닙니다/);
 assert.match(source,/\$\('add'\)\.disabled=true/);
 assert.doesNotMatch(source,/catch\(err\)\{targets=\[\];observations=\[\];render\(\)/);
});

require('./agency-trends.test.cjs');
require('./finance-operations.test.cjs');

test('editorial marketing homepage redesign is isolated, honest and navigable',()=>{
 const h=fs.readFileSync('redesign-preview/index.html','utf8');
 assert.match(h,/<meta name="robots" content="noindex,follow">/);
 for(const anchor of ['problems','approach','cases','services','resources','contact'])assert.match(h,new RegExp('id="'+anchor+'"'));
 for(const url of ['/services/keyword-ads/','/services/place-seo/','/services/viral/','/services/sns/','/services/review-care/','/services/press/','/services/photography/','/services/education/','/lab/','/#contact'])assert.ok(h.includes('href="'+url+'"'),url);
 assert.match(h,/고객사는 가리고/);
 assert.match(h,/데모/);
 assert.match(h,/실제 실적을 나타내지 않습니다/);
 assert.doesNotMatch(h,/\+320%|\+280%|\+250%/);
 assert.match(h,/@media\(max-width:760px\)/);
 assert.match(h,/aria-expanded/);
});

test('keyword-led marketing insight guide has substance and working index route',()=>{
 const fs=require('node:fs');
 const list=fs.readFileSync('insights/index.html','utf8');
 const path='insights/guides/busan-viral-marketing-agency/index.html';
 const h=fs.readFileSync(path,'utf8');
 assert.match(list,/href="\/insights\/guides\/busan-viral-marketing-agency\/"/);
 assert.match(list,/부산바이럴마케팅 업체/);
 assert.match(h,/부산바이럴마케팅 업체/);
 assert.match(h,/블로그·체험단·인스타그램/);
 assert.match(h,/견적서를 비교할 때/);
 assert.match(h,/광고 표시/);
 assert.match(h,/검색량 수치는 확인되지 않았습니다/);
 assert.match(h,/추천ㆍ보증 등에 관한 표시ㆍ광고 심사지침/);
 assert.match(h,/<meta name="description"/);
 assert.match(h,/application\/ld\+json/);
 assert.match(h,/noindex,follow/);
 assert.equal((h.match(/<h3>[1-8]\./g)||[]).length,8);
 assert.doesNotMatch(h,/매출\s*\+\d+%|상위노출\s*100%/);
});

test('simulated proof illustrations never impersonate customer evidence',()=>{
 const h=fs.readFileSync('redesign-preview/index.html','utf8');
 assert.match(h,/가상 시뮬레이션 · 실제 고객사 실적 아님/);
 for(const name of ['marketing-before-after-simulation.svg','marketing-performance-simulation.svg']){
   const path='assets/demo/'+name;
   assert.ok(fs.existsSync(path),name);
   const svg=fs.readFileSync(path,'utf8');
   assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
   assert.match(svg,/실제 고객사 실적 아님|실제 고객사·성과와 무관/);
   assert.match(h,new RegExp('src="/assets/demo/'+name.replace(/\./g,'\\.')+'"'));
 }
 assert.doesNotMatch(h,/실제 고객 성과 320%|실제 성공 사례/);
});
test('three-hour ad education includes the full agenda and 60-day follow-up',()=>{
 const h=fs.readFileSync('services/education/index.html','utf8');
 for(const term of ['180분','20분','55분','10분','25분','15분','네이버 플레이스 설정 및 수정법','파워링크·플레이스광고 설정법','체험단','인스타그램','인플루언서','60일 카카오톡 AS'])
   assert.ok(h.includes(term),term);
 assert.doesNotMatch(h,/100% 스스로 운영 가능|모든 수강생.*보장/);
});
