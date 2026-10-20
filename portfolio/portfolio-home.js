(()=>{'use strict';
const domains=[
{slug:'restaurant',name:'음식점',desc:'예약과 방문이 늘어나는 홈페이지'},
{slug:'beauty',name:'미용실',desc:'브랜드 감성이 돋보이는 홈페이지'},
{slug:'clinic',name:'병원·의원',desc:'신뢰를 주는 전문 홈페이지'},
{slug:'enterprise',name:'중견기업형',desc:'사업역량과 기술력을 담은 기업사이트'},
{slug:'pet',name:'반려견미용',desc:'예약을 돕는 반려동물 사이트'},
{slug:'b2b',name:'B2B 기업',desc:'솔루션과 기술사업 소개'},
{slug:'interior',name:'인테리어',desc:'공간 포트폴리오를 중심으로'},
{slug:'academy',name:'학원',desc:'강사진·교육과정 중심의 소개'},
{slug:'stay',name:'풀빌라',desc:'객실 경험과 이용정보 중심'},
{slug:'estate',name:'부동산',desc:'공간과 매물의 가치를 담은 화면'},
{slug:'shop',name:'쇼핑몰',desc:'상품 비교와 선택을 돕는 화면'},
{slug:'fitness',name:'피트니스',desc:'프로그램을 쉽게 둘러보는 사이트'},
{slug:'legal',name:'법률사무소',desc:'전문성과 신뢰를 표현한 사이트'},
{slug:'auto',name:'자동차 정비',desc:'정비 서비스와 과정을 전달'},
{slug:'tax',name:'세무회계',desc:'신뢰 중심의 전문가 홈페이지'},
{slug:'hrd',name:'기업교육',desc:'프로그램과 상담을 연결'},
{slug:'moving',name:'이사업체',desc:'이사 절차와 서비스 안내'},
{slug:'cleaning',name:'입주청소',desc:'서비스 범위와 작업 방법 안내'},
{slug:'pilates',name:'필라테스',desc:'수업과 스튜디오 소개'}
];
const products=[
{slug:'moringa',name:'모링가 된장',desc:'전통의 맛을 담은 건강한 한 숟갈',eyebrow:'MORINGA / FERMENT',head:'자연을 담은<br>모링가 된장',src:'https://commons.wikimedia.org/wiki/Special:FilePath/Doenjangwithbeans.jpg',shade:'dark'},
{slug:'lumin',name:'뷰티 세럼',desc:'피부가 빛나는 순간',eyebrow:'LUMIN / SKINCARE',head:'가벼운 한 방울,<br>빛나는 변화',src:'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80',shade:'light'},
{slug:'taily',name:'반려견 덴탈츄',desc:'씹는 즐거움과 건강을 동시에',eyebrow:'TAILY / PET',head:'우리 아이의<br>건강한 하루',src:'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=900&q=80',shade:'light'},
{slug:'puremild',name:'주방세제',desc:'일상에 더하는 산뜻한 청결',eyebrow:'PURE MILD / HOME',head:'깨끗한 일상,<br>더 편안하게',src:'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=80',shade:'light'},
{slug:'coolrest',name:'여름 이불',desc:'가볍고 시원한 휴식',eyebrow:'COOL REST / LIVING',head:'가볍고 시원한<br>여름의 휴식',src:'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=900&q=80',shade:'light'},
{slug:'rootvein',name:'두피케어 샴푸',desc:'두피를 위한 산뜻한 루틴',eyebrow:'ROOTVEIN / HAIR',head:'두피의 시작은<br>바른 루틴',src:'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=80',shade:'dark'},
{slug:'cleandock',name:'칫솔살균기',desc:'위생적인 보관 습관',eyebrow:'CLEANDOCK / TECH',head:'일상의 위생을<br>한 단계 더',src:'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=900&q=80',shade:'light'},
{slug:'airy',name:'미니팬',desc:'나만의 작은 바람',eyebrow:'AIRY / ELECTRONICS',head:'작지만 가볍게<br>시원한 순간',src:'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=900&q=80',shade:'light'},
{slug:'galbitang',name:'한우 갈비탕',desc:'오래 끓여 깊어진 한 그릇',eyebrow:'KOREAN FOOD',head:'오래 끓여<br>깊어진 맛',src:'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',shade:'dark'},
{slug:'crab',name:'프리미엄 대게',desc:'바다의 신선함을 식탁으로',eyebrow:'SEAFOOD / PREMIUM',head:'바다의 풍미를<br>한 상에',src:'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=900&q=80',shade:'dark'},
{slug:'brew',name:'굿빈스 커피',desc:'한 잔의 향과 취향',eyebrow:'GOOD BEANS / COFFEE',head:'한 잔의 향,<br>취향의 발견',src:'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=80',shade:'dark'}
];
const blogs=[
{name:'미용실 블로그',desc:'감각적인 브랜드 스토리',kind:'salon',title:'TheSalon<br>Journal.',text:'일상이 아름다워지는 순간',img:'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',url:'/portfolio/brand-blogs/#salon'},
{name:'맛집 블로그',desc:'방문을 부르는 콘텐츠',kind:'food',title:'오늘도 맛있는<br>하루',text:'우리 동네 식탁의 기록',img:'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',url:'/portfolio/brand-blogs/#local'},
{name:'전문가 블로그',desc:'신뢰를 쌓는 전문 콘텐츠',kind:'expert',title:'생각이 모여<br>성장을 만들다',text:'조직의 변화를 기록하는 이야기',img:'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80',url:'/portfolio/brand-blogs/#expert-articles'}
];
const htmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={web:0,detail:0,blog:0};
function webCard(item){
return `<a class="work-card" href="/portfolio/conversion/${item.slug}/" aria-label="${htmlEscape(item.name)} 전체 홈페이지 시안 열기"><div class="work-preview"><iframe src="/portfolio/conversion/${item.slug}/" loading="lazy" tabindex="-1" title="${htmlEscape(item.name)} 홈페이지 미리보기" aria-hidden="true"></iframe></div><div class="work-info"><h3>${htmlEscape(item.name)}</h3><p>${htmlEscape(item.desc)}</p></div></a>`;
}
function productCard(item){
return `<a class="work-card" href="/portfolio/product-pages/${item.slug}/" aria-label="${htmlEscape(item.name)} 상세페이지 전체 보기"><div class="work-preview"><img class="product-img" src="${item.src}" loading="lazy" alt="${htmlEscape(item.name)} 관련 제품 콘셉트 이미지"><span class="image-shade ${item.shade==='light'?'light':''}"></span><span class="product-copy ${item.shade==='light'?'light':''}"><span>${htmlEscape(item.eyebrow)}</span><strong>${item.head}</strong></span></div><div class="work-info"><h3>${htmlEscape(item.name)}</h3><p>${htmlEscape(item.desc)}</p></div></a>`;
}
function blogCard(item){
return `<a class="work-card" href="${item.url}" aria-label="${htmlEscape(item.name)} 제작 시안 보기"><div class="work-preview"><div class="blog-browser"><div class="blog-browser-header"><b>${htmlEscape(item.name)}</b><span>BRAND JOURNAL / STORIES</span></div><div class="blog-cover"><div class="blog-text"><small>EDITOR'S NOTE / 2026</small><strong>${item.title}</strong><span>${htmlEscape(item.text)}</span></div><img src="${item.img}" loading="lazy" alt="${htmlEscape(item.name)} 연출 참고 사진"></div></div></div><div class="work-info"><h3>${htmlEscape(item.name)}</h3><p>${htmlEscape(item.desc)}</p></div></a>`;
}
const collection={web:domains,detail:products,blog:blogs};
const render={web:webCard,detail:productCard,blog:blogCard};
const onePage={web:3,detail:3,blog:3};
function paint(key){
 const grid=document.getElementById(key+'-cards');
 const list=collection[key];
 if(!grid||!list)return;
 const page=state[key],start=page*onePage[key];
 grid.innerHTML=list.slice(start,start+onePage[key]).map(render[key]).join('');
 const max=Math.ceil(list.length/onePage[key]);
 const counter=document.getElementById(key+'-status');
 if(counter)counter.textContent=(page+1)+' / '+max;
 document.querySelectorAll('[data-slider="'+key+'"]').forEach(btn=>{
   if(btn.dataset.direction==='prev')btn.disabled=page===0;
   if(btn.dataset.direction==='next')btn.disabled=page>=max-1;
 });
}
document.querySelectorAll('[data-slider]').forEach(btn=>btn.addEventListener('click',()=>{
 const key=btn.dataset.slider;
 const step=btn.dataset.direction==='next'?1:-1;
 const max=Math.ceil(collection[key].length/onePage[key])-1;
 state[key]=Math.max(0,Math.min(max,state[key]+step));
 paint(key);
}));
Object.keys(state).forEach(paint);
const menu=document.getElementById('nav-menu');
const toggle=document.getElementById('menu-toggle');
if(toggle&&menu){
 toggle.addEventListener('click',()=>{
   const open=menu.classList.toggle('open');
   toggle.setAttribute('aria-expanded',String(open));
 });
 menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.classList.remove('open');toggle.setAttribute('aria-expanded','false');}));
}
})();