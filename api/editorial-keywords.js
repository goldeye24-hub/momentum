'use strict';
const admin=require('./admin-site-builder');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const recent=new Map();
const cache=new Map();
const clean=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ');
const norm=v=>clean(v).replace(/\s/g,'').toUpperCase();
const asNumber=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:(typeof v==='string'&&/^\d+$/.test(v)?Number(v):null);
const asDisplay=v=>asNumber(v)!==null?String(asNumber(v)):(typeof v==='string'&&/^<\s*10$/.test(v)?'10 미만':'미확인');
const fail=(res,status,message)=>res.status(status).json({status:'error',message});
function validOrigin(req){
 try{const o=new URL(req.headers.origin||'');return o.protocol==='https:'&&o.host===req.headers.host}
 catch{return false}
}
async function queryNaver(keyword){
 const key=process.env.NAVER_SEARCHAD_API_KEY;
 const secret=process.env.NAVER_SEARCHAD_SECRET_KEY;
 const customer=process.env.NAVER_SEARCHAD_CUSTOMER_ID;
 if(!key||!secret||!customer)return {status:'not_configured',message:'서버의 네이버 검색광고 API 연결을 확인해 주세요.'};
 const timestamp=String(Date.now()),endpoint='/keywordstool';
 const signature=crypto.createHmac('sha256',secret).update(timestamp+'.GET.'+endpoint).digest('base64');
 const url='https://api.searchad.naver.com'+endpoint+'?'+new URLSearchParams({hintKeywords:norm(keyword),showDetail:'1'});
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8500);
 try{
  const response=await fetch(url,{method:'GET',headers:{'Accept':'application/json','X-Timestamp':timestamp,'X-API-KEY':key,'X-Customer':customer,'X-Signature':signature},signal:controller.signal});
  if(!response.ok)return {status:'provider_error',message:response.status===429?'네이버 호출 한도 초과로 잠시 조회할 수 없습니다.':'네이버 검색광고 API 오류 ('+response.status+')'};
  const data=await response.json();
  const list=Array.isArray(data.keywordList)?data.keywordList:[];
  const rows=list.filter(x=>x&&typeof x.relKeyword==='string'&&x.relKeyword.length<=80).map(x=>{
   const pc=asNumber(x.monthlyPcQcCnt),mobile=asNumber(x.monthlyMobileQcCnt);
   return {keyword:clean(x.relKeyword),pc, mobile,pcDisplay:asDisplay(x.monthlyPcQcCnt),
    mobileDisplay:asDisplay(x.monthlyMobileQcCnt),total:pc!==null&&mobile!==null?pc+mobile:null,
    competition:String(x.compIdx||'미확인').slice(0,30),isSeed:norm(x.relKeyword)===norm(keyword)};
  });
  rows.sort((a,b)=>Number(b.isSeed)-Number(a.isSeed)||(b.total??-1)-(a.total??-1)||a.keyword.localeCompare(b.keyword,'ko'));
  return {status:'ok',keyword,rows:rows.slice(0,100),returnedCount:list.length,
   measuredAt:new Date().toISOString(),source:'NAVER Search Ads API /keywordstool',
   note:'검색광고 기준 최근 월간 PC·모바일 검색수입니다. 10 미만은 정확한 수치로 환산하지 않습니다. 광고 경쟁도는 블로그 자연검색 난이도가 아닙니다.'};
 }catch(e){return {status:'network_error',message:e?.name==='AbortError'?'네이버 API 응답 시간 초과':'네이버 검색광고 API 연결 실패'}}
 finally{clearTimeout(timer)}
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Frame-Options','DENY');
 // Separate scoped access for ChatGPT's scheduled editorial research.
 // The access token is kept in Vercel env, never in the public repository.
 const envToken=String(process.env.MOMENTUM_EDITORIAL_KEYWORD_ACCESS_TOKEN||'');
 const supplied=String(req.query?.access||'');
 const viaLink=envToken.length>=32&&supplied.length===envToken.length&&
   crypto.timingSafeEqual(Buffer.from(supplied,'utf8'),Buffer.from(envToken,'utf8'));
 const viaAdmin=admin.isAuthorized(req);
 if(!viaLink&&!viaAdmin){
  if(!supplied&&req.method==='GET'){res.statusCode=302;res.setHeader('Location','/admin/');return res.end()}
  return fail(res,404,'조회 페이지를 찾을 수 없습니다.');
 }
 // Human-readable workbench. Automated drafts use an unlisted, read-only GET.
 if(req.method==='GET'&&req.query?.format!=='json'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return res.status(200).end(fs.readFileSync(path.join(process.cwd(),'private-keyword-workbench','index.html'),'utf8'));
 }
 res.setHeader('Content-Type','application/json; charset=utf-8');
 const machineRead=req.method==='GET'&&req.query?.format==='json';
 if(!machineRead&&req.method!=='POST')return fail(res,405,'지원되지 않는 요청 방법입니다.');
 if(req.method==='POST'&&!validOrigin(req))return fail(res,403,'허용되지 않은 요청 출처입니다.');
 const raw=machineRead?JSON.stringify({keyword:req.query?.keyword}):(typeof req.body==='string'?req.body:JSON.stringify(req.body||{}));
 if(raw.length>600)return fail(res,413,'입력 데이터가 너무 깁니다.');
 let body=machineRead?{keyword:req.query?.keyword}:req.body;
 if(typeof body==='string'){try{body=JSON.parse(body)}catch{return fail(res,400,'JSON 입력 오류')}}
 if(!body||typeof body!=='object'||Array.isArray(body))return fail(res,400,'검색어를 입력해 주세요.');
 const keyword=clean(body.keyword);
 if(keyword.length<2||keyword.length>30||/[<>\x00-\x1f]/.test(keyword))return fail(res,400,'검색어를 2~30자로 입력해 주세요.');
 const k=norm(keyword),now=Date.now();
 const saved=cache.get(k);
 if(saved&&now-saved.at<30*60*1000)return res.status(200).json({...saved.data,cache:'30분 이내 재사용'});
 if(cache.size>80){for(const [q,v] of cache)if(now-v.at>30*60*1000)cache.delete(q)}
 const ip=String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||'admin').split(',')[0].slice(0,80);
 if(now-(recent.get(ip)||0)<5000)return fail(res,429,'새 조회는 5초 이상 간격을 두고 진행해 주세요.');
 recent.set(ip,now);
 const result=await queryNaver(keyword);
 if(result.status==='ok'){cache.set(k,{at:now,data:result});return res.status(200).json(result)}
 return fail(res,result.status==='not_configured'?503:502,result.message);
};
