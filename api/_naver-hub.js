'use strict';
/**
 * NAVER API HUB integration for NAVER-first Momentum diagnostics.
 * New NAVER API HUB endpoint, not deprecated developers.naver.com keys.
 *
 * Important: NAVER Search API terms restrict data derivation/AI use,
 * redistribution, caching and advertising around results.
 * Never enable public display before rights review and approval.
 */
const clean=(v,n=110)=>String(v??"").trim().slice(0,n);
const norm=s=>String(s||"").normalize('NFKC').replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
const strip=s=>String(s||"").replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
function placeIdFromUrl(url){
 try{
  const u=new URL(url);
  if(u.protocol!=='https:')return null;
  const h=u.hostname.toLowerCase();
  if(h!=='naver.com'&&!h.endsWith('.naver.com'))return null;
  let match=u.pathname.match(/\/(?:restaurant|place|accommodation|hospital|hairshop|beauty|cafe|shopping|attraction|entry)\/(?:place\/)?(\d{5,20})(?:\/|$)/);
  if(!match)match=u.pathname.match(/\/(\d{6,20})(?:\/|$)/);
  return match?match[1]:null;
 }catch{return null}
}
function matchResults(items,name){
 const target=norm(name);
 const exact=items.filter(i=>norm(i.name)===target);
 const choices=exact.length?exact:items.filter(i=>target.length>=3&&(norm(i.name).includes(target)||target.includes(norm(i.name))&&norm(i.name).length>2));
 if(choices.length>1)return {status:'ambiguous',candidates:choices.slice(0,5),note:'네이버 지역 검색 API에서 동명 또는 유사한 업체가 복수 발견되었습니다. 입력 링크와 동일 매장인지 검증해야 합니다.'};
 if(exact.length===1)return {status:'matched',store:exact[0],matchType:'exactName',note:'네이버 지역 검색 API에서 상호명과 일치하는 후보를 찾았습니다. 입력된 플레이스 ID와 검색 결과의 동일성까지 검증된 것은 아닙니다.'};
 if(choices.length===1)return {status:'name_candidate',candidates:choices,note:'상호명이 유사한 업체 후보가 있습니다. 주소를 확인하기 전까지 동일 매장으로 확정하지 않습니다.'};
 return {status:'not_found',note:'네이버 지역 검색 API의 최대 5개 결과 안에서 일치 상호를 확인하지 못했습니다. 네이버지도 미노출을 뜻하지 않습니다.'};
}
function rightsReady(){
 return process.env.MOMENTUM_NAVER_API_ENABLED==='true'&&process.env.MOMENTUM_NAVER_PUBLIC_DISPLAY_APPROVED==='true';
}
async function lookup(name){
 if(!rightsReady())return {status:'not_configured',note:'네이버 API HUB 연동 또는 상업용 검색결과 표시 권한 확인이 완료되지 않았습니다. 모멘텀이 내부 설정으로 처리합니다.'};
 const keyId=process.env.NAVER_API_HUB_CLIENT_ID;
 const key=process.env.NAVER_API_HUB_CLIENT_SECRET;
 if(!keyId||!key)return {status:'not_configured',note:'모멘텀 서버의 NAVER API HUB 인증 정보가 아직 연결되지 않았습니다.'};
 const q=new URL('https://naverapihub.apigw.ntruss.com/search/v1/local');
 q.searchParams.set('query',clean(name,80));
 q.searchParams.set('display','5');
 q.searchParams.set('start','1');
 q.searchParams.set('sort','random');
 q.searchParams.set('format','json');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetch(q,{headers:{'X-NCP-APIGW-API-KEY-ID':keyId,'X-NCP-APIGW-API-KEY':key,'Accept':'application/json'},signal:controller.signal});
  if(!response.ok)return {status:'api_error',note:'네이버 API HUB 요청 오류 ('+response.status+'). 인증·권한·호출 한도를 확인하세요.'};
  const data=await response.json();
  const items=(Array.isArray(data.items)?data.items:[]).slice(0,5).map(i=>({
   name:clean(strip(i.title),110),
   category:clean(i.category,120),
   address:clean(i.roadAddress||i.address,170),
   roadAddress:clean(i.roadAddress,170),
   landAddress:clean(i.address,170),
   url:clean(i.link,350),
   // Local API does not return usable phone/review count/place app rank.
   phone:'',providerId:null
  }));
  return {...matchResults(items,name),source:'NAVER API HUB · Search Local',scope:'API 결과 최대 5개 · 네이버지도 순위가 아님',observedCount:items.length,checkedAt:new Date().toISOString()};
 }catch(err){return {status:'api_error',note:err?.name==='AbortError'?'네이버 API HUB 응답 시간 초과':'네이버 API HUB 연결 오류'};}
 finally{clearTimeout(timer)}
}
module.exports={lookup,placeIdFromUrl,matchResults,rightsReady};
