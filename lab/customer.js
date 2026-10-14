"use strict";
(()=>{
const $=id=>document.getElementById(id), v=id=>String($(id)?.value||"").trim();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=s=>new Date(s).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"});
const clean=s=>String(s||"").normalize("NFKC").replace(/[^\p{L}\p{N}]/gu,"").toLowerCase();
const url=s=>{try{const x=new URL(s);return x.protocol==="https:"?x.href:""}catch{return""}};
const safeLink=(s,label)=>url(s)?'<a href="'+esc(url(s))+'" target="_blank" rel="noopener noreferrer">'+esc(label||"원문 확인")+" ↗</a>":"";
const empty=(msg)=>'<div class="empty">'+esc(msg)+'</div>';
const detail=(title,body,source)=>'<div class="result"><strong>'+esc(title)+'</strong><p>'+esc(body)+'</p>'+(source?safeLink(source,"원본 출처"):"")+'</div>';
const n=(x)=>Number(x||0).toLocaleString("ko-KR");
const money=(x)=>Math.round(x||0).toLocaleString("ko-KR")+"원";
const store=(key,obj)=>{try{localStorage.setItem("momentum-2026-"+key,JSON.stringify(obj))}catch{}};
const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem("momentum-2026-"+key))||fallback}catch{return fallback}};
const state={company:"",placeUrl:"",audit:null,seo:null,competitors:null,improvements:[],report:"",keywords:[],busy:false};
const platformName={naver:"네이버",google:"구글",kakao:"카카오맵"};
const statusLabel={matched:"상호 일치 후보",name_candidate:"유사 상호 후보",ambiguous:"복수 업체 발견",not_found:"결과 내 미확인",not_configured:"모멘텀 데이터 연동 전",api_error:"데이터 조회 오류",manual_required:"공식 자동조회 제한"};
const categories=[["음식점","맛집","음식점"],["횟집","횟집","대게"],["카페","카페","커피"],["미용실","미용실","헤어"],["숙박","숙박","펜션"],["치과","치과","진료"],["의원","병원","진료"],["자동차","자동차","정비"],["학원","학원","수업"]];
function notify(message,type){$("auditMessage").className="notice "+(type||"");$("auditMessage").textContent=message}
function findStore(){const p=state.audit?.platforms||{};return p.naver?.store||p.google?.store||p.kakao?.store||null}
function inferredCategory(){const x=findStore(),s=[x?.category,x?.name,state.company].filter(Boolean).join(" ");const test=categories.find(row=>s.includes(row[0]));return test?test[1]:(x?.category||"")}
function inferredCity(){const x=findStore(),addr=x?.address||"";const m=addr.match(/(?:서울특별시|부산광역시|대구광역시|인천광역시|대전광역시|울산광역시|광주광역시|세종특별자치시|경상북도|경상남도|전라남도|전북특별자치도|전라북도|충청북도|충청남도|경기도|강원특별자치도|강원도|제주특별자치도|제주도)?\s*([가-힣]+(?:시|군|구))/);return m?.[1]||""}
function drawNaverFocus(){
 const node=$("naverFocus");if(!node)return;
 const a=state.audit?.platforms?.naver||{};
 const placeId=state.audit?.input?.naverPlaceId||"";
 const link=state.audit?.input?.provider==="naver"?state.audit.input.placeUrl:"";
 let status=statusLabel[a.status]||"연결 전";
 let intro='<div class="data"><span><b>네이버 플레이스 링크</b><br><small>사업자가 직접 제공한 주소</small></span><span>'+(link?safeLink(link,"네이버에서 보기"):"미제공")+'</span></div>';
 if(placeId)intro+='<div class="data"><span><b>URL에서 추출한 매장 ID</b><br><small>URL 문자열에서 추출한 값이며 공식 업체 검증은 아님</small></span><span>'+esc(placeId)+'</span></div>';
 let details='<div class="data"><span><b>네이버 공개 지역검색 상태</b><br><small>NAVER API HUB · 검색 결과 최대 5개</small></span><span class="status '+(a.status==="matched"?"ok":"warn")+'">'+esc(status)+'</span></div>';
 if(a.store){
  details+=detail("네이버 지역 검색 업체명 일치 후보",[a.store.name,a.store.category,a.store.address].filter(Boolean).join(" · "),a.store.url);
  details+='<p class="hint">입력한 플레이스 ID와 API 결과가 같은 업체인지는 아직 검증되지 않았습니다.</p>';
 } else details+='<p class="hint">'+esc(a.note||a.message||"모멘텀의 네이버 데이터 연동을 확인 중입니다.")+'</p>';
 node.innerHTML='<h3 style="margin-bottom:4px"><span class="symbol" style="background:#11a953">N</span>네이버 플레이스 집중 진단</h3>'+
 '<p>네이버 공개 검색데이터를 우선하고, 실제 지도 순위와 구분합니다.</p>'+intro+details+
 '<div class="notice warn">매장 조회수·지도 앱의 실제 검색순위·리뷰 상세 통계는 현재 확인된 공식 지역 검색 API에 포함되지 않습니다. 임의 숫자로 채우지 않습니다.</div>';
}
function baseData(){
 if(!state.audit)return false;
 $("stats").innerHTML='<div class="stat"><div class="label">공식 API 상호 일치 후보</div><strong>'+n(state.audit.coverage?.officialApiMatched||0)+' / 3</strong><div class="sub">주소 확인 전 최종 인증 아님</div></div>'+
 '<div class="stat"><div class="label">출처가 있는 관측 항목</div><strong>'+n(state.audit.observations?.length||0)+'개</strong><div class="sub">매장 정보·링크 포함</div></div>'+
 '<div class="stat"><div class="label">마지막 확인 시각</div><strong style="font-size:16px">'+esc(fmt(state.audit.checkedAt))+'</strong><div class="sub">데이터 제공 가능 범위 기준</div></div>';
 $("findings").className="";$("findings").innerHTML=(state.audit.observations||[]).length?state.audit.observations.map(x=>detail(x.label,x.text,x.source)).join(""):empty("공식 API의 업체 일치 결과가 없습니다. 모멘텀 측 데이터 연결 전이며 확인되지 않은 수치는 표시하지 않습니다.");
 $("improvements").className="";$("improvements").innerHTML=(state.audit.improvements||[]).length?state.audit.improvements.map(x=>detail(x.title,x.reason)).join(""):empty("연결된 데이터가 확인되면 실제 개선사항을 추립니다.");
 return true;
}
function drawPlatforms(){
 const p=state.audit?.platforms||{};
 $("platformCards").innerHTML=["naver","google","kakao"].map(id=>{
   const a=p[id]||{},match=a.store;
   const body=match?detail(match.name,[match.address,match.category,match.phone,typeof match.rating==="number"?"구글 평점 "+match.rating+" · 평가 "+match.reviews:""].filter(Boolean).join(" · "),match.url):
     '<div class="notice warn">'+esc(a.message||a.note||"아직 검사하지 않았습니다.")+'</div>';
   const label=statusLabel[a.status]||"검색 전";
   return '<div class="platform"><div class="platformhead"><span><span class="symbol '+esc(id)+'">'+(id==="naver"?"N":id==="google"?"G":"K")+'</span>'+platformName[id]+'</span></div><div style="margin:14px 0"><span class="status '+(a.status==="matched"?"ok":"warn")+'">'+esc(label)+'</span></div>'+body+
    (a.candidates?.length?'<div class="result"><strong>동명·유사 업체 추가 확인 필요</strong>'+a.candidates.map(x=>'<p>'+esc(x.name+" · "+x.address)+'</p>').join("")+'</div>':"")+'</div>'
 }).join("");
 let matches=Object.values(p).filter(x=>x.status==="matched").map(x=>x.store).filter(Boolean);
 $("consistency").className="";
 if(matches.length<2){$("consistency").innerHTML=empty("서로 다른 두 플랫폼에서 동일 업체의 정보가 확인되어야 전화·주소 비교를 진행할 수 있습니다.");return}
 let check=[];if(matches[0].phone&&matches[1].phone){
 const same=matches[0].phone.replace(/\D/g,"").slice(-8)===matches[1].phone.replace(/\D/g,"").slice(-8);
 check.push(detail("공개 전화번호 비교",same?"마지막 8자리 일치":"두 서비스의 전화번호가 다릅니다. 실제 업체 확인이 필요합니다."));
 }
 check.push(detail("주소 비교 필요",matches.map(x=>x.name+" — "+x.address).join(" / "),""));
 $("consistency").innerHTML=check.join("");
}
function suggestions(){
 if(window.MomentumIntel?.renderKeywords?.())return;
 const category=inferredCategory(),city=inferredCity(),s=new Set();
 if(category){s.add(category);if(city)s.add(city+" "+category);s.add(category+" 추천");s.add(category+" 후기");if(city)s.add(city+" "+category+" 예약")}
 if(!s.size){s.add(state.company);s.add(state.company+" 메뉴");s.add(state.company+" 후기");s.add(state.company+" 예약")}
 state.keywords=[...s].slice(0,7);
 $("keywordIdeas").className="";$("keywordIdeas").innerHTML='<div class="qgrid">'+state.keywords.map(x=>'<span>'+esc(x)+'</span>').join("")+'</div><p style="margin-top:12px">검색 수요 수치가 아닌 업체 이름 또는 공개 업종에서 생성한 후보야. 검색량은 별도 인증 데이터가 연결된 경우만 제공할 수 있어.</p>';
 $("keywordVolumes").className="";$("keywordVolumes").innerHTML=empty("모멘텀 서버의 네이버 검색광고 데이터 연동 전입니다. 실제 월간 검색량은 아직 측정되지 않았습니다.");
}
function renderRanking(){
 const c=state.competitors;
 let message="<strong>네이버 지도 실제 순위</strong><p>승인된 자동 순위 데이터가 연결되지 않았습니다. 업체명 검색 결과의 위치를 지역 일반 검색어 순위로 바꾸어 표시하지 않습니다.</p>";
 if(c&&c.places?.length){
 const idx=c.places.findIndex(x=>clean(x.name)===clean(state.company));
 message+='<div class="result"><strong>카카오 공식 API 검색결과</strong><p>자동 조회 검색어: '+esc(c.keyword||"")+' · 결과 '+c.places.length+'개 중 '+(idx>=0?"상호 일치 후보 "+(idx+1)+"번째":"입력한 상호 미발견")+'</p><p>이 순서는 카카오맵 사용자 앱 검색순위와 동일하다는 보장이 없으며, 검색 위치에 따라 달라질 수 있습니다.</p></div>';
 }
 $("rankingOutput").className="";$("rankingOutput").innerHTML='<div class="result">'+message+'</div>';
}
function renderCompetitors(){
 const data=state.competitors;
 $("competitors").className="";
 if(!data||!Array.isArray(data.places)){ $("competitors").innerHTML=empty("정확한 지역·업종을 확인할 수 없거나 공식 경쟁매장 API가 연결되지 않았습니다.");return }
 const list=data.places.filter(x=>clean(x.name)!==clean(state.company));
 $("competitors").innerHTML='<div class="notice">카카오 장소검색 API 조회 결과 '+n(list.length)+'개 업체 후보. 전체 업소 수나 현재 영업 중 점포 수는 아닙니다.</div>'+list.slice(0,12).map(x=>detail(x.name,x.address,x.url)).join("");
}
function renderSEO(){
 const audit=state.audit;
 const p=audit?.platforms||{},verified=Object.values(p).filter(x=>x.status==="matched").map(x=>x.store);
 const o=audit?.observations||[];
 $("seoSummary").className="";
 const output=o.filter(x=>/업체|전화|링크|일치|주소/.test(x.label)).map(x=>detail(x.label,x.text,x.source));
 if(state.seo?.score){
 const s=state.seo;
 output.push(detail("홈페이지 기술 SEO (Google Lighthouse)",s.score.seo===null?"점수 미제공":"실측 "+s.score.seo+"/100점 · 모바일 기준 · 이 점수는 플레이스 순위와 무관합니다.",s.sourceUrl));
 for(const check of (s.checks||[]).filter(x=>x.state==="needs_attention").slice(0,6))output.push(detail("홈페이지 개선: "+check.title,check.details||"Lighthouse 개선 검토 권장"));
 }
 if(!output.length)output.push(empty("플레이스 등록·공개 업체정보가 확인되기 전입니다. 상호명과 링크만으로 네이버 공식 SEO 점수를 추정하지 않습니다."));
 $("seoSummary").innerHTML=output.join("");
 $("geoSummary").className="";$("geoSummary").innerHTML=empty("현재 ChatGPT·웨일 AI Chat·네이버 AI·Google AI의 실제 답변을 자동 수집하는 공식 통합 연동이 없습니다. 확인되지 않은 추천 여부는 추측하지 않습니다.");
}
function calendar(){
 const month=new Date().getMonth()+1,category=inferredCategory()||"매장";
 const basic={1:["새해 영업시간·예약 안내 정비","신년 고객 감사 콘텐츠"],2:["졸업·입학 시즌 예약 일정","봄 시즌 사진 촬영"],3:["봄맞이 정보 업데이트","고객이 자주 찾는 서비스 소개"],4:["지역 봄 행사 일정 확인","주말 방문 안내 콘텐츠"],5:["가정의 달 행사·모임 안내","가족 단위 고객 후기 검토"],6:["여름 상품·운영시간 점검","장마철 고객 안내 준비"],7:["여름 휴가철 예약·재고 안내","여름 인기 메뉴 사진 업데이트"],8:["여름 성수기 문의 대응","휴가철 후기·만족도 분석"],9:["가을 신상품·메뉴 소개","명절 공지와 일정 준비"],10:["가을 지역 행사 확인","연말 예약 안내 준비"],11:["연말 모임·선물 홍보","겨울 고객 편의정보 점검"],12:["연말 휴무·예약 일정 공지","신년 재방문 이벤트 기획"]};
 $("calendarTitle").textContent=month+"월 "+category+" 홍보 아이디어";
 $("calendarIdeas").className="";
 $("calendarIdeas").innerHTML=(basic[month]||[]).map(x=>detail(x,"업종별 적용 여부와 실제 행사 일정은 확인이 필요합니다.")).join("");
}
function generateReport(){
 const d=state.audit,own=window.MomentumIntel?.getResult?.();
 if(!d&&!own){$("reportText").textContent="진단을 먼저 시작하세요.";return}
 const t=["모멘텀마케팅 매장 통합진단","작성 시각: "+fmt(d?.checkedAt||own?.createdAt||new Date().toISOString()),"매장명: "+(state.company||own?.merchant?.name||v("storeName")),"입력 플레이스: "+(state.placeUrl||v("placeUrl"))];
 if(own){
  const m=own.merchant;
  t.push("","[모멘텀 독립 진단 · 이용자 입력값만 활용]",
    "분석근거: "+own.method,
    "링크 서비스: "+(m.identity.provider||"미확인"),
    "숫자형 플레이스 ID: "+(m.identity.placeId||"URL에서 확인 불가"),
    "지역 추정: "+(m.region.value||"미확인")+" (상호명 추정)",
    "업종 추정: "+(m.industry.label||"미확인")+" (입력 텍스트 기반)",
    "검색량/순위: 실제 측정하지 않음","",
    "[자체 생성 키워드 후보]");
  for(const x of own.keywords||[])t.push("• "+x.keyword+" ["+x.group+"] / 생성 후보, 실제 검색량 미측정");
  t.push("","[자체 실행 계획]");
  for(const x of own.actions||[])t.push("• "+x.headline+": "+x.detail);
  t.push("","[자체 홍보 콘텐츠 기획]");
  for(const x of own.campaigns||[])t.push("• "+x.channel+" — "+x.headline+" / "+x.body);
 }
 if(d){
  t.push("","[연동된 공개 정보 출처]");
  for(const [id,p] of Object.entries(d.platforms||{})){
   t.push(platformName[id]+": "+(statusLabel[p.status]||p.status||"미확인"));
   if(p.store)t.push("  상호 후보: "+p.store.name+" / 주소: "+p.store.address+" / "+(p.store.url||""));
   if(p.note||p.message)t.push("  "+(p.note||p.message));
  }
  t.push("","[연동 API에서 확인된 관측 정보]");
  for(const x of d.observations||[])t.push("• "+x.label+" — "+x.text+(x.source?" | 출처: "+x.source:""));
  t.push("","[추가 검토 과제]");
  for(const x of d.improvements||[])t.push("• "+x.title+" — "+x.reason);
 }
 if(state.seo?.score)t.push("","[홈페이지 기술 SEO]","Google Lighthouse: "+state.seo.score.seo+"/100");
 if(state.competitors?.places?.length)t.push("","[카카오 장소 API 검색]","검색어: "+state.competitors.keyword+" / API 결과 수: "+state.competitors.places.length);
 t.push("","[한계]","입력정보 기반의 자체 생성 키워드와 실제 네이버 검색량은 별개입니다.","플레이스 URL만으로 점주 비공개 조회수나 실제 순위를 측정하지 않습니다.","네이버 지도 실제 순위·AI 추천률·실시간 매장 방문객 수는 측정되지 않았습니다.");
 state.report=t.join("\n");$("reportText").textContent=state.report;
}
window.MomentumCustomerReport=generateReport;
async function sourceFetch(){
 const data=state.audit,p=data?.platforms||{},store=p.kakao?.store||p.google?.store;
 const cat=inferredCategory(),city=inferredCity();
 const eligible=city&&cat&&(p.naver?.status==="matched"||p.kakao?.status==="matched"||p.google?.status==="matched");
 if(eligible){
  try{
   const term=[city,cat].join(" ");
   const resp=await fetch("/api/place-search?"+new URLSearchParams({provider:"kakao",keyword:term,business:state.company}),{headers:{Accept:"application/json"}});
   if(resp.ok){state.competitors=await resp.json();state.competitors.keyword=term}
  }catch{}
 }
 renderCompetitors();renderRanking();
 const site=p.google?.store?.website;
 let websiteHost="";try{websiteHost=new URL(site||"").hostname}catch{}
 if(site&&/^https:\/\//i.test(site)&&websiteHost&&!/(naver\.com|google\.com|kakao\.com)/.test(websiteHost)){
  try{
    const r=await fetch("/api/website-seo?"+new URLSearchParams({url:site,strategy:"mobile"}),{headers:{Accept:"application/json"}});
    if(r.ok)state.seo=await r.json();
  }catch{}
 }
 renderSEO();generateReport();
}
async function runAudit(){
 if(state.busy)return;
 state.company=v("storeName");state.placeUrl=v("placeUrl");
 if(state.company.length<2){notify("상호명은 두 글자 이상 입력해 주세요.","warn");return}
 const allowed=/^(?:https:\/\/)?(?:[^/]+\.)?(?:naver\.com|naver\.me|kakao\.com|google\.com|google\.co\.kr|goo\.gl|maps\.app\.goo\.gl)(?:\/|$)/i;
 if(!url(state.placeUrl)||!allowed.test(state.placeUrl)){notify("네이버·구글·카카오의 HTTPS 플레이스 링크를 입력해 주세요.","warn");return}
 const button=$("start");state.busy=true;button.disabled=true;button.textContent="매장 정보 조사 중…";
 notify("모멘텀 서버에서 포털 연동 상태와 공개 업체정보를 확인 중입니다.");
 state.audit=null;state.competitors=null;state.seo=null;
 try{
 const resp=await fetch("/api/business-audit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:state.company,placeUrl:state.placeUrl})});
 const data=await resp.json();
 if(!resp.ok)throw Error(data.error||"서버 조회에 실패했습니다.");
 state.audit=data;store("lastProfile",{company:state.company,placeUrl:state.placeUrl});
 baseData();drawNaverFocus();drawPlatforms();suggestions();renderSEO();renderRanking();renderCompetitors();calendar();generateReport();
 const count=Number(data.coverage?.officialApiMatched||0);
 notify(count>0?"공식 검색 API에서 "+count+"개 플랫폼의 상호 일치 후보를 찾았습니다. 주소를 확인한 뒤 결과를 참고하세요.":"매장 링크의 형식을 확인했습니다. 실제 네이버·구글·카카오 공개정보 조회는 내부 API와 활용 권한 설정 후 가능합니다.",count>0?"ok":"warn");
 await sourceFetch();
 }catch(err){notify("진단을 완료할 수 없습니다. "+err.message,"warn");}
 finally{state.busy=false;button.disabled=false;button.textContent="무료 진단 시작 →";}
}
function bindTabs(){
 document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{
 const target=b.dataset.view;
 document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x===b));
 document.querySelectorAll(".section").forEach(x=>x.classList.toggle("active",x.id===target));
 history.replaceState(null,"","#"+target);
 }));
 if(location.hash){const target=location.hash.slice(1);document.querySelector('[data-view="'+target+'"]')?.click()}
}
async function copy(value){if(!value)return alert("복사할 내용이 없습니다.");try{await navigator.clipboard.writeText(value);alert("복사했습니다.")}catch{alert("클립보드 권한을 확인해 주세요.")}}
function reviewFallback(review,name){
 const problem=/늦|불친절|대기|실망|불편|별로|아쉬|비싸/.test(review);
 const topic=/음식|맛있|메뉴|신선/.test(review)?"음식과 메뉴":/친절|직원|응대/.test(review)?"응대":/주차/.test(review)?"주차":"방문 경험";
 const x=problem?"불편하거나 아쉬우셨던 부분은 내부적으로 확인하고 살펴보겠습니다. ":"";
 return ["안녕하세요, "+name+"입니다. "+topic+"에 관해 후기를 남겨주셔서 감사합니다. "+x+"보내주신 말씀을 소중히 참고하겠습니다.",
  name+"을 찾아주셔서 감사합니다. "+x+"고객님의 의견을 바탕으로 더 나은 경험을 제공할 수 있도록 노력하겠습니다.",
  "소중한 후기 감사합니다. "+topic+"에 관한 말씀을 잘 읽었습니다. "+x+"다음에도 편안한 방문이 될 수 있도록 노력하겠습니다."];
}
function showReplies(list,label){
 const host=$("reviewReplies");host.innerHTML='<p class="hint">'+esc(label)+'</p>'+list.slice(0,3).map((x,i)=>'<div class="record"><div class="title">답글 '+(i+1)+'</div><textarea aria-label="답글 '+(i+1)+' 수정" id="reply'+i+'">'+esc(x)+'</textarea><div class="tools"><button class="btn sml alt" data-reply="'+i+'">수정한 답글 복사</button></div></div>').join("");
 host.querySelectorAll("[data-reply]").forEach(b=>b.onclick=()=>copy($("reply"+b.dataset.reply).value))
}
async function reply(){
 let review=v("reviewText"),name=state.company;
 if(review.length<3)return alert("고객 리뷰 내용을 입력하세요.");
 if(!name)return alert("상단에서 매장을 먼저 지정하세요.");
 $("reviewRun").disabled=true;$("reviewState").textContent="답글 초안 생성 중…";
 try{
 const r=await fetch("/api/review-replies",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({review,business:name,tone:"warm",platform:"네이버"})});
 const d=await r.json();if(!r.ok)throw Error(d.error||"AI 서버 미설정");
 if(!Array.isArray(d.replies)||!d.replies.length)throw Error("AI 응답 오류");
 showReplies(d.replies,"모멘텀 AI 서버가 작성한 초안입니다. 게시 전에 사실관계를 확인하세요.");
 $("reviewState").textContent="AI 답글 3개 생성 완료";
 }catch(err){showReplies(reviewFallback(review,name),"AI 서버 연결 전: 리뷰 핵심 표현을 반영한 기본 문안 (AI 생성 아님)");$("reviewState").textContent="기본 문안으로 제공 중 · AI 연결은 모멘텀 내부 설정에서 처리";}
 finally{$("reviewRun").disabled=false}
}
function calc(){
 const t=Number(v("ticket")),m=Number(v("margin")),c=Number(v("conversion"));
 if(![t,m,c].every(Number.isFinite)||t<=0||m<=0||m>100||c<=0||c>100){$("calculatorResult").textContent="객단가와 0~100% 이내 비율을 입력하세요.";return}
 const profit=t*m/100,perInquiry=profit*c/100;
 $("calculatorResult").textContent="1회 구매당 공헌이익: "+money(profit)+"\n문의 1건당 손익분기 최대 광고비: "+money(perInquiry)+"\n\n※ 광고의 모든 전환·매출을 정확히 예측하지 않습니다. 고정비, 재구매, 부가세 등은 제외한 단순 계산입니다.";
}
function main(){
 bindTabs();const saved=load("lastProfile",{});if(saved.company)$("storeName").value=saved.company;if(saved.placeUrl)$("placeUrl").value=saved.placeUrl;
 $("auditForm").onsubmit=ev=>{ev.preventDefault();runAudit()};
 $("makeReport").onclick=generateReport;$("copyReport").onclick=()=>copy(state.report);$("printReport").onclick=()=>window.print();
 $("reviewRun").onclick=reply;
 $("calculate").onclick=calc;calc();calendar();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",main,{once:true});else main();
})();