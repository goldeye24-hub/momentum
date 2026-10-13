'use strict';
/** Website technical SEO audit through Google's PageSpeed Insights API.
 * It is NOT an audit of Naver Place and does NOT predict AI recommendation rank.
 * Never fetch the supplied URL directly from the Vercel server.
 */
const lastRequests=new Map();
const checks=[
  ["document-title","페이지 제목(title)"],
  ["meta-description","페이지 설명(meta description)"],
  ["is-crawlable","검색엔진 색인 허용"],
  ["robots-txt","robots.txt"],
  ["viewport","모바일 뷰포트"],
  ["canonical","대표 URL(canonical)"],
  ["crawlable-anchors","검색엔진이 따라갈 수 있는 링크"],
  ["link-text","링크에 이해할 수 있는 문구"],
  ["structured-data","구조화 데이터 검사"]
];
function validateUrl(input){
 if(typeof input!=="string"||input.length>450)return null;
 let u;
 try{u=new URL(input.trim())}catch{return null}
 if(!["https:","http:"].includes(u.protocol)||u.username||u.password||u.port||u.hash)return null;
 let host=u.hostname.toLowerCase();
 if(host==="localhost"||host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".test")||host.endsWith(".invalid")||host==="0.0.0.0"||/^\d+(\.\d+){3}$/.test(host)||host.includes(":")||!host.includes("."))return null;
 if(/(^|\.)(naver\.com|naver\.me|kakao\.com|google\.com|google\.co\.kr|maps\.app\.goo\.gl|goo\.gl)$/.test(host))return null;
 if(!/^[a-z0-9.-]+$/.test(host)||host.startsWith("-")||host.length>220)return null;
 u.search="";u.hash="";
 return u.href;
}
function miniAudit(id,data){
 if(!data)return {id,title:checks.find(x=>x[0]===id)?.[1]||id,state:"not_measured",details:"이 Lighthouse 버전에서 해당 검사를 제공하지 않았습니다."};
 let state=data.scoreDisplayMode==="notApplicable"||data.scoreDisplayMode==="not_applicable"?"not_applicable":
   typeof data.score==="number"?(data.score>=0.9?"passed":"needs_attention"):"informational";
 let snippet=String(data.displayValue||data.explanation||data.errorMessage||"").replace(/<[^>]*>/g," ").slice(0,350);
 return {id,title:checks.find(x=>x[0]===id)?.[1]||id,state,score:typeof data.score==="number"?data.score:null,details:snippet};
}
module.exports=async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 if(req.method!=="GET")return res.status(405).json({error:"GET 요청만 가능합니다."});
 const url=validateUrl(req.query?.url);
 const strategy=String(req.query?.strategy||"mobile");
 if(!url||!["mobile","desktop"].includes(strategy))return res.status(400).json({error:"검사할 공개 홈페이지 주소(https://)와 기기 유형을 확인하세요. 지도·플레이스 링크는 홈페이지가 아닙니다."});
 const ip=String(req.headers?.["x-forwarded-for"]||"anonymous").split(",")[0].slice(0,60);
 const key=ip+"|"+url;
 const now=Date.now();
 if(now-(lastRequests.get(key)||0)<45000)return res.status(429).json({error:"같은 홈페이지의 기술 SEO 검사는 45초 후 다시 실행할 수 있습니다."});
 lastRequests.set(key,now);if(lastRequests.size>500)lastRequests.clear();
 const endpoint=new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
 endpoint.searchParams.set("url",url);
 endpoint.searchParams.append("category","SEO");
 endpoint.searchParams.append("category","PERFORMANCE");
 endpoint.searchParams.set("strategy",strategy);
 endpoint.searchParams.set("locale","ko");
 if(process.env.PAGESPEED_API_KEY)endpoint.searchParams.set("key",process.env.PAGESPEED_API_KEY);
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),26000);
 try{
  const response=await fetch(endpoint.href,{signal:ctrl.signal,headers:{Accept:"application/json"}});
  if(!response.ok){
   const kind=response.status===429?"구글 분석 API 사용량 한도에 도달했습니다.":
     [400,403].includes(response.status)?"PageSpeed API가 요청을 거절했습니다. 사이트 공개 여부나 API 인증 상태를 확인하세요.":
     "Google PageSpeed 분석 요청에 실패했습니다.";
   return res.status(502).json({error:kind,upstreamStatus:response.status});
  }
  const data=await response.json();
  if(data?.lighthouseResult?.runtimeError)return res.status(502).json({error:"Lighthouse 검사 중 페이지 접근 문제가 발생했습니다. 사이트 공개 여부를 확인하세요."});
  const lr=data.lighthouseResult||{};
  const as=lr.audits||{},categories=lr.categories||{};
  const score=key=>typeof categories[key]?.score==="number"?Math.round(categories[key].score*100):null;
  const auditList=checks.map(([id])=>miniAudit(id,as[id]));
  const errors=auditList.filter(a=>a.state==="needs_attention");
  const pass=auditList.filter(a=>a.state==="passed");
  const seoRefs=(categories.seo?.auditRefs||[]).filter(x=>x?.weight>0).map(x=>x.id);
  const other=seoRefs.filter(id=>!checks.some(x=>x[0]===id)).slice(0,10).map(id=>miniAudit(id,as[id]));
  return res.status(200).json({
   source:"Google PageSpeed Insights API / Lighthouse",
   checkedAt:lr.fetchTime||data.analysisUTCTimestamp||new Date().toISOString(),
   requestedUrl:url,finalUrl:String(lr.finalUrl||url).slice(0,500),strategy,
   score:{seo:score("seo"),performance:score("performance")},
   auditSummary:{passed:pass.length,needsAttention:errors.length,unavailable:auditList.filter(a=>a.state==="not_measured").length},
   checks:[...auditList,...other],
   warning:"Lighthouse 기술 SEO 점수는 네이버 플레이스 순위, 검색 노출 보장, AI GEO 추천 확률이 아닙니다.",
   sourceUrl:"https://pagespeed.web.dev/"
  });
 }catch(e){
  return res.status(502).json({error:e?.name==="AbortError"?"사이트 분석이 시간 제한을 초과했습니다. Google PageSpeed Insights에서 직접 확인해 주세요.":"Google PageSpeed 분석 연결이 실패했습니다."});
 }finally{clearTimeout(timer)}
};
module.exports.validateUrl=validateUrl;
