'use strict';
/**
 * Mobile Place search observation, independent of legacy DB and map ranking.
 * A DOM observation is not a certified or geographic-neutral organic ranking.
 */
const chromium=require('@sparticuz/chromium');
const playwright=require('playwright-core');
const crypto=require('node:crypto');
const SOURCE='https://m.place.naver.com';
const MAX_RESULTS=300, MAX_WALL_MS=44000;
const active=new Map();
let sourceBlockedUntil=0, lastStarted=0;

const clean=x=>String(x??'').normalize('NFKC').trim().replace(/\s+/g,' ');
function targetFrom(v){
 const s=clean(v);
 if(/^\d{6,20}$/.test(s))return {id:s};
 if(s.length>450)return null;
 try{
  const u=new URL(s);
  if(u.protocol!=='https:'||!['naver.com','m.place.naver.com','pcmap.place.naver.com','map.naver.com','m.map.naver.com'].includes(u.hostname) && !u.hostname.endsWith('.naver.com'))return null;
  const id=u.pathname.match(/\/(?:entry\/)?(?:restaurant|place|hairshop|accommodation)\/(\d{6,20})(?:\/|$)/)?.[1]||
    u.searchParams.get('placeId')||u.searchParams.get('id');
  return id&&/^\d{6,20}$/.test(id)?{id}:null;
 }catch{
  if(s.length<2||s.length>70||/[<>/\\?&#=]/.test(s))return null;
  return {name:s};
 }
}
function validQuery(v){const x=clean(v);return x.length>=2&&x.length<=60&&!/[\x00-\x1f<>]/.test(x)?x:null}
function normalizeName(s){return clean(s).replace(/[^\p{L}\p{N}]/gu,'').toLowerCase()}
function listType(q){return /(맛집|음식점|식당|횟집|한식|일식|초밥|고깃집|대게|랍스터|카페|국밥|중식|마라탕|배달|베이커리|술집|삼겹살|물회)/.test(q)?'restaurant':'place'}
function sourceUrl(q){return SOURCE+'/'+listType(q)+'/list?'+new URLSearchParams({where:'m',query:q,entry:'pll'}).toString()}
function evaluate(rows,target,diagnostic={}){
 const found=target?.id?rows.find(x=>x.id===target.id):rows.find(x=>normalizeName(x.name)===normalizeName(target?.name));
 const similar=target?.name?rows.filter(x=>normalizeName(x.name)===normalizeName(target.name)):[];
 const order=found?rows.findIndex(x=>x.id===found.id)+1:null;
 const allSequential=rows.length>0&&rows.every((r,i)=>r.providerRank===i+1);
 const mismatch=rows.reduce((n,r,i)=>n+(r.providerRank!==null&&r.providerRank!==i+1?1:0),0);
 const status=similar.length>1?'ambiguous':found?'found':'not_found_in_sample';
 return {status,observedPosition:status==='found'?order:null,
   confidence:status==='found'?(allSequential?'observed_sequential':'estimated_list_order'):'unverified',
   matched:status==='found'?{id:found.id,name:found.name,providerRank:found.providerRank,ad:found.ad}:null,
   observedCount:rows.length,providerRankDisagreements:mismatch,complete:false,
   topResults:rows.slice(0,15).map(x=>({observedPosition:rows.indexOf(x)+1,id:x.id,name:x.name,providerRank:x.providerRank,ad:x.ad})),
   diagnostics:diagnostic,
   explanation:status==='found'?'대상이 수집 목록에서 확인됐습니다. 노출 위치는 수집한 목록의 순서이며, 광고 제외 공식 순위가 아닙니다.':
     status==='ambiguous'?'동일 상호가 여럿 발견됐습니다. 플레이스 ID로 다시 조회해 주세요.':
     '수집한 범위 안에서 대상을 찾지 못했습니다. 순위 밖 또는 미노출을 의미하지 않습니다.'};
}
async function scan(keyword,target){
 const started=Date.now(),url=sourceUrl(keyword),diagnostic={route:listType(keyword),scrolls:0,stopReason:'not_started',httpStatus:null,itemsSeen:0,elapsedMs:0};
 const seen=new Map();
 let browser;
 try{
  browser=await playwright.chromium.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true,timeout:12000});
  const context=await browser.newContext({locale:'ko-KR',timezoneId:'Asia/Seoul',
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
    userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'});
  const page=await context.newPage();
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:14000});
  diagnostic.httpStatus=response?.status()||null;
  if(diagnostic.httpStatus===403||diagnostic.httpStatus===429){
   const retry=response?await response.headerValue('retry-after').catch(()=>null):null;
   return {status:'provider_blocked',observedCount:0,diagnostics:diagnostic,retryAfterSeconds:/^\d+$/.test(String(retry||''))?Number(retry):null};
  }
  if(diagnostic.httpStatus!==200||new URL(page.url()).hostname!=='m.place.naver.com')
   return {status:'navigation_failed',observedCount:0,diagnostics:diagnostic};
  diagnostic.resolvedUrl=page.url();
  // Allow the Naver client to finish hydration. A 200 HTML shell does not mean
  // business results have arrived; wait for visible card link evidence first.
  await page.waitForFunction(()=>{
    const anchors=document.querySelectorAll('a[href*="/restaurant/"],a[href*="/place/"]');
    return [...anchors].some(a=>/\/(?:restaurant|place)\/\d{6,20}(?:[/?#]|$)/.test(a.getAttribute('href')||''));
  },undefined,{timeout:8500}).catch(()=>{});
  diagnostic.initialDOM=await page.evaluate(()=>({
   documentReady:document.readyState,
   title:String(document.title||'').slice(0,100),
   resultLis:document.querySelectorAll('li.UEzoS').length,
   cardAnchors:document.querySelectorAll('li.UEzoS a.vEZDX[href*="/restaurant/"],li.UEzoS a.vEZDX[href*="/place/"]').length,
   businessLinks:document.querySelectorAll('a[href*="/restaurant/"],a[href*="/place/"]').length,
   resultMarkers:document.querySelectorAll('[data-nlog-area="mpl_vsl.result"]').length,
   renderedTextLength:(document.body?.innerText||'').length,
   iframeCount:document.querySelectorAll('iframe').length
  }));
  let unchanged=0;
  for(let step=0;step<55;step++){
   diagnostic.scrolls=step;
   if(Date.now()-started>=MAX_WALL_MS){diagnostic.stopReason='time_budget';break}
   const visible=await page.evaluate(()=>{
    // Selector-independent collection of real business detail links. Naver has
    // put 'vEZDX' on <li>, not on <a>, in some render modes.
    const links=[...document.querySelectorAll('a[href*="/restaurant/"],a[href*="/place/"],a[href*="/hairshop/"],a[href*="/accommodation/"]')];
    const items=new Map();
    const groups=new Map();
    const excluded=/^(?:주간 인기 많은 메뉴|주간 인기|예약|톡톡|쿠폰|메뉴|메뉴판|사진|리뷰|주소|찾아가기|길찾기|저장|주문|공유|광고|더보기|전화|네이버페이|이름 미확인)$/;
    const pickName=(anchor,card)=>{
      const selectors=['strong.tit_place','strong.YwYLL','.YwYLL','.place_bluelink','[class*="tit_place"]','a.link_place strong','h3','a[href*="/restaurant/"] > strong'];
      for(const root of [anchor,card]){
       if(!root)continue;
       for(const q of selectors){
        const node=root.querySelector(q);
        if(node){
         const name=String(node.textContent||'').replace(/\s+/g,' ').trim().slice(0,100);
         if(name.length>=2&&name.length<=70&&!excluded.test(name))return name;
        }
       }
      }
      const text=String(anchor.innerText||anchor.textContent||'');
      const parts=text.split(/\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
      return parts.find(x=>x.length>=2&&x.length<=65&&!excluded.test(x)&&!/^(?:사진 \d+|리뷰 \d+|영업|영업중|영업 전)/.test(x))||'';
    };
    let validLinks=0,withName=0;
    for(const anchor of links){
      const href=anchor.getAttribute('href')||'';
      const id=href.match(/\/(?:restaurant|place|hairshop|accommodation)\/(\d{6,20})(?:\/|[?#]|$)/)?.[1];
      if(!id)continue;
      validLinks++;
      const li=anchor.closest('li');
      // Prefer the actual business card, but don't require hash-like classes.
      // Parent links in menu/related content with no store title are discarded.
      const mainCard=anchor.closest('li.UEzoS,li.vEZDX,li[class*="place"],.CHC5F')||li||anchor;
      const name=pickName(anchor,mainCard);
      if(!name)continue;
      withName++;
      const preferred=anchor.matches('a.link_place,li.UEzoS > a,li.vEZDX > a')||
        !!anchor.querySelector('strong.tit_place,.YwYLL,[class*="tit_place"]');
      const existing=items.get(id);
      const rankAttr=mainCard.querySelector?.('[data-nlog-area="mpl_vsl.result"][data-nlog-params]');
      let meta={};try{if(rankAttr)meta=JSON.parse(rankAttr.getAttribute('data-nlog-params')||'{}')}catch{}
      const pr=Number(meta.rank);
      const providerRank=(!meta.place_id||String(meta.place_id)===id)&&meta.rank!==undefined&&Number.isInteger(pr)&&pr>0?pr:null;
      const ad=[...(mainCard.querySelectorAll?.('span,em,small')||[])].some(n=>n.children.length===0&&n.textContent?.trim()==='광고');
      if(!existing){items.set(id,{id,name,providerRank,ad,preferred});}
      else if(preferred&&!existing.preferred){Object.assign(existing,{name,providerRank,ad,preferred})}
      // Ranking only: identify repeated business CARD siblings in a single list.
      // Other same-ID links outside the list are useful for detection, not rank.
      // A nested <li> from a menu is never promoted to a business card.
      const row=anchor.closest('li');
      const parent=row?.parentElement;
      if(row&&parent&&parent.matches('ul,ol,[role="list"]')&&name){
        let group=groups.get(parent);
        if(!group){group={rows:new Map(),primary:0,cls:String(parent.className||'').slice(0,90)};groups.set(parent,group)}
        if(!group.rows.has(id)){
          group.rows.set(id,{id,name,providerRank,ad});
          if(preferred)group.primary++;
        }
      }
    }
    const rankedGroups=[...groups.values()].map(g=>({
      ...g,size:g.rows.size,
      score:g.rows.size*3+g.primary+( /(?:lst_place|eDFz9|place_list)/.test(g.cls)?30:0)
    })).sort((a,b)=>b.score-a.score);
    // A broad repeated list (12+ stores) or explicitly named result container
    // is needed. Short recommendation carousels must not become a ranking.
    const chosen=rankedGroups.find(g=>
      g.size>=12||(g.size>=3&&/(?:lst_place|eDFz9|place_list)/.test(g.cls))
    )||null;
    return {rows:chosen?[...chosen.rows.values()]:[],
      rawEntries:[...items.values()].map(x=>({id:x.id,name:x.name})),
      rankListConfirmed:!!chosen,rankGroupSize:chosen?.size||0,
      rankedGroupCandidates:rankedGroups.slice(0,5).map(g=>({size:g.size,primary:g.primary,container:g.cls})),
      rawBusinessLinks:links.length,validBusinessLinks:validLinks,namedBusinessLinks:withName,
      liClassMatches:document.querySelectorAll('li.UEzoS').length};
   });
   diagnostic.validCardNodes=visible.rows.length;
   diagnostic.rankingList={confirmed:visible.rankListConfirmed,uniqueCards:visible.rankGroupSize,candidates:visible.rankedGroupCandidates};
   diagnostic.parsedLinks={raw:visible.rawBusinessLinks,valid:visible.validBusinessLinks,named:visible.namedBusinessLinks,liClassMatches:visible.liClassMatches};
   diagnostic.rawTargetLinkFound=!!(target.id?
    visible.rawEntries.some(x=>x.id===target.id):
    visible.rawEntries.some(x=>normalizeName(x.name)===normalizeName(target.name)));
   const before=seen.size;
   for(const r of visible.rows)if(!seen.has(r.id)){seen.set(r.id,r);if(seen.size>=MAX_RESULTS)break}
   diagnostic.itemsSeen=seen.size;
   const targetFound=target.id?seen.has(target.id):[...seen.values()].some(r=>normalizeName(r.name)===normalizeName(target.name));
   if(targetFound){diagnostic.stopReason='target_found';break}
   if(seen.size>=MAX_RESULTS){diagnostic.stopReason='sample_limit';break}
   if(!visible.rankListConfirmed&&step>=3&&visible.validBusinessLinks>0){
     diagnostic.stopReason='no_confirmed_rank_list';break;
   }
   unchanged=seen.size===before?unchanged+1:0;
   // Never claim that a stable viewport means no more search results.
   if(unchanged>=6){diagnostic.stopReason='no_new_rows_after_scroll';break}
   const movement=await page.evaluate(()=>{
    const cardNodes=[...document.querySelectorAll('a[href*="/restaurant/"],a[href*="/place/"]')]
      .filter(a=>/\/(?:restaurant|place)\/\d{6,20}(?:[/?#]|$)/.test(a.getAttribute('href')||''));
    const last=cardNodes.at(-1),scrollY=window.scrollY;
    for(let el=last;el&&el!==document.documentElement;el=el.parentElement){
     const css=getComputedStyle(el);
     if(el.scrollHeight>el.clientHeight+100&&/(scroll|auto)/.test(css.overflowY)){
      const old=el.scrollTop;
      el.scrollTop=Math.min(el.scrollHeight,el.scrollTop+Math.max(500,el.clientHeight*0.82));
      el.dispatchEvent(new Event('scroll',{bubbles:true}));
      return {mode:'nested_scroll',moved:el.scrollTop!==old};
     }
    }
    last?.scrollIntoView({block:'end',behavior:'instant'});
    window.scrollBy(0,Math.max(650,window.innerHeight*0.85));
    return {mode:'window_scroll',moved:window.scrollY!==scrollY};
   });
   diagnostic.scrollMethod=movement.mode;
   await page.waitForTimeout(step<3?700:530);
  }
  if(diagnostic.stopReason==='not_started')diagnostic.stopReason='max_scroll_steps';
  const rows=[...seen.values()];
  diagnostic.elapsedMs=Date.now()-started;
  if(rows.length===0){
   diagnostic.stopReason=diagnostic.rankingList?.confirmed?'no_place_cards_detected':'no_confirmed_rank_list';
   diagnostic.finalDOM=await page.evaluate(()=>({
    resultLis:document.querySelectorAll('li.UEzoS').length,
    primaryAnchors:document.querySelectorAll('a.vEZDX[href*="/restaurant/"],a.vEZDX[href*="/place/"]').length,
    businessLinks:document.querySelectorAll('a[href*="/restaurant/"],a[href*="/place/"]').length,
    resultMarkers:document.querySelectorAll('[data-nlog-area="mpl_vsl.result"]').length,
   listPlaceAnchors:document.querySelectorAll('a.link_place[href*="/restaurant/"],a.link_place[href*="/place/"]').length,
    renderedTextLength:(document.body?.innerText||'').length,
    title:String(document.title||'').slice(0,100),
    visibleChallenge:/(비정상적인 접근|보안 문자|자동화된 접근|서비스 이용이 제한|captcha)/i.test((document.body?.innerText||'').slice(0,900))
   }));
   const blocked=diagnostic.finalDOM.visibleChallenge;
   const linkFound=diagnostic.rawTargetLinkFound;
   return {status:blocked?'provider_blocked':linkFound?'found_without_rank':'rank_list_unavailable',
    observedPosition:null,observedCount:0,diagnostics:diagnostic,
    sourceUrl:url,observedAt:new Date().toISOString(),
    message:blocked?'네이버의 접근 제한 안내가 표시돼 측정을 중단했습니다.':
      linkFound?'업체 상세 링크는 확인됐지만 검색 결과 순서를 검증할 수 없어 순위를 표시하지 않습니다.':
      '실제 검색 결과 목록을 식별하지 못했습니다. 순위 미노출로 해석하면 안 됩니다.'};
  }
  return {...evaluate(rows,target,diagnostic),sourceUrl:url,observedAt:new Date().toISOString(),mode:'anonymous_mobile_browser'};
 }catch(err){
  diagnostic.elapsedMs=Date.now()-started;
  diagnostic.stopReason='browser_error';
  return {status:'runtime_error',observedCount:seen.size,diagnostics:diagnostic,
   errorType:err?.code==='MODULE_NOT_FOUND'?'browser_dependency_missing':err?.name==='TimeoutError'?'timeout':'browser_or_network_error'};
 }finally{if(browser)await browser.close().catch(()=>{})}
}

async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
 res.setHeader('X-Robots-Tag','noindex,nofollow');
 if(process.env.VERCEL_ENV==='production')return res.status(404).json({status:'not_available'});
 if(!['GET','POST'].includes(String(req.method||'').toUpperCase()))return res.status(405).json({status:'method_not_allowed'});
 if(req.headers?.origin){
  try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({status:'forbidden'})}
  catch{return res.status(403).json({status:'forbidden'})}
 }
 let body=req.method==='GET'?req.query:req.body;
 if(typeof body==='string'){try{if(body.length>1000)throw Error();body=JSON.parse(body)}catch{return res.status(400).json({status:'invalid_json'})}}
 const keyword=validQuery(body?.keyword),target=targetFrom(body?.placeId||body?.placeUrl||body?.target||'');
 if(!keyword||!target)return res.status(400).json({status:'invalid_input',message:'검색어(2~60자)와 업체명 또는 플레이스 숫자 ID를 입력하세요.'});
 const now=Date.now();
 if(sourceBlockedUntil>now)return res.status(503).json({status:'provider_cooldown',retryAfterSeconds:Math.ceil((sourceBlockedUntil-now)/1000),message:'네이버 요청 제한으로 신규 자동 검색을 중지했습니다.'});
 const key=crypto.createHash('sha256').update(keyword+'\n'+(target.id||normalizeName(target.name))).digest('hex');
 if(active.has(key))return res.status(200).json({...await active.get(key),requestDeduplicated:true});
 if(now-lastStarted<1200)return res.status(429).json({status:'local_cooldown',retryAfterSeconds:2,message:'동시 네이버 요청을 제한합니다.'});
 lastStarted=now;
 const pending=scan(keyword,target);
 active.set(key,pending);
 let result;
 try{result=await pending}finally{active.delete(key)}
 if(result.status==='provider_blocked'){
  sourceBlockedUntil=Date.now()+Math.max(3600000,Math.min(86400000,Number(result.retryAfterSeconds||0)*1000));
  return res.status(503).json({...result,message:'네이버에서 자동 요청을 제한했습니다. 재시도하지 않습니다.'});
 }
 if(['runtime_error','navigation_failed','extraction_failed','rank_list_unavailable'].includes(result.status))return res.status(502).json({...result,message:result.message||'네이버 모바일 플레이스 순위 목록을 식별하지 못했습니다.'});
 if(result.status==='found_without_rank')return res.status(200).json(result);
 return res.status(200).json(result);
}
module.exports=handler;
module.exports._test={targetFrom,validQuery,listType,evaluate,sourceUrl,normalizeName};

// Member-only research console can invoke the same real browser observer after
// verifying ownership server-side. Never trust browser-supplied ranks.
module.exports._scan=scan;
