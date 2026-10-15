'use strict';
/**
 * Permission-gated NAVER Blog Search API observation; it is NOT a map rank or
 * the exact rank in consumer NAVER integrated search.
 */
const limits=new Map();
function parseTarget(input){
 const value=String(input||'').trim();
 if(value.length>550)throw Error('블로그 주소는 550자 이내로 입력하세요.');
 let url;try{url=new URL(value)}catch{throw Error('블로그 글 또는 블로그 주소를 입력해 주세요.')}
 if(url.protocol!=='https:'||url.username||url.password||!['blog.naver.com','m.blog.naver.com'].includes(url.hostname.toLowerCase()))throw Error('네이버 블로그 HTTPS 주소만 사용할 수 있습니다.');
 const path=url.pathname.split('/').filter(Boolean);
 let id=path[0],post=path[1]||null;
 if(id==='PostView.naver'||id==='PostView.naver?'){id=url.searchParams.get('blogId');post=url.searchParams.get('logNo')}
 if(!/^[a-z0-9_-]{2,50}$/i.test(id||''))throw Error('블로그 ID를 확인할 수 없습니다.');
 if(post&&(!/^\d{4,30}$/.test(post)))post=null;
 return {blogId:id.toLowerCase(),postId:post,kind:post?'post':'blog',canonical:'https://blog.naver.com/'+id+(post?'/'+post:'')};
}
function rankOf(items,raw){
 const target=parseTarget(raw);
 let rank=null;
 for(let i=0;i<items.length;i++){
  let parsed;
  try{parsed=parseTarget(items[i]?.link||'')}catch{continue}
  const account=parsed.blogId===target.blogId;
  const matched=target.kind==='post'?account&&parsed.postId===target.postId:account;
  if(matched){rank=i+1;break}
 }
 return {rank,matchType:target.kind==='post'?'exact_post':'blog_owner',inspected:items.length};
}
function enabled(){
 return process.env.MOMENTUM_NAVER_BLOG_RANK_ENABLED==='true'&&process.env.MOMENTUM_NAVER_PUBLIC_DISPLAY_APPROVED==='true'&&!!process.env.NAVER_SEARCH_CLIENT_ID&&!!process.env.NAVER_SEARCH_CLIENT_SECRET;
}
function throttle(ip){
 const now=Date.now();if(limits.size>1600){for(const [k,v] of limits)if(now-v.since>90000)limits.delete(k)}
 let row=limits.get(ip);if(!row||now-row.since>60000){row={since:now,count:0};limits.set(ip,row)}return ++row.count>10;
}
async function getBlogRank(keyword,target){
 const uri=new URL('https://openapi.naver.com/v1/search/blog.json');
 uri.searchParams.set('query',keyword);uri.searchParams.set('display','100');uri.searchParams.set('start','1');uri.searchParams.set('sort','sim');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7500);
 try{
  const response=await fetch(uri,{signal:controller.signal,headers:{'X-Naver-Client-Id':process.env.NAVER_SEARCH_CLIENT_ID,'X-Naver-Client-Secret':process.env.NAVER_SEARCH_CLIENT_SECRET}});
  if(!response.ok)return {status:'api_error',message:'네이버 블로그 검색 API 응답 오류 ('+response.status+')'};
  const json=await response.json();
  const items=Array.isArray(json.items)?json.items:[];
  const m=rankOf(items,target);
  return {status:'measured',rank:m.rank,inspected:m.inspected,depth:100,matchType:m.matchType,source:'naver_blog_search_api',observedAt:new Date().toISOString(),message:m.rank?'블로그 검색 API 결과에서 확인한 위치입니다. 네이버 앱 통합검색 순위와는 다를 수 있습니다.':'검색 API 상위 '+m.inspected+'건에서 확인되지 않았습니다. 네이버 검색 미노출 확정이 아닙니다.'};
 }catch(e){return {status:'api_error',message:e.name==='AbortError'?'네이버 응답 시간 초과':'블로그 API 통신 오류'};}
 finally{clearTimeout(timer)}
}
async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'POST 방식만 지원합니다.'})}
 const origin=req.headers?.origin||'';
 if(origin){let host;try{host=new URL(origin).host}catch{return res.status(403).json({error:'출처 오류'})}if(host!==req.headers?.host)return res.status(403).json({error:'다른 출처의 요청은 허용하지 않습니다.'})}
 if(throttle(String(req.headers?.['x-forwarded-for']||'local').slice(0,90)))return res.status(429).json({error:'잠시 후 다시 측정해 주세요.'});
 let body=req.body;if(typeof body==='string'){if(body.length>3500)return res.status(413).json({error:'입력 크기 초과'});try{body=JSON.parse(body)}catch{return res.status(400).json({error:'JSON 입력 오류'})}}
 const keyword=String(body?.keyword||'').trim().slice(0,80),target=String(body?.target||'').trim().slice(0,550);
 if(keyword.length<2||keyword.length>70)return res.status(400).json({error:'검색 키워드를 2~70자로 입력하세요.'});
 try{parseTarget(target)}catch(e){return res.status(400).json({error:e.message})}
 if(!enabled())return res.status(200).json({status:'not_connected',rank:null,source:'none',message:'공식 블로그 검색 API의 인증·상업용 데이터 표시 승인이 아직 연결되지 않았습니다. 네이버 검색에서 실제 순위를 직접 확인해 기록할 수 있습니다.'});
 return res.status(200).json(await getBlogRank(keyword,target));
}
module.exports=handler;module.exports.parseTarget=parseTarget;module.exports.rankOf=rankOf;module.exports.enabled=enabled;
