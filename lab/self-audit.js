"use strict";
(()=>{
  // All conclusions below come from answers confirmed by the person checking the store.
  // No ranking, volume, AI citation, or owner-only analytics are fabricated.
  const CHECKS=[
    {id:'identity',group:'Local SEO',title:'업체명·업종 정보가 실제 영업 형태와 일치하나요?',guide:'업체명, 등록 업종과 기본 업체 소개를 실제 사업자 정보에 맞춰 검토하세요.',level:'높음'},
    {id:'contacts',group:'Local SEO',title:'주소·전화번호·영업시간·휴무 정보가 최신인가요?',guide:'실제 출입구, 연락처, 정기·임시휴무와 운영시간을 스마트플레이스에서 바로 수정하세요.',level:'높음'},
    {id:'specialty',group:'Local SEO',title:'대표키워드가 실제 메뉴·상품·제공서비스를 설명하나요?',guide:'검색량만 높은 지역 홍보문구가 아니라 실제 판매 메뉴와 제공 서비스를 중심으로 설정하세요.',level:'높음'},
    {id:'menu',group:'Local SEO',title:'메뉴·서비스명·가격표가 최신 상태인가요?',guide:'실제 메뉴/서비스 구성과 가격을 반영하고 중단한 상품 정보를 정리하세요.',level:'높음'},
    {id:'photos',group:'Local SEO',title:'대표사진·메뉴·외관·시설 사진이 충분하고 정확한가요?',guide:'허위 연출 없이 실제 메뉴, 출입구, 좌석 및 편의시설을 확인할 수 있는 사진으로 보완하세요.',level:'보통'},
    {id:'directions',group:'Local SEO',title:'주차·대중교통·찾아오는 길이 명확한가요?',guide:'현재 이용 가능한 주차장과 정확한 위치, 대중교통 접근법을 구체적으로 안내하세요.',level:'보통'},
    {id:'conversion',group:'Local SEO',title:'예약·전화·문의 방식과 이용 조건을 확인할 수 있나요?',guide:'해당 업종에서 예약 기능이 지원되는지 확인한 뒤 예약 시간, 이용 조건, 연락 경로를 정비하세요.',level:'높음'},
    {id:'review',group:'Local SEO',title:'최근 리뷰 질문·불만에 사실에 기반한 답변을 제공하나요?',guide:'실제 고객 의견에 성실하게 답변하고 반복 불편사항은 운영정보와 현장 서비스에 반영하세요.',level:'보통'},
    {id:'updates',group:'Local SEO',title:'소식·이벤트·혜택 안내가 만료되지 않았나요?',guide:'종료된 이벤트·구형 메뉴·임시 휴무 안내를 정리하고 현재 운영 소식만 제공하세요.',level:'보통'},
    {id:'consistency',group:'GEO',title:'홈페이지·SNS·플레이스의 상호·주소·연락처가 일치하나요?',guide:'공식 정보 원본을 하나로 정리하고 홈페이지·SNS·플레이스 간 불일치를 수정하세요.',level:'높음'},
    {id:'qa',group:'GEO',title:'주요 고객 질문에 대한 구체적·검증 가능한 답변이 있나요?',guide:'메뉴·가격·주차·예약·이용대상 등 고객 질문에 정확한 사실로 답하는 내용을 작성하세요.',level:'보통'},
    {id:'ai',group:'GEO',title:'표시된 AI 요약·브리핑 내용에 사실과 다른 정보가 없나요?',guide:'실제로 노출되는 경우에만 내용·날짜·출처를 기록하고, 오류가 있다면 원본 정보와 공식 절차를 확인하세요.',level:'보통'}
  ];
  let key='',name='',answers={};
  const el=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const storageKey=k=>'momentum-self-check-v1:'+k.slice(0,260);
  function persist(){try{localStorage.setItem(storageKey(key),JSON.stringify(answers))}catch{}}
  function load(){try{const x=JSON.parse(localStorage.getItem(storageKey(key))||'{}');return x&&typeof x==='object'?x:{}}catch{return {}}}
  function lines(){
    if(!key)return [];
    const completed=CHECKS.filter(x=>['ok','problem'].includes(answers[x.id]));
    const issues=CHECKS.filter(x=>answers[x.id]==='problem');
    return ['','[스마트플레이스 SEO+GEO 직접 확인 점검 · 실측 데이터 아님]',
      '확인자: 사업주 또는 담당자 직접 선택 · 검사대상: '+name,
      '확인한 항목: '+completed.length+'/'+CHECKS.length+' · 개선 필요 표시: '+issues.length+'개',
      ...CHECKS.filter(x=>answers[x.id]==='ok').map(x=>'[확인자 응답: 양호] '+x.title),
      ...issues.map(x=>'[확인자 응답: 개선 필요 / '+x.level+'] '+x.title+' → '+x.guide),
      ...CHECKS.filter(x=>!['ok','problem'].includes(answers[x.id])).map(x=>'[미확인] '+x.title),
      '※ 응답은 운영자가 사실 확인해야 하며 네이버 순위·검색량·AI 노출을 측정한 결과가 아닙니다.'];
  }
  function paint(){
    const root=el('selfAudit');if(!root||!key)return;
    root.hidden=false;
    const complete=CHECKS.filter(x=>['ok','problem'].includes(answers[x.id])).length;
    const bad=CHECKS.filter(x=>answers[x.id]==='problem');
    el('selfAuditStatus').textContent='확인 '+complete+'/'+CHECKS.length+'개 · 개선 필요 '+bad.length+'개 · 미확인 '+(CHECKS.length-complete)+'개';
    el('selfAuditList').innerHTML=CHECKS.map((x,i)=>{
      const a=answers[x.id]||'unknown';
      return '<article class="self-check-row" data-check="'+esc(x.id)+'"><div class="self-check-title"><span class="self-check-count">'+(i+1)+'</span><div><span class="self-check-group">'+esc(x.group)+'</span><strong>'+esc(x.title)+'</strong></div></div>'+
       '<div class="self-check-options" role="group" aria-label="'+esc(x.title)+'">'+
       [['ok','양호'],['problem','개선 필요'],['unknown','미확인']].map(([val,label])=>
         '<button type="button" class="self-check-option '+(a===val?'active '+val:'')+'" data-choice="'+val+'" aria-pressed="'+(a===val)+'">'+label+'</button>').join('')+
       '</div>'+(a==='problem'?'<p class="self-check-guide"><b>개선 제안 · '+esc(x.level)+'</b> '+esc(x.guide)+'</p>':'')+'</article>';
    }).join('');
    el('selfAuditFindings').innerHTML=bad.length?
      '<h4>확인자가 개선 필요로 표시한 항목</h4>'+bad.map((x,i)=>'<div class="self-check-finding"><b>'+(i+1)+'. '+esc(x.title)+'</b><p>'+esc(x.guide)+'</p></div>').join(''):
      '<p class="self-check-neutral">'+(complete?'현재 확인한 항목 중 개선 필요로 표시한 항목이 없습니다. 미확인 항목은 계속 점검하세요.':'항목을 확인하고 선택하면 근거를 적을 수 있는 개선안이 나타납니다.')+'</p>';
    if(typeof window.MomentumCustomerReport==='function')window.MomentumCustomerReport();
  }
  function activate(info){
    name=String(info?.name||'').trim();
    const url=String(info?.placeUrl||'').trim();
    if(name.length<2||!/^https:\/\//i.test(url))return;
    key=name.toLowerCase()+'|'+url;answers=load();paint();
  }
  function init(){
    const root=el('selfAudit');if(!root)return;
    el('selfAuditList').addEventListener('click',e=>{
      const button=e.target.closest('button[data-choice]'),row=button?.closest('[data-check]');if(!button||!row)return;
      answers[row.dataset.check]=button.dataset.choice;
      persist();paint();
    });
    document.addEventListener('momentum:intel-ready',e=>activate(e.detail));
    // Independent fallback: owner-confirmed check remains usable even if all
    // serverless endpoints are offline, blocked or not configured.
    el('auditForm')?.addEventListener('submit',()=>{
      const enteredName=String(el('storeName')?.value||'').trim();
      const enteredUrl=String(el('placeUrl')?.value||'').trim();
      try{
        const u=new URL(enteredUrl);
        const host=u.hostname.toLowerCase();
        const supported=/(^|\\.)(naver\\.com|naver\\.me|kakao\\.com|google\\.com|google\\.co\\.kr|goo\\.gl|maps\\.app\\.goo\\.gl)$/.test(host);
        if(u.protocol==='https:'&&supported&&enteredName.length>=2)activate({name:enteredName,placeUrl:enteredUrl});
      }catch{}
    });

    // Allow visitors to clear browser-only answers for this store.
    el('selfAuditReset')?.addEventListener('click',()=>{answers={};persist();paint()});
  }
  window.MomentumSelfAudit={reportLines:lines};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
