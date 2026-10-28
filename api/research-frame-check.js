'use strict';
const target='https://datalab.naver.com/keyword/trendSearch.naver';
module.exports=async (req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('X-Robots-Tag','noindex,nofollow');
 if(process.env.VERCEL_ENV==='production')return res.status(404).json({status:'not_available'});
 if(req.method!=='GET')return res.status(405).json({status:'method_not_allowed'});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5500);
 try{
   const response=await fetch(target,{
     method:'GET',redirect:'follow',signal:controller.signal,
     headers:{'Accept':'text/html','User-Agent':'Mozilla/5.0 (compatible; MomentumResearch/1.0)'}
   });
   const xfo=String(response.headers.get('x-frame-options')||'').toLowerCase();
   const csp=String(response.headers.get('content-security-policy')||'');
   const directive=csp.match(/(?:^|;)\s*frame-ancestors\s+([^;]+)/i)?.[1]?.trim()||'';
   const blocked=/deny|sameorigin/.test(xfo)||/(?:^|\s)'none'(?:\s|$)/.test(directive)||
     (/(?:^|\s)'self'(?:\s|$)/.test(directive)&&!/(?:https:\/\/\*|https:\/\/.*vercel\.app)/.test(directive));
   await response.body?.cancel().catch(()=>{});
   return res.status(200).json({status:blocked?'blocked':'unknown',httpStatus:response.status,
     reason:blocked?'external_framing_restricted':response.ok?'no_explicit_block_detected':'unexpected_provider_status',
     message:blocked?'네이버 페이지의 보안 설정상 다른 사이트의 iframe에 표시할 수 없습니다.':
       '프레임 제한이 명시적으로 확인되지는 않았지만, 브라우저에서 표시가 차단될 수 있습니다.'});
 }catch{
   return res.status(200).json({status:'unknown',reason:'probe_unavailable',
     message:'외부 프레임 허용 여부를 자동 확인하지 못했습니다. 프레임 표시를 시도할 수는 있으나 성공은 보장되지 않습니다.'});
 }finally{clearTimeout(timer)}
};