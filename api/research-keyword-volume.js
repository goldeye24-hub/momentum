'use strict';
const crypto=require('node:crypto');
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(req.method!=='GET')return res.status(405).json({status:'method_not_allowed'});
 const origin=req.headers?.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return res.status(403).json({status:'forbidden'})}catch{return res.status(403).json({status:'forbidden'})}}
 const keyword=String(req.query?.keyword||'').normalize('NFKC').trim().replace(/\s+/g,' ');
 if(keyword.length<2||keyword.length>30||/[<>\x00-\x1f]/.test(keyword))return res.status(400).json({status:'invalid',message:'검색어는 2~30자로 입력하세요.'});
 const apiKey=process.env.NAVER_SEARCHAD_API_KEY,secret=process.env.NAVER_SEARCHAD_SECRET_KEY,customer=process.env.NAVER_SEARCHAD_CUSTOMER_ID;
 if(!apiKey||!secret||!customer)return res.status(503).json({status:'not_configured',message:'네이버 검색광고 API 인증정보가 아직 연결되지 않았습니다. 현재 검색량을 제공할 수 없습니다.'});
 const path='/keywordstool',stamp=String(Date.now());
 const sign=crypto.createHmac('sha256',secret).update(stamp+'.GET.'+path).digest('base64');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8500);
 try{
  const url='https://api.searchad.naver.com'+path+'?'+new URLSearchParams({hintKeywords:keyword.replace(/\s/g,''),showDetail:'1'});
  const response=await fetch(url,{headers:{'X-Timestamp':stamp,'X-API-KEY':apiKey,'X-Customer':customer,'X-Signature':sign},signal:ctrl.signal});
  if(!response.ok)return res.status(502).json({status:'upstream_error',providerStatus:response.status,message:'네이버 검색광고 검색량 조회 실패. 인증·호출제한·서비스 상태를 확인해야 합니다.'});
  const body=await response.json();
  const normalize=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').toUpperCase();
  const item=(Array.isArray(body.keywordList)?body.keywordList:[]).find(x=>normalize(x.relKeyword)===normalize(keyword));
  if(!item)return res.status(200).json({status:'not_found',keyword,observedAt:new Date().toISOString(),message:'검색어와 정확히 일치하는 월간 검색량 항목이 없습니다.'});
  const asCount=x=>typeof x==='number'&&Number.isFinite(x)?x: /^\d+$/.test(String(x))?Number(x):null;
  const pc=asCount(item.monthlyPcQcCnt),mobile=asCount(item.monthlyMobileQcCnt);
  return res.status(200).json({status:'ok',keyword:item.relKeyword,pc:pc??String(item.monthlyPcQcCnt||'미확인'),mobile:mobile??String(item.monthlyMobileQcCnt||'미확인'),total:pc!==null&&mobile!==null?pc+mobile:null,observedAt:new Date().toISOString(),source:'naver_searchad_keywordstool',message:'최근 월간 검색량 참고값. 10 미만은 정확한 숫자로 환산하지 않습니다.'});
 }catch{return res.status(502).json({status:'upstream_unavailable',message:'네이버 검색량 조회 중 네트워크 또는 시간초과 오류가 발생했습니다.'})}
 finally{clearTimeout(timer)}
};