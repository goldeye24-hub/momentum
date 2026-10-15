'use strict';
// Deliberate one-off, read-only mobile page validation. No login or anti-bot bypass.
const {chromium}=require('playwright');
const {runMobile}=require('../api/_place-observe.js');
(async()=>{
 const keyword='포항맛집',id='2085358113';
 try{
  const result=await runMobile(keyword,{id,name:null});
  console.log('MOBILE_OBSERVER '+JSON.stringify({
   status:result.status,
   rank:result.rank??null,
   rankApproximate:result.rankApproximate??null,
   observedCount:result.observedCount??0,
   scope:result.scope,
   source:result.source,
   diagnostics:result.diagnostics||null
  }));
 }catch(error){
  console.log('MOBILE_OBSERVER_RUNTIME '+String(error?.message||error).slice(0,360));
 }
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const urls=[
   'https://m.place.naver.com/restaurant/list?where=m&entry=pll&query='+encodeURIComponent(keyword),
   'https://m.place.naver.com/place/list?where=m&entry=pll&query='+encodeURIComponent(keyword)
  ];
  for(const url of urls){
   try{
    const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:11000});
    await page.waitForTimeout(1800);
    const snapshot=await page.evaluate(()=>{
     const text=document.body?.innerText||'';
     return {
      title:document.title.slice(0,130),
      links:document.querySelectorAll('a[href*="/restaurant/"],a[href*="/place/"]').length,
      listItems:document.querySelectorAll('li').length,
      entries:document.querySelectorAll('[data-nlog-params]').length,
      targetInText:text.includes('퐝물회'),
      idInDom:document.documentElement?.outerHTML?.includes('2085358113')
     };
    });
    console.log('MOBILE_PAGE '+JSON.stringify({status:r?.status(),host:new URL(page.url()).hostname,path:new URL(page.url()).pathname, ...snapshot}));
   }catch(e){console.log('MOBILE_PAGE_ERROR '+String(e.message||e).slice(0,280))}
  }
 }finally{await browser.close()}
})().catch(e=>{console.log('MOBILE_DIAGNOSTIC_ERROR '+String(e.message||e).slice(0,280));process.exitCode=0});
