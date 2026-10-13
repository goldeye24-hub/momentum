'use strict';
/* Vercel serverless endpoint: API result positions are NOT map-app rankings.
 * Never return third-party search results unless the API's display/redistribution
 * terms and the project's commercial-use permissions are satisfied.
 */
module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(req.method!=="GET")return res.status(405).json({error:"GET 요청만 지원합니다."});
  if(process.env.MOMENTUM_PLACE_API_ENABLED!=="true")return res.status(503).json({error:"관리자가 공식 장소 API 연동을 활성화하지 않았습니다."});
  const raw=req.query||{};
  const provider=String(raw.provider||"").toLowerCase();
  const keyword=String(raw.keyword||"").trim().slice(0,75);
  const business=String(raw.business||"").trim().slice(0,70);
  if(!["kakao","google"].includes(provider)||keyword.length<2)return res.status(400).json({error:"플랫폼과 검색어를 입력하세요."});
  const normalized=s=>String(s||"").replace(/[^\p{L}\p{N}]/gu,"").toLocaleLowerCase("ko");
  const match=(list)=>{
    if(!business)return null;
    const target=normalized(business);
    let found=list.findIndex(p=>normalized(p.name)===target);
    if(found<0)found=list.findIndex(p=>normalized(p.name).includes(target)&&target.length>=3);
    return found<0?null:found+1;
  };
  let data=[];
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8500);
    try {
      if(provider==="kakao"){
        const key=process.env.KAKAO_REST_API_KEY;
        if(!key)return res.status(503).json({error:"카카오 REST API 키가 등록되지 않았습니다."});
        const u=new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
        u.searchParams.set("query",keyword);
        u.searchParams.set("size","15");
        u.searchParams.set("page","1");
        u.searchParams.set("sort","accuracy");
        const r=await fetch(u,{headers:{"Authorization":"KakaoAK "+key,"Accept":"application/json"},signal:controller.signal});
        if(!r.ok)throw Error("카카오 API 응답 "+r.status);
        const d=await r.json();
        data=(d.documents||[]).map(p=>({id:String(p.id||""),name:String(p.place_name||""),address:String(p.road_address_name||p.address_name||""),url:String(p.place_url||"")}));
      }else{
        const key=process.env.GOOGLE_PLACES_API_KEY;
        if(!key)return res.status(503).json({error:"Google Places API 키가 등록되지 않았습니다."});
        const r=await fetch("https://places.googleapis.com/v1/places:searchText",{
          method:"POST",
          headers:{"Content-Type":"application/json","X-Goog-Api-Key":key,"X-Goog-FieldMask":"places.id,places.displayName,places.formattedAddress,places.googleMapsUri"},
          body:JSON.stringify({textQuery:keyword,languageCode:"ko",regionCode:"KR",pageSize:20,rankPreference:"RELEVANCE"}),
          signal:controller.signal
        });
        if(!r.ok)throw Error("Google Places API 응답 "+r.status);
        const d=await r.json();
        data=(d.places||[]).map(p=>({id:String(p.id||""),name:String(p.displayName?.text||""),address:String(p.formattedAddress||""),url:String(p.googleMapsUri||"")}));
      }
    }finally{clearTimeout(timeout)}
    return res.status(200).json({provider,keyword,checkedAt:new Date().toISOString(),matchedPosition:match(data),places:data,rankingType:"api_result_order",notice:"공식 검색 API의 결과 위치입니다. 실제 네이버·구글·카카오 지도 앱 순위와 다를 수 있습니다."});
  }catch(e){
    return res.status(502).json({error:"외부 장소 API 요청이 실패했습니다. API 인증·쿼터·연결 설정을 확인하세요."});
  }
};