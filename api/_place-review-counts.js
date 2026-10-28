'use strict';
/**
 * Public NAVER Place review counters; no login, no hidden APIs, no review content.
 * Count is null unless unambiguously attached to a visible labelled review link.
 */
const chromium=require('@sparticuz/chromium');
const playwright=require('playwright-core');
const clean=x=>String(x||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const count=v=>{
 const x=String(v||'').replace(/,/g,'').trim();
 return /^\d{1,8}$/.test(x)&&Number(x)<=99999999?Number(x):null;
};
const numberFrom=(text,label)=>{
 const s=clean(text);
 const re=label==='visitor'?/(?:방문자\s*리뷰|방문자리뷰)\s*([0-9][0-9,]{0,12})/g:
  /(?:블로그\s*리뷰|블로그리뷰)\s*([0-9][0-9,]{0,12})/g;
 const matches=[...s.matchAll(re)].map(x=>count(x[1])).filter(x=>x!==null);
 return matches.length===1?matches[0]:matches.length>1&&matches.every(x=>x===matches[0])?matches[0]:null;
};
function fromEvidence(evidence){
 const get=k=>{
  const high=evidence.filter(x=>x.type===k&&x.hrefType===k&&x.source==='link');
  const fromLinks=high.map(x=>numberFrom(x.text,k)).filter(v=>v!==null);
  if(fromLinks.length&&fromLinks.every(x=>x===fromLinks[0]))return fromLinks[0];
  const other=evidence.filter(x=>x.type===k&&x.source==='label').map(x=>numberFrom(x.text,k)).filter(v=>v!==null);
  return other.length&&other.every(x=>x===other[0])?other[0]:null;
 };
 return {visitorCount:get('visitor'),blogCount:get('blog')};
}
const cache=new Map();
async function observe(placeId){
 if(!/^\d{6,20}$/.test(String(placeId||'')))return {status:'invalid_id',visitorCount:null,blogCount:null};
 const existing=cache.get(placeId);
 if(existing&&Date.now()-existing.time<180000)return {...existing.result,cacheHit:true};
 const id=String(placeId),routes=['restaurant','place','hairshop'],paths=['home','review/visitor','review/ugc'];
 let browser,lastStatus='page_unavailable',vis=null,blog=null;
 try{
  browser=await playwright.chromium.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true,timeout:12000});
  const context=await browser.newContext({locale:'ko-KR',timezoneId:'Asia/Seoul',
   viewport:{width:390,height:844},isMobile:true,hasTouch:true,
   userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'});
  const page=await context.newPage();
  // Limit to three URLs and one route; no continuous scraping.
  for(const route of routes){
   const url='https://m.place.naver.com/'+route+'/'+id+'/home';
   const rsp=await page.goto(url,{waitUntil:'domcontentloaded',timeout:11000}).catch(()=>null);
   if(rsp?.status()===429||rsp?.status()===403)return {status:'blocked',visitorCount:null,blogCount:null};
   if(rsp?.status()!==200||new URL(page.url()).hostname!=='m.place.naver.com')continue;
   lastStatus='no_visible_count';
   for(const path of paths){
    if(path!=='home'){
     const r=await page.goto('https://m.place.naver.com/'+route+'/'+id+'/'+path,{waitUntil:'domcontentloaded',timeout:9500}).catch(()=>null);
     if(r?.status()===403||r?.status()===429)break;
     if(r?.status()!==200||new URL(page.url()).hostname!=='m.place.naver.com')continue;
    }
    await page.waitForTimeout(1050);
    const evidence=await page.evaluate(()=>{
     const result=[];
     const clean=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,130);
     const classify=link=>{
      const path=link.getAttribute('href')||'';
      if(/\/review\/visitor(?:[/?#]|$)/.test(path))return 'visitor';
      if(/\/review\/(?:ugc|blog)(?:[/?#]|$)/.test(path))return 'blog';
      return null;
     };
     for(const el of document.querySelectorAll('a[href],button,[role="tab"]')){
      const type=classify(el);
      const text=clean(el.innerText||el.textContent||el.getAttribute('aria-label'));
      if(type&&text)result.push({type,hrefType:type,source:'link',text});
     }
     for(const el of document.querySelectorAll('nav a,nav button,[role="tab"],a[aria-label],button[aria-label]')){
      const text=clean(el.innerText||el.textContent||el.getAttribute('aria-label'));
      const type=/방문자\s*리뷰/.test(text)?'visitor':/블로그\s*리뷰/.test(text)?'blog':null;
      if(type&&text.length<=90)result.push({type,hrefType:null,source:'label',text});
     }
     return result.slice(0,90);
    });
    const counts=fromEvidence(evidence);
    if(vis===null&&counts.visitorCount!==null)vis=counts.visitorCount;
    if(blog===null&&counts.blogCount!==null)blog=counts.blogCount;
    if(vis!==null&&blog!==null)break;
   }
   break;
  }
  const result={status:vis!==null||blog!==null?'partial_or_complete':'unavailable',
   visitorCount:vis,blogCount:blog,observedAt:new Date().toISOString(),
   source:'public_naver_place_review_labels',note:'네이버 공개 플레이스에 표시된 방문자·블로그 리뷰 수. 영수증 리뷰만의 수량은 아닙니다.',
   complete:vis!==null&&blog!==null};
  if(result.status!=='unavailable')cache.set(id,{time:Date.now(),result});
  return result;
 }catch(e){return {status:'fetch_failed',visitorCount:null,blogCount:null,observedAt:new Date().toISOString()}}
 finally{await browser?.close().catch(()=>{})}
}
module.exports={observe,_test:{count,numberFrom,fromEvidence}};
