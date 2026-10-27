'use strict';
/**
 * NAVER API HUB / Search Trend — source-verified relative index only.
 * Never invent counts; never ship the provider secret to browsers.
 * Public display is disabled until account rights and credentials are approved.
 */
const hits=new Map();
const trim=(s,n=60)=>String(s??'').normalize('NFKC').trim().replace(/\s+/g,' ').slice(0,n);
const dateOK=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const kstToday=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
function parse(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('요청 형식을 확인해 주세요.');
 const startDate=trim(body.startDate,10),endDate=trim(body.endDate,10);
 if(!dateOK(startDate)||!dateOK(endDate)||startDate<'2016-01-01'||endDate>kstToday()||startDate>endDate)throw Error('2016-01-01부터 오늘까지의 유효한 날짜를 선택하세요.');
 const span=(Date.parse(endDate)-Date.parse(startDate))/86400000;
 if(span<7||span>731)throw Error('조회 기간은 7일 이상, 최대 24개월입니다.');
 const timeUnit=['date','week','month'].includes(body.timeUnit)?body.timeUnit:'week';
 const device=['pc','mo'].includes(body.device)?body.device:undefined;
 const input=body.keywordGroups;
 if(!Array.isArray(input)||input.length<1||input.length>5)throw Error('비교할 검색어를 1~5개 입력하세요.');
 const used=new Set(),keywordGroups=input.map(row=>{
   const groupName=trim(row?.groupName,40);
   const keywords=Array.isArray(row?.keywords)?row.keywords.map(v=>trim(v,40)).filter(Boolean):[];
   if(!groupName||keywords.length<1||keywords.length>5||groupName.length<2||/[<>\x00-\x1f]/.test(groupName))throw Error('각 검색어는 2~40자로 입력하세요.');
   const unique=groupName.replace(/\s/g,'').toLocaleLowerCase('ko');
   if(used.has(unique))throw Error('중복 검색어를 삭제하세요.');
   used.add(unique);
   return {groupName,keywords};
 });
 return {startDate,endDate,timeUnit,keywordGroups,...(device?{device}:{})};
}
function throttle(ip){
 const now=Date.now();
 if(hits.size>500){for(const [key,v] of hits){if(now-v.since>60000)hits.delete(key)}}
 const prev=hits.get(ip)||{since:now,count:0};
 if(now-prev.since>60000){prev.since=now;prev.count=0}
 prev.count++;hits.set(ip,prev);
 return prev.count>8;
}
function parseProvider(payload,requested){
 const results=Array.isArray(payload?.results)?payload.results:[];
 return {startDate:requested.startDate,endDate:requested.endDate,timeUnit:requested.timeUnit,
  checkedAt:new Date().toISOString(),provider:'NAVER API HUB / 검색어 트렌드',
  indexType:'relative_search_interest_0_to_100',absoluteVolume:false,
  series:results.slice(0,5).map(x=>({
   title:trim(x.title,40),
   points:(Array.isArray(x.data)?x.data:[]).filter(p=>dateOK(p.period)&&Number.isFinite(Number(p.ratio)))
     .slice(0,750).map(p=>({period:p.period,ratio:Math.max(0,Math.min(100,Number(p.ratio)))}))
  })),
  note:'네이버 통합검색 검색어 트렌드의 기간 내 상대 지수(최댓값 100)이며 절대 검색 횟수·검색광고 월간 검색량이 아닙니다. 매체·기기·기간에 따라 차이가 있습니다.'
 };
}
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Robots-Tag','noindex');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'POST 요청만 허용합니다.'});
 const origin=req.headers?.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return res.status(403).json({error:'허용되지 않은 요청 출처입니다.'})}catch{return res.status(403).json({error:'요청 출처 오류'})}}
 const ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'unknown').split(',')[0].slice(0,80);
 if(throttle(ip))return res.status(429).json({error:'조회가 많습니다. 1분 후 다시 시도해 주세요.'});
 const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
 if(raw.length>3500)return res.status(413).json({error:'검색어 입력이 너무 깁니다.'});
 let query;try{query=parse(typeof req.body==='string'?JSON.parse(req.body):req.body)}catch(e){return res.status(400).json({error:e.message||'요청을 확인해 주세요.'})}
 const allowed=process.env.MOMENTUM_DATALAB_ENABLED==='true'&&process.env.MOMENTUM_DATALAB_PUBLIC_DISPLAY_APPROVED==='true';
 const keyId=process.env.NAVER_API_HUB_CLIENT_ID,key=process.env.NAVER_API_HUB_CLIENT_SECRET;
 if(!allowed||!keyId||!key)return res.status(503).json({status:'not_connected',error:'공식 네이버 데이터랩 API의 인증 또는 공개 제공 권한이 아직 연결되지 않았습니다. 네이버 공식 데이터랩을 이용하거나 확보한 검색어 지수 CSV를 가져와 비교할 수 있습니다.',setup:'NAVER API HUB 검색어 트렌드 이용 신청 후 관리자가 서버 비밀키와 공개 이용 권한을 확인해야 합니다.'});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8500);
 try{
  const response=await fetch('https://naverapihub.apigw.ntruss.com/search-trend/v1/search',{method:'POST',signal:controller.signal,
   headers:{'Content-Type':'application/json','Accept':'application/json','X-NCP-APIGW-API-KEY-ID':keyId,'X-NCP-APIGW-API-KEY':key},
   body:JSON.stringify(query)});
  if(!response.ok)return res.status(response.status===429?429:502).json({status:'provider_error',error:'네이버 데이터랩 API가 요청을 처리하지 못했습니다. 인증·이용 한도 또는 입력 조건을 확인해 주세요. (응답 '+response.status+')'});
  const payload=await response.json(),parsed=parseProvider(payload,query);
  if(!parsed.series.length)return res.status(502).json({status:'provider_error',error:'네이버 데이터랩 응답에 그래프 데이터가 없습니다.'});
  return res.status(200).json(parsed);
 }catch(e){return res.status(502).json({status:'provider_error',error:e.name==='AbortError'?'데이터랩 응답 시간이 초과됐습니다.':'데이터랩 서버 연결에 실패했습니다.'})}
 finally{clearTimeout(timer)}
};
module.exports.parse=parse;
module.exports.parseProvider=parseProvider;
