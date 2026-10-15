(function(){
'use strict';
const form=document.getElementById('serviceQuoteForm');
if(!form)return;
const result=document.getElementById('quoteDemoResult');
const quotes={ladder:'사다리차',movers:'이사',cleaning:'청소',aircon:'에어컨'};
const type=document.querySelector('[data-quote-kind]')?.dataset.quoteKind||'서비스';
const name=quotes[type]||'서비스';
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
for(const inp of form.querySelectorAll('[data-future-date]'))inp.min=today();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
form.addEventListener('submit',event=>{
 event.preventDefault();
 // Deliberate product demo: do not send, persist or URL-encode personal data.
 if(!form.reportValidity())return;
 const date=form.querySelector('[data-future-date]');
 if(date && date.value<today()){date.setCustomValidity('오늘 또는 이후 날짜를 선택하세요.');date.reportValidity();return}
 const labels=[...form.querySelectorAll('.quote-field')];
 const detail=labels.map(label=>{
  const input=label.querySelector('input,select,textarea');
  return {label:label.querySelector('span')?.textContent.trim()||'',value:input?.value.trim()||''};
 }).filter(({value})=>value);
 result.hidden=false;
 result.innerHTML='<span class="quote-result-kicker">FORM PREVIEW · NO SUBMISSION</span>'+
  '<h4>'+esc(name)+' 견적 양식 입력 확인</h4><p>아래 내용은 <strong>현재 화면에서만 확인</strong>할 수 있습니다. 실제 업체에 전달되지 않으며, 서버·로컬 저장소에도 저장되지 않습니다.</p>'+
  '<dl>'+detail.map(x=>'<div><dt>'+esc(x.label.replace('필수','').trim())+'</dt><dd>'+esc(x.value)+'</dd></div>').join('')+'</dl>'+
  '<p class="quote-result-next">실제 고객용 사이트를 제작할 때 관리자 이메일, 고객정보 동의, 문의 접수 알림과 함께 연결할 수 있습니다.</p>';
 result.scrollIntoView({behavior:'smooth',block:'nearest'});
});
for(const inp of form.querySelectorAll('[data-future-date]'))inp.addEventListener('input',()=>inp.setCustomValidity(''));
})();