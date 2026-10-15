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
 const unique=new Map();
 for(const item of items){
  const id=String(item.id||''),rank=Number(item.rank);
  if(!/^\d{6,20}$/.test(id)||!Number.isInteger(rank)||rank<1||rank>500)continue;
  if(!unique.has(id))unique.set(id,{rank,name:String(item.name||'').slice(0,70)});
 }
 const matched=unique.get(requestedId);
 const ranks=[...unique.values()].map(x=>x.rank);
 const high=ranks.length?Math.max(...ranks):null;
 if(!unique.size)return {status:'no_place_block',rank:null,observedCount:0,maxObservedRank:null,message:'지도 업체 목록에서 순위 정보를 읽지 못했습니다.'};
 return {
  status:matched?'ranked':'not_in_block',
  rank:matched?matched.rank:null,
  observedCount:unique.size,
  maxObservedRank:high,
  matchedName:matched?.name||null,
  message:matched?'네이버지도 검색 결과에 표시된 업체 '+matched.rank+'위를 확인했습니다. 검색 지역·화면·시간에 따라 달라질 수 있습니다.':
   '네이버지도에서 현재 확인한 '+unique.size+'개 업체(표시 순위 '+high+'위까지) 중에 대상 ID가 없습니다. 전체 검색 미노출을 뜻하지 않습니다.'
 };
}
async function runMap(keyword,id){
 const playwright=require('playwright-core');
 const chromiumBinary=require('@sparticuz/chromium');
 const browser=await playwright.chromium.launch({args:chromiumBinary.args,executablePath:await chromiumBinary.executablePath(),headless:true,timeout:12000});
 try{
  const context=await browser.newContext({locale:'ko-KR',viewport:{width:1440,height:960},deviceScaleFactor:1});
  const page=await context.newPage();
  const url='https://map.naver.com/p/search/'+encodeURIComponent(keyword);
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:14500});
  if(!response||response.status()!==200||new URL(page.url()).hostname!=='map.naver.com')return {status:'blocked',rank:null,message:'네이버지도 검색 화면에 접속할 수 없습니다 (HTTP '+(response?.status()||'?')+').'};
  let frame=null;
  try{
   await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(el=>(el.getAttribute('src')||'').includes('pcmap.place.naver.com')),{timeout:10000});
  }catch{}
  for(let i=0;i<5;i++){
   frame=page.frames().find(f=>/^https:\/\/pcmap\.place\.naver\.com\//.test(f.url()));
   if(frame)break;
   await page.waitForTimeout(750);
  }
  if(!frame){
   const frameInfo=page.frames().map(f=>{try{return new URL(f.url()).hostname}catch{return 'about:blank'}}).filter(Boolean);
   const hasMapIframe=await page.locator('iframe#searchIframe').count().catch(()=>0);
   return {status:'no_place_block',rank:null,message:'네이버지도 업체 목록 화면을 확인하지 못했습니다. 브라우저 실행 환경 또는 로딩 상태 문제일 수 있습니다.',diagnostics:{iframePresent:!!hasMapIframe,frameHosts:frameInfo.slice(0,9)}};
  }
  try{await frame.locator('[data-nlog-params*="place_id"]').first().waitFor({state:'attached',timeout:5500})}catch{}
  let items=[],maxScroll=2;
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
    await frame.locator('li').last().scrollIntoViewIfNeeded({timeout:1000});
    await page.waitForTimeout(700);
   }catch{break}
  }
  return {...reduceMap(items,id),scope:'naver_map_pc_search_list_observed',source:'browser_observed',query:keyword,observedAt:new Date().toISOString(),disclaimer:'네이버지도 검색 화면에 실제 표시된 업체 순위이며 위치·기기·개인화·정렬조건의 영향을 받습니다. 확인하지 못한 하위 순위는 추측하지 않습니다.'};
 }finally{await browser.close().catch(()=>{})}
}

module.exports={placeId,validateKeyword,reduceResult,reduceMap,run,runMap};
