'use strict';
const crypto=require('node:crypto');

/** Naver SearchAd keywordstool: monthly PC and mobile query counts.
 * Preview research endpoint; credentials stay server-side.
 */
const normalized=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').toUpperCase();
const numeric=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:
  typeof x==='string'&&/^\d+$/.test(x)?Number(x):null;

module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Robots-Tag','noindex,nofollow');
 if(process.env.VERCEL_ENV==='production')return res.status(404).json({status:'not_available'});
 if(req.method!=='GET')return res.status(405).json({status:'method_not_allowed'});
 if(req.headers?.origin){
  try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({status:'forbidden'})}
  catch{return res.status(403).json({status:'forbidden'})}
 }
 const keyword=String(req.query?.keyword||'').normalize('NFKC').trim().replace(/\s+/g,' ');
 if(keyword.length<2||keyword.length>40||/[<>\x00-\x1f]/.test(keyword)){
  return res.status(400).json({status:'invalid_keyword',message:'2~40자의 키워드를 입력하세요.'});
 }
 const apiKey=process.env.NAVER_SEARCHAD_API_KEY;
 const secret=process.env.NAVER_SEARCHAD_SECRET_KEY;
 const customer=process.env.NAVER_SEARCHAD_CUSTOMER_ID;
 if(!apiKey||!secret||!customer)return res.status(503).json({
  status:'not_configured',
  message:'네이버 검색광고 API 발급·연결 대기 중입니다. 검색량 숫자는 인증 후 표시됩니다.'
 });
 const path='/keywordstool',timestamp=String(Date.now());
 const signature=crypto.createHmac('sha256',secret).update(timestamp+'.GET.'+path).digest('base64');
 const url='https://api.searchad.naver.com'+path+'?'+new URLSearchParams({
  hintKeywords:keyword.replace(/\s/g,''),showDetail:'1'
 });
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8500);
 try{
  const response=await fetch(url,{method:'GET',signal:controller.signal,headers:{
    'Accept':'application/json',
    'X-Timestamp':timestamp,'X-API-KEY':apiKey,'X-Customer':customer,'X-Signature':signature
  }});
  if(!response.ok)return res.status(response.status===429?429:502).json({
   status:response.status===429?'rate_limited':'provider_error',
   providerStatus:response.status,
   message:response.status===429?'네이버 검색광고 API 요청 제한에 도달했습니다.':'네이버 검색광고 API 조회에 실패했습니다. 인증정보 또는 API 상태를 확인해 주세요.'
  });
  const body=await response.json();
  const match=(Array.isArray(body.keywordList)?body.keywordList:[]).find(x=>normalized(x.relKeyword)===normalized(keyword));
  if(!match)return res.status(200).json({status:'not_found',keyword,message:'입력한 검색어와 일치하는 월간 검색량 항목을 찾지 못했습니다.'});
  const pc=numeric(match.monthlyPcQcCnt),mo=numeric(match.monthlyMobileQcCnt);
  return res.status(200).json({
   status:'ok',keyword:String(match.relKeyword||keyword),pc:pc??String(match.monthlyPcQcCnt??'확인 불가'),
   mobile:mo??String(match.monthlyMobileQcCnt??'확인 불가'),
   total:pc!==null&&mo!==null?pc+mo:null,
   source:'NAVER SearchAd Keyword Tool',observedAt:new Date().toISOString(),
   note:'최근 월간 검색량 참고값입니다. 10회 미만(예: < 10)은 그대로 표시하며 합계를 임의 계산하지 않습니다.'
  });
 }catch{
  return res.status(502).json({status:'upstream_unavailable',message:'네이버 검색광고 API 연결 중 네트워크 또는 시간 초과 오류가 발생했습니다.'});
 }finally{clearTimeout(timer)}
};
module.exports._test={normalized,numeric};
