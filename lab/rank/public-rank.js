(()=>{
'use strict';
const $=id=>document.getElementById(id);
const state={busy:false};
const measure=$('measure'),form=$('rankForm'),notice=$('message'),result=$('result');
function msg(s){notice.textContent=s}
function input(){return {keyword:$('keyword').value.normalize('NFKC').trim(),placeUrl:$('target').value.trim(),scope:'mobile'}}
function updateLink(){const q=$('keyword').value.trim();$('openNaver').href=q?'https://m.place.naver.com/restaurant/list?'+new URLSearchParams({where:'m',query:q,entry:'pll'}):'https://m.place.naver.com/'}
$('keyword').addEventListener('input',updateLink);
const when=t=>t?new Date(t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'미확인';
form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(state.busy)return;
 const payload=input();
 if(payload.keyword.length<2||!payload.placeUrl){msg('검색어와 매장 플레이스 정보를 입력해 주세요.');return}
 state.busy=true;measure.disabled=true;result.hidden=true;msg('네이버 모바일 플레이스의 실제 목록을 확인 중입니다. 최대 수십 초가 소요될 수 있습니다.');
 try{
  const resp=await fetch('/api/place-rank-live',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify(payload)});
  const data=await resp.json();
  if(!resp.ok){
   if(data.status==='daily_limit_reached'){
    const reset=data.resetAt?new Date(data.resetAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'내일 0시';
    msg('비회원은 하루 1회만 조회할 수 있습니다. 다음 조회 가능: '+reset+' (한국시간).');
   }else msg(data.message||'조회에 실패했습니다. 네이버 서비스 상태를 확인해 주세요.');
   return;
  }
  if(!['ranked','not_in_block'].includes(data.status)){
   msg(data.message||'실제 모바일 플레이스 목록의 위치를 확인하지 못했습니다. 조회 횟수는 차감되지 않았습니다.');return;
  }
  $('resultHeading').textContent=data.status==='ranked'?'대상 업체 확인':'조회한 목록에서 대상 미발견';
  $('resultRank').textContent=data.status==='ranked'?(data.rankApproximate?'약 ':'')+(data.rank??'확인 불가')+'번째':'확인 불가';
  $('resultKeyword').textContent=payload.keyword;
  $('resultName').textContent=data.matchedName||payload.placeUrl;
  $('resultCount').textContent=Number.isInteger(data.observedCount)?data.observedCount.toLocaleString('ko-KR')+'개':'미확인';
  $('resultAt').textContent=when(data.observedAt);
  $('resultNote').textContent=data.message||'수집 목록의 표시 순서입니다. 네이버 공식 순위가 아닙니다.';
  result.hidden=false;
  if(data.anonymousDailyLimit===1)msg('오늘의 비회원 무료 조회 1회를 사용했습니다. 내일 0시(한국시간)에 다시 조회할 수 있습니다. 결과는 저장되지 않습니다.');
  else msg('측정을 완료했습니다. 본 페이지는 결과를 저장·누적하지 않습니다.');
 }catch(e){msg('네트워크 또는 서버 응답 오류로 조회에 실패했습니다. 완료되지 않은 측정은 사용 횟수에 포함하지 않습니다.')}
 finally{state.busy=false;measure.disabled=false}
});
updateLink();
})();