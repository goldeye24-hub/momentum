'use strict';
/* Momentum Marketing evidence-based add-ons.
   User-provided data is analyzed in browser; it is not uploaded to an external server.
   Technical SEO uses Google Lighthouse/PageSpeed through our serverless proxy.
 */
(()=>{
const $=id=>document.getElementById(id);
const v=id=>String($(id)?.value||"").trim();
const e=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clean=s=>String(s||"").normalize("NFKC").replace(/[^\p{L}\p{N}]/gu,"").toLowerCase();
const stamp=()=>new Date().toLocaleString("ko-KR");
const asNum=s=>{const x=String(s??"").trim().replaceAll(",","").replace(/\s/g,"");if(!x||x==="-"||x==="< 10"||x==="<10"||x.includes("<"))return null;const n=Number(x);return Number.isFinite(n)&&n>=0?n:null};
const num=n=>Number(n||0).toLocaleString("ko-KR");
const box=(k,txt)=>'<div class="verify-detail"><div><b>'+e(k)+'</b><p>'+e(txt)+'</p></div></div>';
const metrics=arr=>'<div class="verify-results">'+arr.map(x=>'<div class="verify-metric"><small>'+e(x.title)+'</small><strong>'+e(x.value)+'</strong><span>'+e(x.sub||"")+'</span></div>').join("")+'</div>';
function save(key,thing){try{localStorage.setItem("momentum-v2-"+key,JSON.stringify(thing))}catch{}}
function load(key,defaultValue){try{return JSON.parse(localStorage.getItem("momentum-v2-"+key))??defaultValue}catch{return defaultValue}}
function download(name,body,type){const blob=new Blob([body],{type:type||"text/plain;charset=utf-8"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
async function copy(s){try{await navigator.clipboard.writeText(s);alert("클립보드에 복사했습니다.")}catch{alert("브라우저에서 클립보드 복사 권한을 확인해 주세요.")}}
function hint(id,message){$(id).innerHTML='<div class="verify-note warning">'+e(message)+'</div>'}
function init(){ 
  // 1. Actual website SEO: only populated from a PageSpeed API response.
  $("techurl").value=load("seo-url","");
  $("techcheck").onclick=async()=>{
    const url=v("techurl");if(!/^https?:\/\/[^ ]+\.[^ ]+/i.test(url)){hint("techresults","공개 홈페이지 URL을 입력해 주세요. 네이버 플레이스 링크는 홈페이지 기술 SEO 검사 대상이 아닙니다.");return}
    const b=$("techcheck");b.disabled=true;b.textContent="구글 Lighthouse 실제 검사 중…";$("techstatus").textContent="Google PageSpeed Insights에 모바일/PC 기술 SEO 검사를 요청하고 있습니다.";save("seo-url",url);$("techresults").innerHTML="";
    try{
      const res=await fetch("/api/website-seo?"+new URLSearchParams({url,strategy:v("techdevice")}),{headers:{Accept:"application/json"}});
      const j=await res.json();
      if(!res.ok)throw Error(j.error||"분석 실패");
      if(!j.score)throw Error("유효한 Lighthouse 점수가 없습니다.");
      $("techstatus").textContent="Google PageSpeed Insights · "+new Date(j.checkedAt).toLocaleString("ko-KR")+" · "+j.strategy+" 실제 검사 결과";
      const checks=(j.checks||[]);
      $("techresults").innerHTML=metrics([{title:"Lighthouse 기술 SEO",value:j.score.seo===null?"미제공":j.score.seo+" / 100",sub:"구글 Lighthouse 측정"},{title:"페이지 성능",value:j.score.performance===null?"미제공":j.score.performance+" / 100",sub:"성능 검사 참고값"},{title:"추가 확인 필요",value:num(checks.filter(x=>x.state==="needs_attention").length)+"개",sub:"측정한 항목 중 문제"}])+
        '<div class="verify-note">검사 페이지: '+e(j.finalUrl||url)+'<br>이 수치는 Lighthouse 기술 항목 기준이며 네이버 플레이스나 AI 추천 순위와 무관합니다.</div>'+
        '<h4 style="margin:14px 0">항목별 실측 결과</h4>'+
        checks.map(x=>'<div class="verify-detail"><div><b>'+e(x.title)+'</b><p>'+e(x.details||"검사 상세정보 없음")+'</p></div><span class="verify-tag '+(x.state==="passed"?"good":x.state==="needs_attention"?"problem":"")+'">'+
        ({passed:"통과",needs_attention:"개선 필요",not_measured:"제공 안 됨",not_applicable:"해당 없음",informational:"참고 정보"}[x.state]||"정보")+'</span></div>').join("")+
        '<div class="actions" style="margin-top:12px"><button class="btn outline" id="copyseo">분석 결과 복사</button></div>';
      $("copyseo").onclick=()=>copy([url,"검사일: "+j.checkedAt,"Lighthouse 기술 SEO: "+j.score.seo,"성능: "+j.score.performance,...checks.map(x=>x.title+": "+x.state+" / "+(x.details||""))].join("\n"));
    }catch(err){$("techstatus").textContent="실제 기술 SEO 검사에 실패했습니다.";hint("techresults",err.message+" · 페이지 공개 상태 또는 Google PageSpeed 서비스 상태를 확인하세요. 허위 측정값은 표시하지 않습니다.")}
    finally{b.disabled=false;b.textContent="실제 SEO 다시 검사 ↗"}
  };
  // 2. GEO observation from actual responses, no fabricated model calls.
  $("georegion").value=load("geo-region","");$("geoservice").value=load("geo-service","");
  const savedBusiness=(()=>{try{return JSON.parse(localStorage.getItem("momentum-lab-business"))?.biz||""}catch{return""}})();
  $("geobrand").value=savedBusiness||"";
  $("geoprompt").onclick=()=>{
    const region=v("georegion")||"우리 지역",service=v("geoservice")||"가족 식사하기 좋은 식당";
    save("geo-region",v("georegion"));save("geo-service",v("geoservice"));
    $("geoprompts").textContent=["1. "+region+"에서 "+service+"을(를) 찾고 있어. 추천할 만한 곳 5곳과 이유를 알려줘.","2. "+region+"에서 가격과 주차, 예약 편의를 고려해 "+service+"에 적합한 곳은 어디야? 확인된 근거를 표시해줘.","3. "+region+"에서 "+service+"의 좋은 점과 주의할 점을 비교해줘. 실제 근거가 있는 장소만 소개해줘."].join("\n\n");
  };
  $("copygeo").onclick=()=>copy($("geoprompts").textContent);
  $("whalehelp").onclick=()=>alert("웨일 브라우저에서 AI Chat을 실행해 같은 질문을 입력하고 실제 답변을 복사해 이 화면에 붙여넣으세요. 특정 업체 상세페이지를 열어둔 상태에서 묻는 경우 자연 추천 테스트가 아닙니다.");
  let log=load("geo-observations",[]);
  function paintLog(){
    const counts={};for(const r of log){counts[r.platform]??={total:0,mentions:0};counts[r.platform].total++;if(r.mentioned)counts[r.platform].mentions++}
    const groups=Object.entries(counts);
    $("geolog").innerHTML=(groups.length?'<div class="verify-results">'+groups.map(([k,x])=>'<div class="verify-metric"><small>'+e(k)+' · 입력된 실제 표본</small><strong>'+x.mentions+" / "+x.total+'</strong><span>매장명 언급 표본 수 (추천률 아님)</span></div>').join("")+'</div>':"")+
      '<h4 style="font-size:13px">최근 직접 확인한 답변 기록</h4>'+
      (log.length?'<div class="verify-log">'+log.slice(0,15).map(r=>'<div class="verify-log-item"><span><b>'+e(r.platform)+'</b> · '+e(r.when)+'<br><small>'+e(r.prompt)+' · 외부 출처 링크 '+num(r.links)+'개</small></span><span class="flag '+(r.mentioned?"seen":"")+'">'+(r.mentioned?"매장명 언급":"매장명 미언급")+'</span></div>').join("")+'</div>':'<p class="help">아직 저장된 관측 기록이 없습니다.</p>');
  }
  $("observegeo").onclick=()=>{
    const txt=v("geoanswer").slice(0,22000),brand=v("geobrand");const platform=document.querySelector('input[name="geoPlatform"]:checked')?.value||"";
    if(brand.length<2||txt.length<15){hint("geoobserve","매장명을 입력하고 AI가 실제로 생성한 답변을 15자 이상 붙여넣으세요.");return}
    const key=clean(brand),inAnswer=clean(txt),mentioned=key.length>=2&&inAnswer.includes(key);
    const urls=[...new Set((txt.match(/https?:\/\/[^\s<>)\]]+/g)||[]).map(s=>s.replace(/[.,;]+$/,"")))].slice(0,20);
    const keywords=["추천","가볼","맛집","방문","좋아요","좋은","괜찮은","추천하지","비추천"];
    const normCtx=txt.slice(Math.max(0,txt.indexOf(brand)-120),txt.indexOf(brand)+220).trim();
    const output=metrics([{title:"업체명 실제 언급",value:mentioned?"있음":"없음",sub:"이 답변 한 건의 문자 포함 여부"},{title:"확인 가능한 URL",value:urls.length+"개",sub:"답변에 포함된 링크만 집계"},{title:"문맥 평가",value:"수동 검토 필요",sub:"언급과 추천은 다름"}])+
       '<div class="verify-note">'+(mentioned?"실제 답변에 업체명이 포함돼 있습니다. 긍정 추천인지, 비교·부정 언급인지 직접 확인해야 합니다.":"답변에서 정확한 매장명 문자열이 발견되지 않았습니다. 별칭이나 축약형은 자동 인식되지 않을 수 있습니다.")+'</div>'+
       (mentioned?box("실제 언급 문맥 일부",normCtx||"문맥을 읽지 못했습니다."):"")+
       (urls.length?box("실제 URL 출처 목록",urls.join(" | ")):'<p class="help">명시적인 원문 링크가 발견되지 않았습니다. AI가 자체 출처 UI로 표시한 인용은 붙여넣기 과정에서 누락될 수 있습니다.</p>');
    $("geoobserve").innerHTML=output;
    log.unshift({platform,when:stamp(),mentioned,links:urls.length,prompt:[v("georegion"),v("geoservice")].filter(Boolean).join(" · ").slice(0,150)});
    log=log.slice(0,90);
    save("geo-observations",log);paintLog();
  };
  $("geoclear").onclick=()=>{if(!confirm("이 브라우저에 저장된 GEO 관측 기록을 삭제할까요?"))return;log=[];save("geo-observations",[]);paintLog();$("geoobserve").textContent="기록을 삭제했습니다."};paintLog();

  // 3. Naver observed rendered place result ordering. Not automated crawling.
  $("rankTarget").value=savedBusiness||"";
  $("inspectRankText").onclick=()=>{
    const raw=v("rankCopied"),target=v("rankTarget"),query=v("rankQueryUser");
    if(!target||!query||!raw){hint("rankTextResult","대상 매장명, 검색어, 직접 확인한 검색 목록을 모두 입력하세요.");return}
    const list=raw.split(/\r?\n/).map(x=>x.replace(/^\s*(?:\d{1,3}[.)\s]+|[•\-]\s+)/,"").trim()).filter(x=>x.length>1).slice(0,150);
    const matches=list.map((x,i)=>({x,i})).filter(x=>clean(x.x)===clean(target)||clean(x.x).includes(clean(target))&&clean(target).length>=3);
    const i=matches.length===1?matches[0].i:-1;
    $("rankTextResult").innerHTML=metrics([{title:"입력된 매장 목록",value:list.length+"개",sub:"실제 지도 전체 결과가 아님"},{title:"매장명 일치",value:matches.length===0?"미확인":matches.length>1?"여러 개":(i+1)+"번째",sub:"사용자가 붙여넣은 목록 내 위치"},{title:"측정 기준",value:"수동 가져오기",sub:stamp()}])+
       '<div class="verify-note">이 결과는 사용자 제공 목록에서만 계산했습니다. 광고, 위치 개인화, 네이버지도 전체 실제 순위는 별도 검증이 필요합니다.</div>'+
       '<div class="verify-list">'+list.slice(0,25).map((name,idx)=>'<div class="verify-detail"><div><b>'+(idx+1)+'. '+e(name)+'</b></div>'+(idx===i?'<span class="verify-tag good">대상 매장</span>':"")+'</div>').join("")+'</div>';
    if(i>=0){const key="momentum-lab-rank-history";let rows=[];try{rows=JSON.parse(localStorage.getItem(key)||"[]")}catch{}rows.unshift({platform:"네이버지도 목록 수동확인",business:target,keyword:query,rank:i+1,when:stamp(),source:"붙여넣은 "+list.length+"개 목록 내 위치 (전체 지도 순위 아님)"});localStorage.setItem(key,JSON.stringify(rows.slice(0,60)));}
  };
  // 4. File parsing for importable keyword data and government trade datasets.
  function parseDelimited(text,limit=30000){
    text=String(text||"").replace(/^\uFEFF/,"");
    const first=text.split(/\r?\n/,1)[0]||"";
    const delimiter=(first.match(/\t/g)||[]).length>(first.match(/,/g)||[]).length?"\t":",";
    const lines=[],maxChars=Math.min(text.length,14e6);let fields=[],field="",quoted=false;
    for(let i=0;i<maxChars;i++){
      let c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}
      else if(c===delimiter&&!quoted){fields.push(field.trim());field=""}
      else if((c==="\n"||c==="\r")&&!quoted){fields.push(field.trim());field="";if(fields.some(s=>s))lines.push(fields);fields=[];if(c==="\r"&&text[i+1]==="\n")i++;if(lines.length>=limit+1)break}
      else field+=c;
    }
    if(lines.length<limit+1&&(field||fields.length)){fields.push(field.trim());lines.push(fields)}
    return {headers:lines.shift()||[],rows:lines,limited:lines.length>=limit,delimiter};
  }
  async function fileData(file,max=10e6){
    if(!file)throw Error("분석할 파일을 선택하세요.");
    if(file.size>max)throw Error("파일이 너무 큽니다. 10MB 이내 또는 지역별 파일을 사용하세요.");
    const buf=await file.arrayBuffer();
    let text=new TextDecoder("utf-8",{fatal:false}).decode(buf);
    if((text.match(/\uFFFD/g)||[]).length>5){try{text=new TextDecoder("euc-kr").decode(buf)}catch{}}
    return parseDelimited(text);
  }
  const findHeader=(h,needles)=>h.findIndex(s=>needles.some(n=>clean(s).includes(clean(n))));
  $("keywordsCSV").onchange=async ev=>{
    const out=$("keywordsCsvResults");
    try{
      const d=await fileData(ev.target.files?.[0]),h=d.headers;
      const ki=findHeader(h,["키워드","검색어","keyword"]);
      const pi=findHeader(h,["월간검색수(PC)","월간PC검색","pc검색","pcmonthly","검색수pc"]);
      const mi=findHeader(h,["월간검색수(모바일)","월간모바일검색","모바일검색","mobilemonthly","검색수mobile"]);
      const ti=findHeader(h,["월간검색수","월검색량","총검색수"]);
      if(ki<0||pi<0&&mi<0&&ti<0)throw Error("키워드·검색량 열을 찾지 못했습니다. 감지한 열: "+h.slice(0,12).join(", "));
      const rows=d.rows.map(x=>{
        const keyword=x[ki]?.trim();if(!keyword)return null;
        const pc=pi>=0?asNum(x[pi]):null,mobile=mi>=0?asNum(x[mi]):null,total=pc!==null||mobile!==null?(pc||0)+(mobile||0):asNum(x[ti]);
        return total===null?null:{keyword,pc,mobile,total}
      }).filter(Boolean);
      rows.sort((a,b)=>b.total-a.total);
      if(!rows.length)throw Error("검색량으로 해석할 수 있는 숫자가 없습니다. 원본 형식을 확인하세요.");
      out.innerHTML=metrics([{title:"분석된 검색어",value:num(rows.length)+"개",sub:d.limited?"최대 30,000줄까지만 분석":"파일 내 유효행"},{title:"가장 검색량 높은 키워드",value:rows[0].keyword,sub:num(rows[0].total)+"회 (제공 파일 기준)"},{title:"월간 총검색량 합계",value:num(rows.reduce((s,x)=>s+x.total,0)),sub:"동일·유사 키워드 중복 가능"}])+
      '<div class="verify-note">출처: 사용자가 선택한 파일 '+e(ev.target.files?.[0]?.name)+' · '+stamp()+'. 네이버 공식 실시간 API 조회가 아닌 사용자 제공 파일 분석입니다.</div>'+
      '<h4 style="font-size:14px">검색량 상위 20개</h4><div class="verify-list">'+rows.slice(0,20).map(x=>'<div class="verify-detail"><b>'+e(x.keyword)+'</b><span>'+num(x.total)+'회</span></div>').join("")+'</div>';
    }catch(err){hint("keywordsCsvResults",err.message)}
  };
  let shops=null;
  $("shopsCsv").onchange=async ev=>{
    try{
      shops=await fileData(ev.target.files?.[0]);
      $("shopsResults").innerHTML='<div class="verify-note">'+e(ev.target.files[0].name)+' 파일 '+num(shops.rows.length)+'개 행을 읽었습니다. 지역·업종을 입력하고 분석을 실행하세요.'+(shops.limited?" 30,000행 이후 데이터는 분석하지 않았습니다.":"")+'</div>';
    }catch(err){shops=null;hint("shopsResults",err.message)}
  };
  $("analyzeShops").onclick=()=>{
    if(!shops){hint("shopsResults","공공 업소 CSV 파일을 먼저 가져오세요.");return}
    const h=shops.headers;
    const nameCol=findHeader(h,["상호명","업소명","사업체명"]);
    const regionCols=["시군구명","행정동명","법정동명","도로명주소","지번주소"].map(x=>findHeader(h,[x])).filter(x=>x>=0);
    const catCols=["상권업종소분류명","업종소분류명","상권업종중분류명","업종중분류명"].map(x=>findHeader(h,[x])).filter(x=>x>=0);
    if(nameCol<0||!regionCols.length||!catCols.length){hint("shopsResults","CSV의 업소명·지역·업종 열을 찾지 못했습니다. 인식한 제목: "+h.slice(0,20).join(", "));return}
    const region=clean(v("shopsRegion")),category=clean(v("shopsCategory"));
    const subset=shops.rows.filter(x=>(!region||regionCols.some(i=>clean(x[i]).includes(region)))&&(!category||catCols.some(i=>clean(x[i]).includes(category))));
    const categories={};subset.forEach(x=>{let k=x[catCols[0]]||"미분류";categories[k]=(categories[k]||0)+1});
    const sorted=Object.entries(categories).sort((a,b)=>b[1]-a[1]);
    $("shopsResults").innerHTML=metrics([{title:"분석 파일 전체",value:num(shops.rows.length)+"행",sub:"공공데이터 원본 일부일 수 있음"},{title:"선택지역·업종 일치",value:num(subset.length)+"개",sub:"파일에 기록된 업체 행 수"},{title:"업종 소분류 수",value:num(sorted.length)+"개",sub:"필터 결과 내 구분"}])+
    '<div class="verify-note warning">이 수치는 업로드한 파일 내 행 수입니다. 현재 영업 중인 실매장 수나 상권 전체 점포 수와 다를 수 있고 중복·폐업 정보는 별도 정리가 필요합니다.</div>'+
    '<h4 style="font-size:14px">주요 업종 (업로드 자료 기준)</h4><div class="verify-list">'+sorted.slice(0,15).map(([k,n])=>'<div class="verify-detail"><b>'+e(k)+'</b><span>'+num(n)+'개</span></div>').join("")+'</div>'+
    '<h4 style="font-size:14px">업체 예시 (최대 20건)</h4><div class="verify-list">'+subset.slice(0,20).map(x=>'<div class="verify-detail"><b>'+e(x[nameCol])+'</b><span>'+e(x[catCols[0]])+'</span></div>').join("")+'</div>';
  };
  // 5. Better no-key review drafts instead of three generic repeats.
  if(typeof basicReply==="function"){
    basicReply=function(review,business){
      const name=(business||"저희 매장").replace(/[<>&"']/g,"").slice(0,70);
      const praise=[],complaints=[];
      const topics=[
        [/맛있|맛이|음식|메뉴|요리|풍미|신선/, "음식과 메뉴"],
        [/친절|직원|응대|서비스/, "직원의 응대"],
        [/양이|푸짐|넉넉|양도/, "양과 구성"],
        [/분위기|인테리어|청결|깔끔/, "매장 분위기"],
        [/가격|비싸|가성비|비용/, "가격"],
        [/주차|주차장/, "주차"],
        [/대기|늦|기다|오래|느리/, "대기 시간"]
      ];
      for(const [regex,topic] of topics)if(regex.test(review))praise.push(topic);
      if(/늦|대기|기다|오래|느리/.test(review))complaints.push("대기와 서비스 속도");
      if(/불친절|응대.*아쉬|직원.*불편/.test(review))complaints.push("응대");
      if(/비싸|가격.*아쉬|가격.*높/.test(review))complaints.push("가격");
      if(/주차.*불편|주차.*힘들/.test(review))complaints.push("주차");
      if(/맛없|맛이.*아쉬|별로/.test(review))complaints.push("음식");
      const good=praise.length?praise.slice(0,2).join("·")+"에 대해 의견을 남겨주셔서 ":"방문 경험을 전해주셔서 ";
      const sorry=complaints.length?"말씀하신 "+complaints.slice(0,2).join("·")+" 부분은 운영 내용을 확인하고 살펴보겠습니다. ":"";
      return [
        "안녕하세요, "+name+"입니다. "+good+"감사합니다. "+sorry+"전해주신 후기를 소중히 참고하겠습니다. 다음 방문에도 좋은 경험을 드릴 수 있도록 노력하겠습니다.",
        name+"에 남겨주신 리뷰 잘 읽었습니다. 바쁘신 중에 구체적인 의견까지 나눠주셔서 감사합니다. "+sorry+"고객님의 이야기를 매장 운영에 반영할 부분이 있는지 검토하겠습니다.",
        "소중한 후기 감사합니다! "+(praise.length?"말씀하신 "+praise[0]+"에 대한 의견을 잘 확인했습니다. ":"")+sorry+"더 나은 서비스로 보답하도록 노력하겠습니다."
      ];
    };
  }
  // 6. Calendar import for recurring visit use.
  $("customCalendarDate").value=new Date().toISOString().slice(0,10);
  $("exportCalendar").onclick=()=>{
    const title=v("customCalendarTitle"),day=v("customCalendarDate");
    if(!title||!/^\d{4}-\d{2}-\d{2}$/.test(day)){alert("일정 제목과 날짜를 입력하세요.");return}
    const dt=day.replaceAll("-","");
    const plus=new Date(day+"T12:00:00Z");plus.setUTCDate(plus.getUTCDate()+1);
    const finish=plus.toISOString().slice(0,10).replaceAll("-","");
    const escapeICS=s=>s.replace(/\\/g,"\\\\").replace(/,/g,"\\,").replace(/;/g,"\\;").replace(/\r?\n/g,"\\n");
    const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//MOMENTUM MARKETING//BUSINESS CALENDAR//KO","BEGIN:VEVENT","UID:momentum-"+Date.now()+"@momentum.local","DTSTAMP:"+new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z"),"DTSTART;VALUE=DATE:"+dt,"DTEND;VALUE=DATE:"+finish,"SUMMARY:"+escapeICS(title),"DESCRIPTION:모멘텀마케팅 홍보 일정","END:VEVENT","END:VCALENDAR"].join("\r\n");
    download("momentum-plan-"+dt+".ics",ics,"text/calendar;charset=utf-8");
  };
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
