'use strict';
(()=>{
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const checks=[
 {key:"address",label:"주소",pattern:/도로명주소|지번주소|주소|찾아오는 길|길찾기/},
 {key:"hours",label:"영업시간·휴무",pattern:/영업시간|영업 중|영업 종료|정기휴무|매일|휴무일|라스트오더|브레이크타임/},
 {key:"parking",label:"주차 안내",pattern:/주차장|주차 가능|주차 불가|주차 안내|주차/},
 {key:"reservation",label:"예약 안내",pattern:/예약하기|네이버 예약|예약 안내|사전예약|예약/},
 {key:"menu",label:"메뉴·가격",pattern:/메뉴판|대표 메뉴|메뉴|가격|₩|[0-9,]{4,}원/},
 {key:"contact",label:"전화·문의",pattern:/전화번호|전화하기|문의전화|문의|(?:0\d{1,2}[- ]?\d{3,4}[- ]?\d{4})/},
 {key:"review",label:"리뷰·후기",pattern:/방문자 리뷰|블로그 리뷰|리뷰|후기/},
 {key:"facility",label:"편의·시설",pattern:/편의시설|유아의자|단체 이용|화장실|반려동물|무선 인터넷/}
];
function inspect(text){
 const clean=text.replace(/[ \t]+/g," ").slice(0,25000);
 const lines=clean.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 return checks.map(ch=>{
  const i=lines.findIndex(line=>ch.pattern.test(line));
  return {key:ch.key,label:ch.label,status:i>=0?"observed":"not_observed",snippet:i>=0?lines[i].slice(0,180):"",note:i<0?"가져온 공개 텍스트에서는 관련 문구가 확인되지 않았습니다. 실제 등록 누락이라는 의미는 아닙니다.":"가져온 공개 텍스트에서 관련 표현이 발견됐습니다. 내용 정확성과 최신 여부는 원문에서 확인해야 합니다."}
 });
}
function init(){
 const p=$("naverPageText"),read=$("readPlaceClipboard"),run=$("analyzePlaceText"),out=$("placeTextAnalysis");
 if(!p||!read||!run||!out)return;
 read.onclick=async()=>{
  try{const t=await navigator.clipboard.readText();if(!t.trim())throw Error("클립보드가 비어 있습니다.");p.value=t.slice(0,25000);out.innerHTML='<div class="verify-note">클립보드의 텍스트를 읽었습니다. 분석을 눌러 공개정보 단서를 확인하세요.</div>'}
  catch(err){out.innerHTML='<div class="verify-note warning">브라우저에서 클립보드 자동 읽기가 제한됐습니다. 직접 Ctrl+V로 붙여넣으세요.</div>'}
 };
 run.onclick=()=>{
  const text=p.value;
  if(text.trim().length<30){out.innerHTML='<div class="verify-note warning">실제 플레이스 페이지에서 복사한 텍스트를 30자 이상 입력하세요.</div>';return}
  const items=inspect(text),seen=items.filter(x=>x.status==="observed"),missing=items.filter(x=>x.status==="not_observed");
  const name=String($("biz")?.value||"").trim();
  out.innerHTML='<div class="verify-results">'+
   '<div class="verify-metric"><small>페이지 내 확인 단서</small><strong>'+seen.length+' / '+items.length+'</strong><span>내용의 사실 여부는 미검증</span></div>'+
   '<div class="verify-metric"><small>추가 확인 항목</small><strong>'+missing.length+'개</strong><span>텍스트에 보이지 않은 항목</span></div>'+
   '<div class="verify-metric"><small>분석 자료</small><strong>사용자 제공</strong><span>자동 API 수집 결과 아님</span></div></div>'+
   '<h4 style="font-size:14px;margin:15px 0">플레이스 공개 문구 확인</h4>'+
   items.map(x=>'<div class="verify-detail"><div><b>'+esc(x.label)+'</b><p>'+esc(x.snippet||x.note)+'</p></div><span class="verify-tag '+(x.status==="observed"?"good":"")+'">'+(x.status==="observed"?"문구 발견":"텍스트 미발견")+'</span></div>').join("")+
   '<div class="verify-note warning">페이지 전체를 복사하지 않았거나 네이버가 화면 일부만 로드한 경우 일부 정보가 보이지 않을 수 있습니다. 이 결과를 네이버 공식 점수·순위·SEO 진단 결과라고 표시하지 않습니다.</div>'+
   '<button class="btn outline" id="copyPlaceAnalysis">검사 기록 복사</button>';
  const summary=["모멘텀 플레이스 공개문구 점검 / 제공자료: 사용자 복사 텍스트","매장명: "+(name||"미입력"),"확인시각: "+new Date().toLocaleString("ko-KR"),...items.map(x=>x.label+": "+(x.status==="observed"?"관련 표현 발견":"가져온 텍스트에 표현 없음")+(x.snippet?" / "+x.snippet:"")),"참고: 문구 유무만 검사하며 실제 사실·공식 네이버 SEO 평가와 무관"].join("\n");
  $("copyPlaceAnalysis").onclick=async()=>{try{await navigator.clipboard.writeText(summary);alert("검사 기록을 복사했습니다.")}catch{alert("브라우저 클립보드 권한을 확인해 주세요.")}};
 };
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
