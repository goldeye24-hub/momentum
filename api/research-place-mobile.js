'use strict';
/**
 * Preview-only isolated diagnostic lane for Naver Mobile Place list.
 * No shared DB credentials required. Uses browser observation, never inferred rankings.
 * Keep provider request throttling; production route is disabled.
 */
const {runMobile,validateKeyword,mobileTarget}=require('./_place-observe');
const {createOutageLimiter}=require('./_rank-outage-fallback');
const limiter=createOutageLimiter({
 windowMs:60*60*1000,maxPerWindow:2,minScopeGapMs:90*1000,
 minIpGapMs:0,providerBlockMs:24*60*60*1000
});
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(process.env.VERCEL_ENV==='production')return res.status(404).json({status:'not_found',message:'이 연구용 기능은 운영 환경에서 제공하지 않습니다.'});
 if(!['GET','POST'].includes(String(req.method||'').toUpperCase()))return res.status(405).json({status:'method_not_allowed'});
 const origin=req.headers?.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return res.status(403).json({status:'forbidden'})}catch{return res.status(403).json({status:'forbidden'})}}
 let data=req.method==='GET'?req.query:req.body;
 if(typeof data==='string'){try{if(data.length>1200)throw Error();data=JSON.parse(data)}catch{return res.status(400).json({status:'invalid',message:'요청 형식을 확인해 주세요.'})}}
 if(!data||typeof data!=='object'||Array.isArray(data))data={};
 const keyword=validateKeyword(data.keyword),target=mobileTarget(data.placeId||data.placeUrl||data.target||data.name);
 if(!keyword||!target)return res.status(400).json({status:'invalid',message:'검색어와 플레이스 ID 또는 업체명을 입력하세요.'});
 const ip=String(req.headers?.['x-forwarded-for']||'unknown').split(',')[0].slice(0,100);
 const output=await limiter.handle({scope:'mobile',ip,measure:()=>runMobile(keyword,target,{deepScan:true})});
 const sanitizedMessage=String(output.message||'').replace(' · 공유 저장소 장애로 서버 동기화 없이 브라우저에서만 기록됩니다.','');
 const result={...output,message:sanitizedMessage,scope:'naver_mobile_place_list',
  sourceMode:'preview_browser_observation',cacheMode:'no_saved_result',query:keyword};
 if(result.status==='fallback_rate_limited')return res.status(429).json(result);
 if(result.status==='blocked')return res.status(503).json(result);
 if(['unavailable','no_place_block'].includes(result.status))return res.status(502).json(result);
 if(['ranked','not_in_observed_range','not_in_block'].includes(result.status))return res.status(200).json(result);
 return res.status(502).json(result);
};