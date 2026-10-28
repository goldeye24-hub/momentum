'use strict';
const crypto=require('node:crypto');
const normalize=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').toUpperCase();
const asCount=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0?x:
 typeof x==='string'&&/^\d+$/.test(x)?Number(x):null;
async function lookup(keyword){
 const apiKey=process.env.NAVER_SEARCHAD_API_KEY;
 const secret=process.env.NAVER_SEARCHAD_SECRET_KEY;
 const customer=process.env.NAVER_SEARCHAD_CUSTOMER_ID;
 if(!apiKey||!secret||!customer)return {status:'not_configured',message:'네이버 검색광고 API 인증키가 연결되지 않았습니다.'};
 const timestamp=String(Date.now()),path='/keywordstool';
 const signature=crypto.createHmac('sha256',secret).update(timestamp+'.GET.'+path).digest('base64');
 const q=new URLSearchParams({hintKeywords:keyword.replace(/\s+/g,''),showDetail:'1'});
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8500);
 try{
  const res=await fetch('https://api.searchad.naver.com'+path+'?'+q,{
   method:'GET',headers:{'Accept':'application/json','X-Timestamp':timestamp,
   'X-API-KEY':apiKey,'X-Customer':customer,'X-Signature':signature},signal:ctl.signal
  });
  if(!res.ok)return {status:'provider_error',httpStatus:res.status,
   message:res.status===429?'네이버 API 호출 제한에 도달했습니다.':'네이버 검색광고 API 인증 또는 서비스 상태를 확인해 주세요.'};
  const j=await res.json();
  const value=(Array.isArray(j.keywordList)?j.keywordList:[])
   .find(x=>normalize(x.relKeyword)===normalize(keyword));
  if(!value)return {status:'not_found',message:'해당 키워드의 월간 검색량이 반환되지 않았습니다.'};
  const pc=asCount(value.monthlyPcQcCnt),mobile=asCount(value.monthlyMobileQcCnt);
  return {status:'ok',keyword:String(value.relKeyword||keyword),
    pc, mobile,pcRaw:String(value.monthlyPcQcCnt??'미확인'),
    mobileRaw:String(value.monthlyMobileQcCnt??'미확인'),
    total:pc!==null&&mobile!==null?pc+mobile:null,observedAt:new Date().toISOString()};
 }catch(e){return {status:'network_error',message:'네이버 검색광고 API 연결 시간이 초과되었거나 네트워크 오류가 발생했습니다.'}}
 finally{clearTimeout(timer)}
}
module.exports={lookup,normalize,asCount};
