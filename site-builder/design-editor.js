(function(){
'use strict';
const designs=[['restaurant','음식점 · 다이닝 매거진','전체 사진·메뉴북'],['beauty','미용실 · 스타일 저널','비대칭 패션 매거진'],['enterprise','중견기업형 · NEXCORE','산업영역·기술·ESG'],['b2b','B2B 기업 · 솔루션 플랫폼','좌측 메뉴·기술·견적'],['shop','쇼핑몰 · 브랜드 커머스','옵션·장바구니 체험'],['stay','풀빌라 · 숙박','객실·날짜 선택'],['interior','인테리어 · 시공','프로젝트·견적 준비'],['academy','학원 · 교육','과정 탐색·학습로드맵'],['pet','반려견 미용','케어·상담 준비'],['legal','법률사무소','업무 분야별 상담 안내'],['clinic','의원','방문정보·체크리스트'],['auto','자동차 정비','정비항목·방문 준비'],['fitness','피트니스','요일별 클래스 탐색'],['estate','부동산','가상 매물 조건 필터'],['hrd','기업교육·HRD','프로그램 맞춤 구성'],['tax','세무회계','개인·법인 유형별 서비스'],['moving','이사업체','이사 조건·짐 규모'],['cleaning','입주청소','작업 범위·시연 비교'],['pilates','필라테스 스튜디오','요일별 수업 시간표']];
const selectors={
restaurant:{brand:'.restaurant-brand',headline:'.hero-caption h1',intro:'.hero-caption p',heroUrl:'.editorial-hero > img',ctaText:'.hero-caption .gallery-link',ctaLink:'.hero-caption .gallery-link',sectionTitle:'.letter h2',sectionText:'.letter p',detailUrl:'.menu-photo img'},
beauty:{brand:'.head .name',headline:'.cover-copy h1',intro:'.cover-copy .intro',heroUrl:'.cover .look img',ctaText:'.cover-copy .linkline',ctaLink:'.cover-copy .linkline',sectionTitle:'.lookbook-head h2',sectionText:'.lookbook-head p',detailUrl:'.look-strip img'},
b2b:{brand:'.rail .brand',headline:'.intro h1',intro:'.intro .lead',ctaText:'.intro .actions a',ctaLink:'.intro .actions a',sectionTitle:'.problem h2',sectionText:'.problem-head p'},
shop:{brand:'.shop-header .logo',headline:'.product-details h1',intro:'.product-details .sub',heroUrl:'.gallery figure img',ctaText:'.product-actions a',ctaLink:'.product-actions a',sectionTitle:'.full-story h2',sectionText:'.full-story p',detailUrl:'.full-story img'},
stay:{brand:'.top .logo',headline:'.view h1',intro:'.view p',heroUrl:'.view > img',ctaText:'.end a',ctaLink:'.end a',sectionTitle:'.story h2',sectionText:'.story p',detailUrl:'.story img'},
interior:{brand:'.top .logo',headline:'.hero h1',intro:'.hero p',heroUrl:'.hero-image img',ctaText:'.hero .action',ctaLink:'.hero .action',sectionTitle:'.projects h2',sectionText:'.projects .head p',detailUrl:'.proj-grid figure img'},
academy:{brand:'.header .brand',headline:'.hero h1',intro:'.hero p',heroUrl:'.lesson-art img',ctaText:'.hero a',ctaLink:'.hero a',sectionTitle:'.track h2',sectionText:'.track-head p',detailUrl:'.journal img'},
pet:{brand:'.head .logo',headline:'.hero h1',intro:'.hero p',heroUrl:'.portrait img',ctaText:'.hero a',ctaLink:'.hero a',sectionTitle:'.services h2',sectionText:'.section-head p',detailUrl:'.groom img'},
legal:{brand:'.mast .brand',headline:'.lead h1',intro:'.lead p',ctaText:'.lead a',ctaLink:'.lead a',sectionTitle:'.practice h2',sectionText:'.lead-aside p'},
clinic:{brand:'.head .name',headline:'.hero h1',intro:'.hero p',ctaText:'.hero a',ctaLink:'.hero a',sectionTitle:'.index h2',sectionText:'.index .small'},
auto:{brand:'.nav .logo',headline:'.hero h1',intro:'.hero p',ctaText:'.hero a',ctaLink:'.hero a',sectionTitle:'.index h2',sectionText:'.services article p'},
fitness:{brand:'.top .brand',headline:'.hero h1',intro:'.hero p',ctaText:'.hero a',ctaLink:'.hero a',sectionTitle:'.classes h2',sectionText:'.class-list article p'},
estate:{brand:'.top .logo',headline:'.splash h1',intro:'.splash p',ctaText:'.splash a',ctaLink:'.splash a',sectionTitle:'.results h2',sectionText:'.results-top p'},
hrd:{brand:'.head .brand',headline:'.hero h1',intro:'.hero p',ctaText:'.hero a',ctaLink:'.hero a',sectionTitle:'.program h2',sectionText:'.program-grid article p'},
tax:{brand:'.tax-header .tax-brand',headline:'.tax-hero h1',intro:'.tax-hero p',ctaText:'.tax-hero a',ctaLink:'.tax-hero a',sectionTitle:'.tax-switch h2',sectionText:'.tax-board p'},
moving:{brand:'.move-top .logo',headline:'.move-hero h1',intro:'.move-hero .content p',ctaText:'.move-hero a',ctaLink:'.move-hero a',sectionTitle:'.step-builder h2',sectionText:'.step-builder .title p'},
cleaning:{brand:'.clean-nav .logo',headline:'.diff-copy h1',intro:'.diff-copy p',ctaText:'.diff-copy a',ctaLink:'.diff-copy a',sectionTitle:'.scope h2',sectionText:'.scope-header p'},
pilates:{brand:'.pil-nav .brand',headline:'.pil-hero h1',intro:'.pil-hero p',ctaText:'.pil-hero a',ctaLink:'.pil-hero a',sectionTitle:'.classes h2',sectionText:'.classes-top p'}
};
const $=id=>document.getElementById(id), ids=['brand','headline','intro','heroUrl','ctaText','ctaLink','sectionTitle','sectionText','detailUrl'];

const fields={brand:'brandInput',headline:'headlineInput',intro:'introInput',heroUrl:'heroUrlInput',ctaText:'ctaTextInput',ctaLink:'ctaLinkInput',sectionTitle:'sectionTitleInput',sectionText:'sectionTextInput',detailUrl:'detailUrlInput'};
const frame=$('livePreview');let selected='stay',base={},draft={},loading=false;
function status(s){$('saveStatus').textContent=s}
function key(id){return 'momentum-independent-design-draft-v2:'+id}
function safeImage(v){if(typeof v!=='string'||v.length>2800000)return false;if(/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(v))return true;try{const u=new URL(v,location.origin);return u.protocol==='https:'&&(!u.username&&!u.password)}catch{return false}}
function safeLink(v){if(typeof v!=='string'||v.length>500)return false;if(v.startsWith('#'))return /^#[a-z0-9_-]+$/i.test(v);try{const u=new URL(v,location.origin);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
const modernSelectors={
 brand:'header .logo strong,header .brand,header .name,header .wordmark,header .logo',
 headline:'main h1',
 intro:'.hero .copy p,.hero-copy p,main section p',
 heroUrl:'.hero-picture img,.hero img,.hero-image img,.view > img',
 ctaText:'main a.cta,main a.line-button,main a.action,main a',
 ctaLink:'main a.cta,main a.line-button,main a.action,main a',
 sectionTitle:'main section:nth-of-type(2) h2,main h2',
 sectionText:'main section:nth-of-type(2) p,main section p',
 detailUrl:'main section:nth-of-type(2) img,main img'
};
function targets(){
 const d=frame.contentDocument;if(!d||!d.querySelector('main'))return {};
 const out={};
 for(const id of ids){
   const selector=(selectors[selected]||{})[id];
   out[id]=(selector&&d.querySelector(selector))||d.querySelector(modernSelectors[id])||null;
 }
 return out;
}
function textWithBreak(el){return el?el.innerText.replace(/\r/g,'').trim().replace(/\n{3,}/g,'\n\n'):''}
function values(){const t=targets(),o={};for(const id of ids){const el=t[id];o[id]=!el?'':id==='heroUrl'||id==='detailUrl'?(el.getAttribute('src')||''):id==='ctaLink'?(el.getAttribute('href')||''):textWithBreak(el)}return o}
function applyOne(id,val){const el=targets()[id];if(!el||typeof val!=='string')return false;if(id==='heroUrl'||id==='detailUrl'){if(!safeImage(val))return false;el.src=val;return true}
 if(id==='ctaLink'){if(!safeLink(val))return false;el.setAttribute('href',val);return true}
 if(id==='headline'||id==='sectionTitle'){el.replaceChildren();val.split('\n').forEach((line,i)=>{if(i)el.appendChild(frame.contentDocument.createElement('br'));el.appendChild(frame.contentDocument.createTextNode(line))});return true}
 el.textContent=val;return true;
}
function paint(){if(!frame.contentDocument?.querySelector('main'))return;for(const [id,v] of Object.entries(draft))if(ids.includes(id))applyOne(id,v)}
function sync(){const t=targets();for(const id of ids){const input=$(fields[id]);const element=t[id];input.disabled=!element;input.closest('label')?.classList.toggle('isDisabled',!element);input.value=element?(draft[id]??base[id]??''):'';input.placeholder=element?'': '이 디자인에는 해당 영역이 없습니다.'}}
function readStored(id){try{const s=JSON.parse(localStorage.getItem(key(id))||'null');return s&&s.version===1&&s.id===id&&s.fields&&typeof s.fields==='object'?s.fields:{}}catch{return{}}}
function display(id){selected=id;loading=true;draft={};base={};$('previewTitle').textContent=designs.find(x=>x[0]===id)?.[1]||id;$('designInfo').textContent=(designs.find(x=>x[0]===id)?.[2]||'')+' · 별도의 홈페이지 HTML·레이아웃';frame.src='/portfolio/conversion/'+encodeURIComponent(id)+'/';status('디자인 불러오는 중…')}
frame.addEventListener('load',()=>{if(!frame.contentDocument?.querySelector('main'))return;loading=false;base=values();draft=readStored(selected);paint();sync();status(Object.keys(draft).length?'임시 저장된 수정 내용을 불러왔습니다.':'원본 디자인을 불러왔습니다. 변경 시 임시 저장됩니다.')});
function syncSave(){try{localStorage.setItem(key(selected),JSON.stringify({version:1,id:selected,fields:draft,savedAt:new Date().toISOString()}));status('이 브라우저에 임시 저장했습니다. 공개 사이트에는 반영되지 않습니다.')}catch(e){status('브라우저 저장 공간이 부족합니다. JSON/HTML 파일로 백업하세요.')}}
for(const id of ids){const input=$(fields[id]);input.addEventListener('input',()=>{if(loading)return;const v=input.value;if(id==='heroUrl'||id==='detailUrl'){if(v&&!safeImage(v)){status('이미지는 안전한 HTTPS URL 또는 업로드된 사진만 사용할 수 있습니다.');return}}
 if(id==='ctaLink'&&!safeLink(v)){status('버튼 링크는 HTTPS 주소 또는 #contact 같은 페이지 내부 링크만 허용합니다.');return}
 if(!applyOne(id,v))return;draft[id]=v;syncSave()})}
$('designSelect').addEventListener('change',e=>display(e.target.value));
$('saveDraft').addEventListener('click',()=>{for(const id of ids){const inp=$(fields[id]);if(!inp.disabled){const v=inp.value;if((id==='heroUrl'||id==='detailUrl')&&!safeImage(v))continue;if(id==='ctaLink'&&!safeLink(v))continue;draft[id]=v}}syncSave()});
$('resetDraft').addEventListener('click',()=>{if(!confirm('현재 디자인의 브라우저 임시 수정 내용을 삭제하고 원본으로 돌아갈까요?'))return;localStorage.removeItem(key(selected));display(selected)});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('selected',x===b));$('previewOuter').classList.toggle('isMobile',b.dataset.view==='mobile')}));
document.querySelectorAll('[data-pane]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-pane]').forEach(x=>x.classList.toggle('selected',x===b));for(const [v,id] of [['main','editMain'],['detail','editDetail'],['guide','editGuide']])$(id).hidden=v!==b.dataset.pane}));
function download(name,content,type){const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),20000)}
$('saveJson').addEventListener('click',()=>download('momentum-'+selected+'-backup.json',JSON.stringify({version:1,id:selected,fields:{...base,...draft},savedAt:new Date().toISOString()},null,2),'application/json'));
$('loadJson').addEventListener('click',()=>$('jsonFile').click());
$('jsonFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>2000000){status('JSON 파일은 2MB 이하만 불러올 수 있습니다.');return}try{const v=JSON.parse(await f.text());if(v.version!==1||v.id!==selected||!v.fields||typeof v.fields!=='object')throw Error('선택 디자인과 백업 파일이 일치하지 않습니다.');const o={};for(const id of ids)if(typeof v.fields[id]==='string'&&v.fields[id].length<(id==='headline'||id==='intro'?2000:2900000)&&((id!=='heroUrl'&&id!=='detailUrl')||safeImage(v.fields[id]))&&(id!=='ctaLink'||safeLink(v.fields[id])))o[id]=v.fields[id];draft=o;paint();sync();syncSave()}catch(err){status('가져오기 실패: '+err.message)}e.target.value=''});
$('heroFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>5*1024*1024){status('JPG·PNG·WEBP 사진 5MB 이하만 가능합니다.');return}const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>{const scale=Math.min(1,1800/Math.max(image.width,image.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));c.getContext('2d').drawImage(image,0,0,c.width,c.height);const result=c.toDataURL('image/jpeg',.77);if(result.length>2800000){status('사진이 너무 큽니다. 더 작은 사진을 사용하세요.');return}$('heroUrlInput').value=result;draft.heroUrl=result;applyOne('heroUrl',result);syncSave()};image.onerror=()=>status('사진을 읽을 수 없습니다.');image.src=String(reader.result)};reader.readAsDataURL(f)});
$('exportHtml').addEventListener('click',()=>{const doc=frame.contentDocument;if(!doc?.documentElement){status('미리보기를 불러온 뒤 내보내세요.');return}const copy=doc.documentElement.cloneNode(true);for(const el of copy.querySelectorAll('[href^="/"],[src^="/"]')){for(const a of ['href','src']){const v=el.getAttribute(a);if(v?.startsWith('/'))el.setAttribute(a,new URL(v,location.origin).href)}}for(const script of copy.querySelectorAll('script'))script.remove();for(const el of copy.querySelectorAll('input,textarea,select'))if(el.closest('.quote-section')){if(el.matches('input'))el.value='';else if(el.matches('textarea'))el.textContent='';else if(el.matches('select'))el.selectedIndex=0}download(selected+'-edited-demo.html','<!doctype html>\n'+copy.outerHTML,'text/html;charset=utf-8');status('HTML 파일을 내보냈습니다. 공개 서버에 자동 배포되지는 않습니다.')});
const dropdown=$('designSelect');for(const [id,label,kind] of designs){const o=document.createElement('option');o.value=id;o.textContent=label+' — '+kind;dropdown.appendChild(o)}dropdown.value=selected;display(selected);
})();