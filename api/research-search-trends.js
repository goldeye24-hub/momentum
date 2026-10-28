'use strict';
const MAX_GROUPS=5;
function validKeywords(x){
 if(!Array.isArray(x)||x.length<1||x.length>MAX_GROUPS)return null;
 const out=x.map(v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' '));
 if(out.some(v=>v.length<2||v.length>40||/[\x00-\x1f<>]/.test(v)))return null;
 return [...new Set(out)].slice(0,MAX_GROUPS);
}
function rangeDates(range){
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
 const start=new Date(today+'T00:00:00Z');
 const months={m1:1,m3:3,y1:12,y3:36}[range]||12;
 start.setUTCMonth(start.getUTCMonth()-months);
 return {startDate:start.toISOString().slice(0,10),endDate:today};
}
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(process.env.VERCEL_ENV==='production')return res.status(404).json({status:'not_available'});
 if(req.method!=='POST')return res.status(405).json({status:'method_not_allowed'});
 if(req.headers?.origin){
   try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({status:'forbidden'})}
   catch{return res.status(403).json({status:'forbidden'})}
 }
 let input=req.body||{};
 if(typeof input==='string'){try{if(input.length>2500)throw Error();input=JSON.parse(input)}catch{return res.status(400).json({status:'invalid_json'})}}
 const keywords=validKeywords(input.keywords),range=String(input.range||'y1'),device=String(input.device||'all');
 if(!keywords||!['m1','m3','y1','y3'].includes(range)||!['all','pc','mo'].includes(device))return res.status(400).json({status:'invalid_input',message:'검색어는 최대 5개이며, 기간과 기기를 올바르게 선택해야 합니다.'});
 const id=process.env.NAVER_DATALAB_CLIENT_ID||process.env.NAVER_OPENAPI_CLIENT_ID;
 const secret=process.env.NAVER_DATALAB_CLIENT_SECRET||process.env.NAVER_OPENAPI_CLIENT_SECRET;
 if(!id||!secret)return res.status(503).json({
   status:'not_configured',
   message:'네이버 데이터랩 오픈API 인증정보가 연결되지 않았습니다. Vercel Preview 환경에 NAVER_DATALAB_CLIENT_ID 및 NAVER_DATALAB_CLIENT_SECRET을 등록해야 합니다.'
 });
 const dates=rangeDates(range);
 const reqBody={...dates,timeUnit:range==='m1'?'date':range==='m3'?'week':'month',
   keywordGroups:keywords.map(k=>({groupName:k,keywords:[k]})),...(device==='all'?{}:{device})};
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),9500);
 try{
   const response=await fetch('https://openapi.naver.com/v1/datalab/search',{
     method:'POST',headers:{'Content-Type':'application/json','X-Naver-Client-Id':id,'X-Naver-Client-Secret':secret},
     body:JSON.stringify(reqBody),signal:ctrl.signal
   });
   if(!response.ok)return res.status(502).json({status:'provider_error',providerHttpStatus:response.status,message:'네이버 데이터랩 공식 API에서 응답 오류가 발생했습니다. 인증 또는 이용 한도를 확인해야 합니다.'});
   const payload=await response.json();
   const groups=Array.isArray(payload.results)?payload.results:[];
   const results=groups.map(g=>({
     keyword:String(g.title||'').slice(0,50),
     points:(Array.isArray(g.data)?g.data:[])
       .filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(String(p.period))&&Number.isFinite(Number(p.ratio)))
       .map(p=>({period:p.period,ratio:Math.max(0,Math.min(100,Number(p.ratio)))}))
   }));
   return res.status(200).json({status:'ok',source:'NAVER Datalab Search Trend API',
     ...dates,timeUnit:reqBody.timeUnit,device,keywords,results,
     note:'0~100 상대 검색 관심도 지수입니다. 검색 횟수(건수)가 아닙니다.',queriedAt:new Date().toISOString()});
 }catch(err){
   return res.status(502).json({status:'upstream_unavailable',message:'데이터랩 API 네트워크 연결 또는 시간 초과로 조회하지 못했습니다.'});
 }finally{clearTimeout(timeout)}
};
module.exports._test={validKeywords,rangeDates};
