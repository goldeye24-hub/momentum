'use strict';
/** Measures ONLY positions in a rendered Naver PC integrated-search Place block.
 * A block position is not a rank in the 300-result Map list.
 * No authentication tricks, CAPTCHA bypass, or third-party reselling.
 */
function placeId(input){
 const raw=String(input||'').trim();
 if(/^\d{6,20}$/.test(raw))return raw;
 let u;try{u=new URL(raw)}catch{return null}
 if(u.protocol!=='https:'||u.username||u.password||!(u.hostname==='naver.com'||u.hostname.endsWith('.naver.com')))return null;
 const m=u.pathname.match(/\/(?:entry\/)?place\/(\d{6,20})(?:\/|$)/);
 return m?m[1]:null;
}
function validateKeyword(input){
 const v=String(input||'').normalize('NFKC').trim().replace(/\s+/g,' ');
 return v.length>=2&&v.length<=60&&!/[\u0000-\u001f<>]/.test(v)?v:null;
}
function reduceResult(items,requestedId){
 if(!Array.isArray(items)||items.length===0)return {status:'no_place_block',rank:null,observedCount:0,adExcludedRank:null,message:'이 검색 화면에서 플레이스 결과 목록을 확인하지 못했습니다. 검색 결과가 없다는 의미는 아닙니다.'};
 const seen=new Set(),list=[];
 for(const item of items){
  const id=String(item.id||'');
  if(!/^\d{6,20}$/.test(id)||seen.has(id))continue;
  seen.add(id);list.push({id,ad:item.ad===true,name:String(item.name||'').slice(0,70)});
 }
 if(list.length===0)return {status:'no_place_block',rank:null,observedCount:0,adExcludedRank:null,message:'결과 항목에 플레이스 ID를 찾지 못했습니다.'};
 const ix=list.findIndex(x=>x.id===requestedId),matched=ix>=0?list[ix]:null;
 // The card's "광고" badge is observed, but absence of a badge does not certify organic status.
 const adExcludedRank=matched&&!matched.ad?list.slice(0,ix+1).filter(x=>!x.ad).length:null;
 return {status:ix>=0?'ranked':'not_in_block',rank:ix>=0?ix+1:null,
  observedCount:list.length,matchedName:matched?.name||null,adExcludedRank,
  adConfidence:'card_text_marker_only',adMarkedCount:list.filter(x=>x.ad).length,
  message:ix>=0?'네이버 PC 통합검색의 플레이스 결과 블록에서 '+(ix+1)+'번째 표시 항목으로 확인했습니다. 광고 표시 여부와 지도 검색 순위는 별개입니다.':
    '이 검색 화면에서 확인한 '+list.length+'개 플레이스 항목에는 해당 ID가 없습니다. 전체 지도 검색에서 미노출됐다는 뜻은 아닙니다.'};
}
async function run(keyword,id){
 const playwright=require('playwright-core');
 const chromiumBinary=require('@sparticuz/chromium');
 const browser=await playwright.chromium.launch({
  args:chromiumBinary.args,
  executablePath:await chromiumBinary.executablePath(),
  headless:true,timeout:12000
 });
 try{
  const context=await browser.newContext({locale:'ko-KR',viewport:{width:1440,height:960},deviceScaleFactor:1});
  const page=await context.newPage();
  const url='https://search.naver.com/search.naver?'+new URLSearchParams({query:keyword}).toString();
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:14000});
  if(!response||response.status()!==200||new URL(page.url()).hostname!=='search.naver.com')return {status:'blocked',rank:null,message:'네이버 검색 페이지에 정상 접속하지 못했습니다. HTTP '+(response?.status()||'?')};
  await page.locator('div[class*="place"] li a[href*="/place/"]').first().waitFor({state:'attached',timeout:4300}).catch(()=>{});
  const items=await page.evaluate(()=>{
   const results=[];
   for(const li of document.querySelectorAll('div[class*="place"] li')){
    const link=[...li.querySelectorAll('a[href*="/place/"]')].find(a=>/\/place\/\d{6,20}/.test(a.getAttribute('href')||''));
    if(!link)continue;
    const id=(link.getAttribute('href')||'').match(/\/place\/(\d{6,20})(?:\/|[?#]|$)/)?.[1];if(!id)continue;
    const ad=[...li.querySelectorAll('*')].some(el=>el.children.length===0&&el.textContent?.trim()==='광고');
    const text=String(li.innerText||'').trim();
    results.push({id,ad,name:text.split('\n').find(x=>x.trim()&&x.trim()!=='광고')||''});
   }
   return results;
  });
  return {...reduceResult(items,id),scope:'naver_pc_integrated_search_place_block',
   observedAt:new Date().toISOString(),source:'browser_observed',query:keyword,
   disclaimer:'통합검색 플레이스 블록의 표시 위치이며 네이버지도 전체 순위가 아닙니다. 지역·개인화·기기에 따라 결과는 달라질 수 있습니다.'};
 }finally{await browser.close().catch(()=>{})}
}

function reduceMap(items,requestedId){
 if(!Array.isArray(items)||items.length===0)return {status:'no_place_block',rank:null,observedCount:0,maxObservedRank:null,message:'네이버지도에서 업체 목록을 읽지 못했습니다. 검색 결과가 없다는 뜻은 아닙니다.'};
 const seen=new Set(),ordered=[];
 for(const item of items){
  const id=String(item.id||''),originalRank=Number(item.rank);
  if(!/^\d{6,20}$/.test(id)||!Number.isInteger(originalRank)||originalRank<1||originalRank>500||seen.has(id))continue;
  seen.add(id);ordered.push({id,originalRank,name:String(item.name||'').slice(0,70)});
 }
 if(!ordered.length)return {status:'no_place_block',rank:null,observedCount:0,maxObservedRank:null,message:'지도 업체 목록에서 순위 정보를 읽지 못했습니다.'};
 // The telemetry rank field can restart from 1 on each newly loaded results page.
 // Keep the exact first-page value; later values are page-order derived estimates.
 let offset=0,previous=0;
 ordered.forEach((row,index)=>{
  if(index>0&&row.originalRank<previous&&previous>=8&&row.originalRank<=3)offset+=10;
  row.rank=offset?Math.max(index+1,offset+row.originalRank):row.originalRank;
  row.rankBasis=offset?'estimated_from_loaded_page_order':'visible_provider_rank';
  previous=row.originalRank;
 });
 const found=ordered.find(x=>x.id===requestedId);
 const high=Math.max(...ordered.map(x=>x.rank)),approx=found?.rankBasis==='estimated_from_loaded_page_order';
 return {status:found?'ranked':'not_in_block',rank:found?.rank??null,observedCount:ordered.length,maxObservedRank:high,matchedName:found?.name||null,
  rankBasis:found?.rankBasis||null,rankApproximate:!!approx,
  message:found?(approx?'네이버지도에서 순서상 약 '+found.rank+'번째 항목으로 관측했습니다. 10위 이후는 결과 페이지 순서를 이용한 추정치입니다.':'네이버지도에 표시된 업체 '+found.rank+'위를 확인했습니다. 지역·기기·검색 설정에 따라 달라집니다.'):
   '네이버지도에서 현재 확인한 '+ordered.length+'개 업체(약 '+high+'위 범위) 중에 대상 ID가 없습니다. 하위 순위나 검색 미노출을 뜻하지 않습니다.'};
}
async function runMap(keyword,id){
 const playwright=require('playwright-core');
 const chromiumBinary=require('@sparticuz/chromium');
 const browser=await playwright.chromium.launch({args:chromiumBinary.args,executablePath:await chromiumBinary.executablePath(),headless:true,timeout:12000});
 try{
  const context=await browser.newContext({locale:'ko-KR',viewport:{width:1440,height:960},deviceScaleFactor:1});
  const page=await context.newPage();
  // Public PC Map list URL also works as a directly rendered page (without Map shell).
  // Prefer it to avoid iframe hydration races. Fall back to the real map shell.
  let frame=null;
  try{
   const direct='https://pcmap.place.naver.com/place/list?'+new URLSearchParams({query:keyword}).toString();
   const r=await page.goto(direct,{waitUntil:'domcontentloaded',timeout:12500});
   if(r?.status()===200){
    await page.locator('li [data-nlog-area="mpl_vsl.result"][data-nlog-params]').first().waitFor({state:'attached',timeout:4200}).catch(()=>{});
    if(await page.locator('li [data-nlog-area="mpl_vsl.result"][data-nlog-params]').count())frame=page.mainFrame();
   }
  }catch{}
  if(!frame){
   const url='https://map.naver.com/p/search/'+encodeURIComponent(keyword);
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:14500});
   if(!response||response.status()!==200||new URL(page.url()).hostname!=='map.naver.com')return {status:'blocked',rank:null,message:'네이버지도 검색 화면에 접속할 수 없습니다 (HTTP '+(response?.status()||'?')+').'};
  }
  if(!frame){
   try{
    await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(el=>(el.getAttribute('src')||'').includes('pcmap.place.naver.com')),{timeout:10000});
   }catch{}
   for(let i=0;i<5;i++){
    frame=page.frames().find(f=>/^https:\/\/pcmap\.place\.naver\.com\//.test(f.url()));
    if(frame)break;
    await page.waitForTimeout(750);
   }
  }
  if(!frame){
   const frameInfo=page.frames().map(f=>{try{return new URL(f.url()).hostname}catch{return 'about:blank'}}).filter(Boolean);
   const hasMapIframe=await page.locator('iframe#searchIframe').count().catch(()=>0);
   return {status:'no_place_block',rank:null,message:'네이버지도 업체 목록 화면을 확인하지 못했습니다. 브라우저 실행 환경 또는 로딩 상태 문제일 수 있습니다.',diagnostics:{iframePresent:!!hasMapIframe,frameHosts:frameInfo.slice(0,9)}};
  }
  try{await frame.locator('[data-nlog-params*="place_id"]').first().waitFor({state:'attached',timeout:5500})}catch{}
  let items=[],maxScroll=5;
  for(let i=0;i<=maxScroll;i++){
   const now=await frame.evaluate(()=>{
    const rows=[];
    for(const li of document.querySelectorAll('li')){
     const el=li.querySelector('[data-nlog-area="mpl_vsl.result"][data-nlog-params]');
     if(!el)continue;
     let meta;try{meta=JSON.parse(el.getAttribute('data-nlog-params'))}catch{continue}
     const id=String(meta?.place_id||''),rank=Number(meta?.rank);
     if(!/^\d{6,20}$/.test(id)||!Number.isInteger(rank)||rank<1)continue;
     const name=String(el.querySelector('span')?.textContent||el.textContent||'').trim().slice(0,70);
     rows.push({id,rank,name});
    }
    return rows;
   });
   const seen=new Set(items.map(x=>x.id));for(const x of now)if(!seen.has(x.id)){seen.add(x.id);items.push(x)}
   if(items.some(x=>x.id===id)||i===maxScroll||!now.length)break;
   try{
    const moved=await frame.evaluate(()=>{
     const first=document.querySelector('li [data-nlog-area="mpl_vsl.result"][data-nlog-params]');
     let n=first?.closest('li');
     for(let i=0;n&&i<12;i++,n=n.parentElement){
      const st=getComputedStyle(n);
      if(n.scrollHeight>n.clientHeight+140&&(st.overflowY==='auto'||st.overflowY==='scroll')){n.scrollTop=n.scrollHeight;return true}
     }
     return false;
    });
    if(!moved)break;
    await page.waitForTimeout(850);
   }catch{break}
  }
  return {...reduceMap(items,id),scope:'naver_map_pc_search_list_observed',source:'browser_observed',query:keyword,observedAt:new Date().toISOString(),disclaimer:'네이버지도 검색 화면에 실제 표시된 업체 순위이며 위치·기기·개인화·정렬조건의 영향을 받습니다. 확인하지 못한 하위 순위는 추측하지 않습니다.'};
 }finally{await browser.close().catch(()=>{})}
}


/**
 * Mobile Place list observation (not PC Map and not the small PC Place block).
 * No provider API or rank is inferred. A DOM-derived position is approximate,
 * because ad cards / deferred elements can affect the observed list.
 */
function normalizeBusinessName(value){
 return String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
}
function mobileTarget(input){
 const id=placeId(input);
 if(id)return {id,name:null};
 const name=String(input||'').normalize('NFKC').trim().replace(/\s+/g,' ');
 if(name.length<2||name.length>70||/[/<>?#=&]/.test(name))return null;
 return {id:null,name};
}
function reduceMobile(items,target){
 if(!Array.isArray(items)||items.length===0)return {status:'no_place_block',rank:null,observedCount:0,message:'모바일 플레이스 업체 목록을 읽지 못했습니다. 순위 밖이라는 뜻은 아닙니다.'};
 const seen=new Set(),list=[];
 for(const raw of items){
  const id=String(raw.id||'');
  if(!/^\d{6,20}$/.test(id)||seen.has(id))continue;
  seen.add(id);
  const providerRank=Number(raw.rank);
  const trustworthy=Number.isInteger(providerRank)&&providerRank>=1&&providerRank<=500;
  list.push({id,name:String(raw.name||'').trim().slice(0,70),rank:trustworthy?providerRank:list.length+1,approximate:!trustworthy});
 }
 if(!list.length)return {status:'no_place_block',rank:null,observedCount:0,message:'모바일 플레이스 업체 ID가 확인되지 않았습니다.'};
 const matches=target.id?list.filter(x=>x.id===target.id):list.filter(x=>normalizeBusinessName(x.name)===normalizeBusinessName(target.name));
 if(matches.length>1)return {status:'ambiguous',rank:null,observedCount:list.length,message:'같은 업체명이 여러 곳에서 확인되었습니다. 플레이스 ID로 다시 측정해 주세요.'};
 const item=matches[0];
 return {status:item?'ranked':'not_in_block',rank:item?.rank??null,rankApproximate:item?.approximate??false,
  rankBasis:item?(item.approximate?'visible_mobile_list_order_estimate':'mobile_list_provider_rank'):null,
  matchedName:item?.name||null,matchedId:item?.id||null,observedCount:list.length,
  maxObservedRank:Math.max(...list.map(x=>x.rank)),
  message:item?(item.approximate?'네이버 모바일 플레이스 목록에서 약 '+item.rank+'번째로 관측했습니다. 광고 및 동적 로딩으로 실제 일반 순위와 다를 수 있습니다.':'네이버 모바일 플레이스 목록에 표시된 '+item.rank+'위를 확인했습니다.'):
  '관측된 모바일 플레이스 업체 '+list.length+'곳에서 대상을 찾지 못했습니다. 더 아래 순위 또는 검색 미노출이라는 뜻은 아닙니다.'};
}
async function runMobile(keyword,target){
 const playwright=require('playwright-core'),chromiumBinary=require('@sparticuz/chromium');
 const browser=await playwright.chromium.launch({
  args:chromiumBinary.args,executablePath:await chromiumBinary.executablePath(),headless:true,timeout:12000
 });
 try{
  const context=await browser.newContext({
   locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,
   userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });
  const page=await context.newPage();
  const query=new URLSearchParams({where:'m',query:keyword,entry:'pll'}).toString();
  const candidates=['https://m.place.naver.com/restaurant/list?'+query,'https://m.place.naver.com/place/list?'+query];
  let rows=[],usedUrl='',httpStatus=null;
  for(const url of candidates){
   try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:11000});
    const loaded=new URL(page.url());
    httpStatus=response?.status()??null;
    if(httpStatus!==200||loaded.hostname!=='m.place.naver.com')continue;
    usedUrl=page.url();
    await page.locator('li a[href*="/restaurant/"],li a[href*="/place/"],li [data-nlog-params]').first().waitFor({state:'attached',timeout:2800}).catch(()=>{});
    const ids=new Set();
    for(let pageIndex=0;pageIndex<5;pageIndex++){
     const items=await page.evaluate(()=>{
      const found=[];
      for(const li of document.querySelectorAll('li')){
       const info=li.querySelector('[data-nlog-params]'),anchor=li.querySelector('a[href*="/restaurant/"],a[href*="/place/"],a[href*="/hairshop/"],a[href*="/accommodation/"]');
       let meta={};try{if(info)meta=JSON.parse(info.getAttribute('data-nlog-params')||'{}')}catch{}
       const rawHref=anchor?.getAttribute('href')||'';
       const id=String(meta.place_id||rawHref.match(/\/(?:restaurant|place|hairshop|accommodation)\/(\d{6,20})(?:\/|[?#]|$)/)?.[1]||'');
       if(!/^\d{6,20}$/.test(id))continue;
       const providerRank=meta.rank===undefined?null:Number(meta.rank);
       const name=String(li.querySelector('h3,strong,[class*="name"]')?.textContent||anchor?.textContent||'').trim().replace(/\s+/g,' ').slice(0,70);
       found.push({id,name,rank:Number.isInteger(providerRank)&&providerRank>0?providerRank:null});
      }
      return found;
     });
     for(const x of items)if(!ids.has(x.id)){ids.add(x.id);rows.push(x)}
     if(rows.some(x=>x.id===target.id||(target.name&&normalizeBusinessName(x.name)===normalizeBusinessName(target.name)))||rows.length>=100)break;
     await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
     await page.waitForTimeout(450);
    }
    if(rows.length)break;
   }catch{continue}
  }
  if(!rows.length)return {status:'no_place_block',rank:null,observedCount:0,scope:'naver_mobile_place_list',query:keyword,
   observedAt:new Date().toISOString(),source:'none',message:'모바일 플레이스 목록을 자동으로 읽지 못했습니다. 네이버 페이지 구조나 네트워크 차단 여부를 확인해야 합니다.',diagnostics:{httpStatus,host:usedUrl?new URL(usedUrl).hostname:null}};
  return {...reduceMobile(rows,target),scope:'naver_mobile_place_list',query:keyword,observedAt:new Date().toISOString(),source:'browser_observed',
   disclaimer:'모바일 화면 390px 기준 관측입니다. 위치·로그인·광고·동적 로딩에 따라 순위가 달라질 수 있으며, 확인 범위를 넘어선 순위는 추측하지 않습니다.'};
 }finally{await browser.close().catch(()=>{})}
}

module.exports={placeId,validateKeyword,reduceResult,reduceMap,run,runMap,normalizeBusinessName,mobileTarget,reduceMobile,runMobile};
