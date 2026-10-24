(function(){'use strict';
/* Source: publicly visible Kmong seller profiles, reviewed 2026-10-23.
   Prospects only: NO contractual or pricing claims. */
const candidates=[
 {id:'kom',name:'꼼디자인',category:'촬영 · 상세페이지',details:'제품 촬영, 상세페이지 디자인, 브랜드 비주얼 작업 분야',url:'https://kmong.com/@꼼디자인'},
 {id:'pixel',name:'픽셀원',category:'상세페이지 · 홈페이지',details:'F&B·뷰티·리빙 관련 상세페이지, 웹 제작, 블로그 콘텐츠 분야',url:'https://kmong.com/@픽셀원'},
 {id:'oneweek',name:'원윅디자인',category:'브랜드블로그 · 웹 제작',details:'반응형 홈페이지, 상세페이지, 브랜드 블로그 디자인 분야',url:'https://kmong.com/@원윅디자인'},
 {id:'gaga',name:'가가몰',category:'홈페이지 · 쇼핑몰',details:'홈페이지 및 카페24 제작, 수정, 웹개발 분야',url:'https://kmong.com/@가가몰'},
 {id:'last',name:'라스트마케팅',category:'체험단 · 홈페이지',details:'블로그 체험단, 반응형 기업 웹사이트 분야',url:'https://kmong.com/@라스트마케팅'},
 {id:'practical',name:'실전디자인',category:'콘텐츠 · 숏폼',details:'상세페이지, 영상 기획·제작, SNS 콘텐츠 분야',url:'https://kmong.com/@실전디자인'}
];
const root=document.getElementById('vendorCandidatesList'),form=document.getElementById('supplierForm');
if(!root||!form)return;
for(const item of candidates){
 const card=document.createElement('article');card.className='vendor-candidate';
 const type=document.createElement('span');type.className='category';type.textContent=item.category;
 const title=document.createElement('h3');title.textContent=item.name;
 const desc=document.createElement('p');desc.textContent=item.details;
 const tag=document.createElement('span');tag.className='tag';tag.textContent='검토 후보 · 단가 미확정';
 const actions=document.createElement('div');actions.className='buttons';
 const link=document.createElement('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='크몽 프로필 보기 ↗';
 const add=document.createElement('button');add.type='button';add.className='outline';add.textContent='등록 폼에 불러오기';
 add.addEventListener('click',()=>{
  const name=form.elements.namedItem('name'),url=form.elements.namedItem('orderUrl'),method=form.elements.namedItem('orderMethod'),notes=form.elements.namedItem('notes'),id=form.elements.namedItem('id');
  if(id)id.value='';
  if(name)name.value=item.name;
  if(url)url.value=item.url;
  if(method)method.value='웹사이트 접수';
  if(notes)notes.value='[크몽 협력 검토 후보 · 2026-10-23] '+item.details+' / 단가·작업 조건·납기·재하도급 가능 여부·계산서 발행 여부 미확인. 상담 전 계약 파트너로 표시하지 마세요.';
  form.scrollIntoView({behavior:'smooth',block:'start'});
  name?.focus({preventScroll:true});
 });
 actions.append(link,add);card.append(type,title,desc,tag,actions);root.append(card);
}
})();