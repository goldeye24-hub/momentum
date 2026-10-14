'use strict';
// Safe public-data business audit. No scraping of Naver/Google/Kakao web pages.
// Real observations are only returned from explicitly enabled official APIs.
const rate = new Map();
const same = v=>String(v||"").normalize("NFKC").replace(/[^\p{L}\p{N}]/gu,"").toLowerCase();
const clean = (v,n=120)=>String(v||"").trim().slice(0,n);
const fail = (status,message)=>({status,message});
const acceptedHosts = host=>/(^|\.)(naver\.com|naver\.me|kakao\.com|google\.com|google\.co\.kr|goo\.gl|maps\.app\.goo\.gl)$/.test(host);
const safePlaceLink = s=>{
  if(!s)return null;
  try{
    const u=new URL(s);
    if(u.protocol!=="https:"||!acceptedHosts(u.hostname.toLowerCase()))return null;
    if(u.username||u.password)return null;
    return {url:u.href,provider:u.hostname.includes("naver")?"naver":u.hostname.includes("kakao")?"kakao":"google",host:u.hostname};
  }catch{return null}
};
const resultsAs = (items,name)=>{
  const target=same(name);
  const exact=items.filter(x=>same(x.name)===target);
  const choices=exact.length?exact:items.filter(x=>target.length>=3&&(same(x.name).includes(target)||target.includes(same(x.name))&&same(x.name).length>2));
  if(choices.length>1)return {status:"ambiguous",candidates:choices.slice(0,5),note:"동일하거나 유사한 업체가 여럿입니다. 링크와 주소가 맞는지 대조하기 전에는 특정 업체로 확정할 수 없습니다."};
  if(choices.length===1 && exact.length===1)return {status:"matched",store:choices[0],matchType:"exactName",note:"공식 API에서 상호명이 일치하는 업체 후보를 확인했습니다. 동일한 상호의 다른 매장일 수 있으므로 입력된 플레이스 링크와 주소를 비교하세요."};
  if(choices.length===1)return {status:"name_candidate",candidates:choices,note:"유사한 업체명만 확인했습니다. 동일 업체 여부를 확정하지 않습니다."};
  return {status:"not_found",note:"검색 API 결과 범위에서 일치 업체를 확인하지 못했습니다. 실제 미노출을 뜻하지 않습니다."};
};
async function kakaoLookup(name,region){
 const key=process.env.KAKAO_REST_API_KEY;
 if(!key)return fail("not_configured","카카오 장소 검색 API 키가 설정되지 않았습니다.");
 const u=new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
 u.searchParams.set("query",clean([region,name].filter(Boolean).join(" "),95));
 u.searchParams.set("size","15");
 u.searchParams.set("sort","accuracy");
 const c=new AbortController(), t=setTimeout(()=>c.abort(),8500);
 try{
  const r=await fetch(u,{signal:c.signal,headers:{Authorization:"KakaoAK "+key,Accept:"application/json"}});
  if(!r.ok)return fail("api_error","카카오 장소 API가 응답하지 않았습니다 ("+r.status+").");
  const d=await r.json();
  const places=(d.documents||[]).map(x=>({
   providerId:clean(x.id,100),name:clean(x.place_name,120),address:clean(x.road_address_name||x.address_name,170),
   phone:clean(x.phone,40),category:clean(x.category_name,140),url:clean(x.place_url,300)
  }));
  return {...resultsAs(places,name),observedCount:places.length,source:"Kakao Local Keyword API",scope:"상위 최대 15개 API 검색결과"};
 }catch{return fail("api_error","카카오 API 연결이 실패했습니다.");}finally{clearTimeout(t)}
}
async function googleLookup(name,region){
 const key=process.env.GOOGLE_PLACES_API_KEY;
 if(!key)return fail("not_configured","Google Places API 키가 설정되지 않았습니다.");
 const c=new AbortController(),t=setTimeout(()=>c.abort(),8500);
 try{
  const r=await fetch("https://places.googleapis.com/v1/places:searchText",{
   method:"POST",signal:c.signal,
   headers:{"X-Goog-Api-Key":key,"X-Goog-FieldMask":"places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.primaryTypeDisplayName,places.rating,places.userRatingCount,places.internationalPhoneNumber,places.websiteUri", "Content-Type":"application/json"},
   body:JSON.stringify({textQuery:clean([region,name].filter(Boolean).join(" "),140),languageCode:"ko",regionCode:"KR",pageSize:10})
  });
  if(!r.ok)return fail("api_error","구글 장소 API가 응답하지 않았습니다 ("+r.status+").");
  const d=await r.json();
  const places=(d.places||[]).map(x=>({
   providerId:clean(x.id,100),name:clean(x.displayName?.text,120),address:clean(x.formattedAddress,170),
   phone:clean(x.internationalPhoneNumber,40),category:clean(x.primaryTypeDisplayName?.text,140),
   url:clean(x.googleMapsUri,350),website:clean(x.websiteUri,350),
   rating:typeof x.rating==="number"?x.rating:null,reviews:typeof x.userRatingCount==="number"?x.userRatingCount:null
  }));
  return {...resultsAs(places,name),observedCount:places.length,source:"Google Places Text Search (New)",scope:"상위 최대 10개 API 검색결과"};
 }catch{return fail("api_error","구글 API 연결이 실패했습니다.");}finally{clearTimeout(t)}
}
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(req.method!=="POST")return res.status(405).json({error:"POST 요청만 가능합니다."});
  const origin=clean(req.headers?.origin||"",300),host=clean(req.headers?.host||"",200);
  if(origin){try{if(new URL(origin).host!==host)return res.status(403).json({error:"요청 출처가 다릅니다."})}catch{return res.status(403).json({error:"요청 출처 확인 실패."})}}
  let b={};
  try{b=typeof req.body==="string"?JSON.parse(req.body):req.body||{}}catch{return res.status(400).json({error:"입력 데이터 형식을 확인하세요."})}
  const name=clean(b.name,80),region=clean(b.region,80),raw=clean(b.placeUrl,600);
  if(name.length<2)return res.status(400).json({error:"매장명을 두 글자 이상 입력하세요."});
  if(raw&&(!safePlaceLink(raw)))return res.status(400).json({error:"네이버·구글·카카오 공식 지도 링크만 입력할 수 있습니다."});
  const link=safePlaceLink(raw);
  const ip=clean(req.headers?.["x-forwarded-for"]||req.socket?.remoteAddress||"unknown",90).split(",")[0];
  const now=Date.now(),last=rate.get(ip)||0;
  if(now-last<5000)return res.status(429).json({error:"5초 후 다시 조회하세요."});
  rate.set(ip,now);if(rate.size>1500)rate.clear();
  const enabled=process.env.MOMENTUM_PLACE_API_ENABLED==="true";
  const [kakao,google]=enabled?await Promise.all([kakaoLookup(name,region),googleLookup(name,region)]):[
   fail("not_configured","관리자가 카카오 장소 API를 연결하기 전입니다."),
   fail("not_configured","관리자가 구글 장소 API를 연결하기 전입니다.")
  ];
  const platform={
   naver:{status:"manual_required",note:"네이버 스마트플레이스의 실시간 내부 통계·지도 순위를 자동으로 조회하는 공식 범용 API를 확보하지 못했습니다. 사용자 링크를 기록했으며 자동 점검 결과로 표시하지 않습니다."},
   kakao,google
  };
  const matches=Object.entries(platform).filter(([_,p])=>p.status==="matched"&&p.matchType==="exactName");
  const observations=[],improvements=[];
  if(link)observations.push({kind:"confirmed",label:"제공된 플레이스 링크",text:link.provider+" 지도 URL 확인",source:link.url});
  for(const [p,d] of matches){
   const n=p==="google"?"구글":"카카오";
   observations.push({kind:"confirmed",label:n+" API 상호명 일치 후보",text:[d.store.name,d.store.address,d.store.category].filter(Boolean).join(" · "),source:d.store.url||""});
   if(d.store.phone)observations.push({kind:"confirmed",label:n+" 공개 전화번호",text:d.store.phone,source:d.store.url||""});
   if(typeof d.store.rating==="number")observations.push({kind:"confirmed",label:"구글 공개 평점",text:d.store.rating+"점 · 평가 수 "+(d.store.reviews??"미제공"),source:d.store.url||""});
  }
  if(matches.length===2){
   let a=matches[0][1].store,b=matches[1][1].store;
   if(a.phone&&b.phone&&a.phone.replace(/\D/g,"").slice(-8)!==b.phone.replace(/\D/g,"").slice(-8)){
    improvements.push({priority:"check",title:"전화번호가 서로 다르게 표시됩니다.",reason:"공식 API의 공개 전화번호가 일치하지 않습니다. 변경 이력을 점주와 확인하세요."});
   }else if(a.phone&&b.phone){observations.push({kind:"confirmed",label:"플랫폼 간 연락처 비교",text:"두 플랫폼의 전화번호가 일치합니다.",source:"Kakao / Google Places API"})}
   const addrA=same(a.address),addrB=same(b.address);
   if(addrA&&addrB&&!addrA.includes(addrB)&&!addrB.includes(addrA)){
    improvements.push({priority:"check",title:"플랫폼 간 주소 표시가 다를 수 있습니다.",reason:"도로명/지번 표기 차이일 수 있으므로 지도에서 실제 위치를 대조하세요."});
   }
  }
  if(matches.length===0)improvements.push({priority:"next",title:"실제 업체 식별을 먼저 완료하세요.",reason:"인증된 공식 API로 업체 일치 여부가 확인되지 않았습니다. 점수나 순위를 만들지 않습니다."});
  if(matches.length===1)improvements.push({priority:"next",title:"플랫폼별 등록 정보 추가 확인",reason:"현재 한 곳의 공식 검색 API만 이름 일치를 확인했습니다. 나머지는 계정 또는 검색권한 확인이 필요합니다."});
  const total=Object.values(platform).filter(x=>x.status==="matched").length;
  return res.status(200).json({
   input:{name,region,placeUrl:link?.url||null,provider:link?.provider||null},
   checkedAt:new Date().toISOString(),
   coverage:{officialApiMatched:total,availableProviders:2,naverChecked:false},
   platforms:platform,observations,improvements,
   notes:[
    "이름만 일치한 경우에도 실제 업체 주소·지도 ID 대조가 필요합니다.",
    "Google/Kakao API 검색 목록 순서는 지도 앱 사용자 화면의 실제 노출순위가 아닙니다.",
    "네이버 플레이스 조회수·전체 SNS 언급수·실시간 유동인구·AI 추천 확률은 이 진단에 포함되지 않습니다."
   ]
  });
};