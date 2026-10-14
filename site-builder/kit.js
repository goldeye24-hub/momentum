(function(){
'use strict';
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var text=function(s){return esc(s).replace(/&lt;br\s*\/?&gt;/gi,'<br>').replace(/\n/g,'<br>')};
var image=function(u){
  var s=String(u||'').trim();
  if(/^https:\/\/[^\s"'<>]+$/i.test(s))return s;
  if(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(s)&&s.length<3500000)return s;
  return '';
};
var phone=function(p){return String(p||'').replace(/[^0-9+]/g,'').slice(0,20)};
var mail=function(e){var s=String(e||'').trim();return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)&&s.length<150?s:''};
var copy=function(d){return JSON.parse(JSON.stringify(d))};
var sectionNames={about:'브랜드 소개',services:'메뉴·서비스',gallery:'사진·공간',faq:'자주 묻는 질문',contact:'문의 안내'};
function normalize(d){
  var n=copy(d||{});
  if(!n.colors)n.colors={ink:'#1d2635',background:'#faf8f5',accent:'#345be0',panel:'#e1e7f3'};
  for(var k of ['ink','background','accent','panel']){
    if(!/^#[0-9a-f]{6}$/i.test(String(n.colors[k]||'')))n.colors[k]='#334455';
  }
  if(!['restaurant','beauty','academy','clinic','corporate'].includes(n.style))n.style='corporate';
  for(var arr of ['services','gallery','faq'])if(!Array.isArray(n[arr]))n[arr]=[];
  n.services=n.services.slice(0,12).map(function(s){return {title:String(s.title||'').slice(0,120),description:String(s.description||'').slice(0,400)}});
  n.gallery=n.gallery.slice(0,12).map(function(s){return {title:String(s.title||'').slice(0,120),description:String(s.description||'').slice(0,300),image:image(s.image)}});
  n.faq=n.faq.slice(0,12).map(function(s){return {question:String(s.question||'').slice(0,160),answer:String(s.answer||'').slice(0,700)}});
  var allowed=Object.keys(sectionNames);
  n.sectionOrder=Array.isArray(n.sectionOrder)?n.sectionOrder.filter(function(v,i,a){return allowed.includes(v)&&a.indexOf(v)===i}):allowed;
  for(var v of allowed)if(!n.sectionOrder.includes(v))n.sectionOrder.push(v);
  n.sectionEnabled=n.sectionEnabled&&typeof n.sectionEnabled==='object'?n.sectionEnabled:{};
  for(var a of allowed)if(typeof n.sectionEnabled[a]!=='boolean')n.sectionEnabled[a]=true;
  if(typeof n.demoMode!=='boolean')n.demoMode=true;
  n.heroImage=image(n.heroImage);n.aboutImage=image(n.aboutImage);
  return n;
}
function render(d,css){
 var c=normalize(d),color=c.colors;
 var media=function(url,alt){return url?'<img src="'+esc(url)+'" alt="'+esc(alt)+'" loading="lazy" decoding="async">':'<span class="fallback-photo" aria-label="이미지 등록 전"></span>'};
 var name=esc(c.brand||'브랜드명');
 var ribbon=c.demoMode===false?'':'<div class="sample-ribbon"><strong>디자인 시안</strong> · 가상 브랜드를 활용한 샘플로 실제 업체가 아닙니다</div>';
 var nav='<div class="site-shell"><header class="site-header"><a class="site-logo" href="#top">'+name+'</a><nav class="site-nav" aria-label="사이트 메뉴">';
  c.sectionOrder.filter(function(id){return c.sectionEnabled[id]}).slice(0,4).forEach(function(id){nav+='<a href="#'+id+'">'+sectionNames[id]+'</a>'});
  nav+='</nav></header></div>';
 var contactUrl=phone(c.phone)?'tel:'+phone(c.phone):(mail(c.email)?'mailto:'+mail(c.email):'#contact');
 var hero='<section id="top" class="site-shell site-hero"><div class="hero-text"><div class="hero-label">'+esc(c.tagline)+'</div><h1>'+text(c.headline)+'</h1><p>'+text(c.description)+'</p><a class="site-primary" href="'+esc(contactUrl)+'">'+esc(c.cta||'문의하기')+' <span aria-hidden="true">↗</span></a></div><div class="hero-media">'+media(c.heroImage,(c.brand||'브랜드')+' 이미지')+'<span class="hero-art">'+name+' · 브랜드 이야기</span></div></section>';
 var ticker='<div class="site-shell site-ticker"><span>브랜드 소개</span><span>메뉴와 서비스</span><span>공간과 경험</span><span>상담 안내</span></div>';
 var serviceKind={restaurant:'대표 메뉴',beauty:'스타일링',academy:'교육과정',clinic:'진료 안내',corporate:'사업 분야'}[c.style]||'서비스';
 var sections={
  about:'<section id="about" class="site-section"><div class="site-shell about-grid"><div class="about-photo">'+media(c.aboutImage,name+' 공간 사진')+'</div><div class="about-copy"><span class="section-kicker">01 / 브랜드 이야기</span><h2>'+text(c.aboutTitle)+'</h2><p>'+text(c.aboutText)+'</p><div class="about-number">01.</div></div></div></section>',
  services:'<section id="services" class="site-section"><div class="site-shell"><div class="section-head"><div><span class="section-kicker">02 / 주요 서비스</span><h2>'+text(c.servicesTitle)+'</h2></div><p>고객이 궁금해하는 내용을 짧고 명확하게 전합니다.</p></div><div class="services-grid">'+c.services.map(function(s,i){return '<article class="service-card"><span class="number">0'+(i+1)+' / '+esc(serviceKind)+'</span><h3>'+text(s.title)+'</h3><p>'+text(s.description)+'</p></article>'}).join('')+'</div></div></section>',
  gallery:'<section id="gallery" class="site-section"><div class="site-shell"><div class="section-head"><div><span class="section-kicker">03 / 사진과 공간</span><h2>'+text(c.galleryTitle)+'</h2></div><p>사진으로 분위기와 실제 정보를 전달합니다.</p></div><div class="gallery-grid">'+c.gallery.map(function(s){return '<div class="gallery-tile"><div class="gallery-image">'+media(s.image,s.title)+'</div><strong>'+text(s.title)+'</strong><p>'+text(s.description)+'</p></div>'}).join('')+'</div></div></section>',
  faq:'<section id="faq" class="site-section"><div class="site-shell"><div class="section-head"><div><span class="section-kicker">04 / 자주 묻는 질문</span><h2>'+text(c.faqTitle)+'</h2></div></div><div class="faq-list">'+c.faq.map(function(s){return '<details><summary>'+text(s.question)+'</summary><p>'+text(s.answer)+'</p></details>'}).join('')+'</div></div></section>',
  contact:'<section id="contact" class="site-section"><div class="site-shell"><div class="contact-panel"><div><span class="section-kicker">05 / 문의 안내</span><h2>'+text(c.contactTitle)+'</h2><p>'+text(c.contactText)+'</p></div><a class="site-primary" href="'+esc(contactUrl)+'">'+esc(c.cta||'문의하기')+' ↗</a></div></div></section>'
 };
 var blocks=c.sectionOrder.filter(function(id){return c.sectionEnabled[id]}).map(function(id){return sections[id]}).join('');
 var footer=c.demoMode===false?'<div class="site-shell"><footer class="site-footer"><span>© '+name+' · All rights reserved.</span></footer></div>':'<div class="site-shell"><footer class="site-footer"><span>© '+name+' · <strong>업종별 홈페이지 제작 샘플</strong></span><a href="https://momentum-goldeye24-hubs-projects.vercel.app/website-samples/" target="_blank" rel="noopener noreferrer">모멘텀마케팅 제작툴 ↗</a></footer></div>';
 var quick=(phone(c.phone)||mail(c.email))?'<div class="mobile-quick-contact"><a href="'+esc(contactUrl)+'">'+esc(c.cta||'문의하기')+' ↗</a></div>':'';
 var rule=':root{--ink:'+color.ink+';--bg:'+color.background+';--accent:'+color.accent+';--panel:'+color.panel+'}';
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+name+(c.demoMode===false?' | 공식 홈페이지':' | 홈페이지 디자인 샘플')+'</title><meta name="description" content="'+esc(String(c.description||'').slice(0,145))+'"><meta property="og:locale" content="ko_KR"><meta property="og:type" content="website"><meta property="og:title" content="'+name+'"><meta property="og:description" content="'+esc(String(c.description||'').slice(0,145))+'"><style>'+String(css||'')+'\n'+rule+'</style></head><body class="style-'+esc(c.style)+'">'+ribbon+nav+'<main>'+hero+ticker+blocks+'</main>'+quick+footer+'</body></html>';
}
window.MomentumSiteKit={normalize:normalize,render:render,sectionNames:sectionNames,copy:copy};
})();