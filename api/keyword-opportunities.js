'use strict';
/**
 * Keyword Explorer: deterministic first-party candidate generation,
 * with OPTIONAL opt-in NAVER Search Ads keywordstool integration.
 * Never equate heuristic opportunity with real demand/rank.
 */
const crypto=require('node:crypto');
const cut=(v,n=80)=>String(v??'').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' ').slice(0,n);
const regions=['서울','강남','서초','송파','홍대','마포','성수','종로','부산','해운대','광안리','수영','서면','사상','동래','연산동','기장','김해','양산','창원','마산','울산','대구','경주','포항','경산','구미','대전','청주','천안','세종','광주','여수','순천','전주','익산','제주','서귀포','수원','성남','분당','판교','동탄','용인','화성','안양','광명','부천','일산','파주','고양','김포','인천','부평','의정부','남양주','평택','안성','원주','강릉','속초','춘천','삼척','진주','거제','통영','목포','군산'];
const kinds=[
 {id:'food',match:/맛집|식당|국밥|한우|고기|삼겹살|갈비|횟집|회센터|대게|해산물|물회|카페|브런치|레스토랑|치킨|피자|돈가스|회식|뷔페/,label:'맛집·외식업',suffix:['메뉴','가격','주차','예약','후기','가족모임','점심','데이트']},
 {id:'stay',match:/풀빌라|펜션|글램핑|호텔|리조트|숙소|모텔|캠핑|숙박|게스트하우스/,label:'숙박·여행',suffix:['예약','가격','수영장','오션뷰','가족','독채','후기','주차']},
 {id:'service',match:/사다리차|스카이차|이사|용달|입주청소|청소|에어컨|보일러|설치|철거|누수|집수리|인테리어|포장이사|폐기물/,label:'출장·생활서비스',suffix:['비용','견적','가격','업체','당일','출장','후기','추천']},
 {id:'beauty',match:/미용실|헤어|애견미용|속눈썹|네일|피부관리|왁싱|메이크업/,label:'뷰티·반려동물',suffix:['예약','가격','잘하는곳','후기','추천','주차','당일','스타일']},
 {id:'business',match:/프랜차이즈|창업|가맹|컨설팅|기업교육|강사|마케팅|홈페이지|법무사|세무사|학원|병원|치과|의원/,label:'전문·기업 서비스',suffix:['비용','상담','전문','추천','후기','업체','견적','사례']}
];
function parse(raw,region){
 const seed=cut(raw,90),r=cut(region,40);
 if(!seed||seed.length<2||seed.length>65||/[<>]/.test(seed))throw Error('키워드를 2~65자로 입력해 주세요.');
 if(r.length>35||/[<>]/.test(r))throw Error('지역 입력을 확인해 주세요.');
 const ws=seed.split(' ');
 const start=ws.find(w=>regions.some(z=>w===z||w.startsWith(z)))||'';
 const extracted=r||start;
 const core=extracted?cut(ws.filter((x,i)=>i!==ws.indexOf(start||r)).join(' '),75)||seed:seed;
 const kind=kinds.find(x=>x.match.test(core))||{id:'general',label:'일반',suffix:['가격','추천','후기','비교','방법','예약','상담','업체']};
 return {seed,region:extracted,core,kind};
}
function generate(seed,region){
 const d=parse(seed,region),out=[],seen=new Set();
 function add(term,group){
  term=cut(term,90);const key=term.replace(/\s/g,'').toLowerCase();
  if(!term||seen.has(key))return;seen.add(key);
  const w=term.split(' ').filter(Boolean);
  const regional=!!d.region && term.includes(d.region);
  const buying=/비용|가격|견적|예약|당일|업체|상담|가맹|신청|설치|메뉴/.test(term);
  const proof=/후기|잘하는곳|추천|비교|사례/.test(term);
  const detail=w.length>=3||term.length>=11;
  const generic=w.length<2&&!regional;
  const priority=Math.max(25,Math.min(94,48+(regional?13:0)+(buying?17:0)+(proof?11:0)+(detail?10:0)-(generic?15:0)));
  const classType=buying?'행동·구매 의도':proof?'비교·검토 의도':regional?'지역 탐색':'정보 탐색';
  out.push({keyword:term,group,priority,priorityLabel:priority>=76?'우선 검토':priority>=60?'검토 후보':'보조 후보',basis:[regional?'지역 포함':null,buying?'예약·비용·견적 의도':null,proof?'후기·비교 의도':null,detail?'구체적인 검색어':null].filter(Boolean),intent:classType,monthlyPc:null,monthlyMobile:null,monthlyTotal:null,adCompetition:null,source:'heuristic',note:'월간 수요·검색 순위는 측정하지 않은 기획 우선순위입니다.'});
 }
 add(d.seed,'입력 키워드');
 if(d.region&&d.core!==d.seed)add(d.core,'업종 키워드');
 if(d.region&&!d.seed.includes(d.region))add(d.region+' '+d.core,'지역·업종');
 if(d.region){for(const s of d.kind.suffix)add(d.region+' '+d.core+' '+s,'지역 롱테일')}
 for(const s of d.kind.suffix.slice(0,5))add(d.core+' '+s,'의도별 확장');
 if(d.region)add(d.region+' '+d.core+' 잘하는곳','지역 롱테일');
 const candidates=out.slice(0,22);
 candidates.sort((a,b)=>b.priority-a.priority||a.keyword.localeCompare(b.keyword,'ko'));
 return {input:d.seed,region:d.region||null,industry:d.kind.label,candidates,heuristic:'의도·지역·구체성 기반 콘텐츠 기획 우선순위. 검색량·경쟁도·노출순위의 실측값이 아닙니다.'};
}
function parseCount(value){
 if(typeof value==='number'&&Number.isFinite(value)&&value>=0)return Math.round(value);
 if(typeof value==='string'&&/^\d+$/.test(value))return Number(value);
 if(typeof value==='string'&&/^<\s*10$/.test(value))return {lessThan:10};
 return null;
}
const eligible=()=>process.env.MOMENTUM_SEARCHADS_ENABLED==='true'&&process.env.MOMENTUM_SEARCHADS_PUBLIC_DISPLAY_APPROVED==='true'&&!!process.env.NAVER_SEARCHADS_API_KEY&&!!process.env.NAVER_SEARCHADS_SECRET_KEY&&!!process.env.NAVER_SEARCHADS_CUSTOMER_ID;
async function adsLookup(input,region){
 if(!eligible())return {status:'not_connected',note:'네이버 검색광고 API 연결 또는 공개 표시 권한이 아직 준비되지 않았습니다.'};
 const {seed,core}=parse(input,region);
 const hints=[...new Set([seed,core].filter(Boolean))].slice(0,2).map(x=>x.replace(/\s+/g,'').slice(0,30));
 const path='/keywordstool';
 const time=String(Date.now());
 const signature=crypto.createHmac('sha256',process.env.NAVER_SEARCHADS_SECRET_KEY).update(time+'.GET.'+path).digest('base64');
 const u=new URL('https://api.searchad.naver.com'+path);
 u.searchParams.set('hintKeywords',hints.join(','));
 u.searchParams.set('showDetail','1');
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),6000);
 try{
  const response=await fetch(u,{method:'GET',signal:ctl.signal,headers:{'X-Timestamp':time,'X-API-KEY':process.env.NAVER_SEARCHADS_API_KEY,'X-Customer':process.env.NAVER_SEARCHADS_CUSTOMER_ID,'X-Signature':signature,'Accept':'application/json'}});
  if(!response.ok)return {status:'unavailable',note:'검색광고 API 호출 오류('+response.status+'). 인증 또는 할당량을 확인하세요.'};
  const json=await response.json();
  const rows=Array.isArray(json.keywordList)?json.keywordList:[];
  return {status:'connected',rows:rows.slice(0,300).map(x=>({keyword:cut(x.relKeyword,70),pc:parseCount(x.monthlyPcQcCnt),mobile:parseCount(x.monthlyMobileQcCnt),adCompetition:cut(x.compIdx,30)})),note:'네이버 검색광고 키워드 도구 제공 검색량 · 광고 경쟁지수 (검색결과 SEO 경쟁도와 다름)'};
 }catch(e){return {status:'unavailable',note:e.name==='AbortError'?'검색광고 API 응답 시간 초과':'검색광고 API 네트워크 연결 실패'};}
 finally{clearTimeout(timer);}
}
function joinAds(data,ads){
 if(ads.status!=='connected')return data;
 const known=new Map(ads.rows.map(row=>[row.keyword.replace(/\s/g,'').toLowerCase(),row]));
 for(const item of data.candidates){
  const m=known.get(item.keyword.replace(/\s/g,'').toLowerCase());if(!m)continue;
  item.monthlyPc=m.pc;item.monthlyMobile=m.mobile;
  if(typeof m.pc==='number'&&typeof m.mobile==='number')item.monthlyTotal=m.pc+m.mobile;
  item.adCompetition=m.adCompetition||null;item.source='naver_searchads';item.note='검색량: 네이버 검색광고 API 제공. 우선순위: 모멘텀 자체 휴리스틱.';
 }
 return data;
}
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'POST 요청만 가능합니다.'})}
 const origin=req.headers?.origin;const host=req.headers?.host||'';
 if(origin){try{if(new URL(origin).host!==host)return res.status(403).json({error:'허용되지 않은 출처입니다.'})}catch{return res.status(403).json({error:'요청 출처 오류'})}}
 // Public first-party keyword planning is not gated by login or a per-user usage quota.
 let body=req.body;if(typeof body==='string'){if(body.length>3500)return res.status(413).json({error:'입력이 너무 깁니다.'});try{body=JSON.parse(body)}catch{return res.status(400).json({error:'JSON 오류'})}}
 if(!body||Array.isArray(body)||typeof body!=='object')return res.status(400).json({error:'키워드 입력이 필요합니다.'});
 try{
  const result=generate(body.keyword,body.region);
  const ads=await adsLookup(body.keyword,body.region);
  joinAds(result,ads);
  return res.status(200).json({...result,measurement:{searchAdsStatus:ads.status,note:ads.note,measuredCount:result.candidates.filter(x=>x.source==='naver_searchads').length,checkedAt:ads.status==='connected'?new Date().toISOString():null},disclaimer:'추정치가 아닌 콘텐츠 기획 점수입니다. 월간 검색량·경쟁도가 미측정이면 추정 건수를 만들지 않습니다.'});
 }catch(e){return res.status(400).json({error:e.message||'입력값을 확인해 주세요.'})}
};
module.exports.generate=generate;
module.exports.parseCount=parseCount;
module.exports.joinAds=joinAds;
