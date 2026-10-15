'use strict';
const observer=require('./_place-observe');
const counters=new Map(),cache=new Map();
function throttle(ip){
 const now=Date.now();if(counters.size>1000){for(const [k,v] of counters)if(now-v.start>900000)counters.delete(k)}
 let record=counters.get(ip);
 if(!record||now-record.start>600000){record={start:now,count:0};counters.set(ip,record)}
 record.count++;
 return record.count>3;
}
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Robots-Tag','noindex');
 const method=String(req.method||'GET').toUpperCase();
 if(!['GET','POST'].includes(method))return res.status(405).json({status:'error',message:'GET 또는 POST만 허용합니다.'});
 const origin=req.headers?.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return res.status(403).json({status:'error',message:'허용되지 않은 출처입니다.'})}catch{return res.status(403).json({status:'error',message:'요청 출처를 확인해 주세요.'})}}
 const ip=String(req.headers?.['x-forwarded-for']||'unknown').split(',')[0].slice(0,100);
 if(throttle(ip))return res.status(429).json({status:'rate_limited',message:'서버 비용과 안정성을 위해 현재 10분당 3회만 자동 측정할 수 있습니다.'});
 let body=method==='GET'?req.query:req.body;
 if(typeof body==='string'){if(body.length>1200)return res.status(413).json({status:'error',message:'요청이 너무 깁니다.'});try{body=JSON.parse(body)}catch{return res.status(400).json({status:'error',message:'JSON 요청을 확인해 주세요.'})}}
 if(!body||typeof body!=='object'||Array.isArray(body))body={};
 const keyword=observer.validateKeyword(body.keyword);
 const id=observer.placeId(body.placeId||body.placeUrl||body.target);
 if(!keyword||!id)return res.status(400).json({status:'invalid',message:'2~60자 검색어와 네이버 플레이스 주소 또는 숫자 ID를 입력하세요.'});
 const key=keyword+'\n'+id,now=Date.now(),saved=cache.get(key);
 if(saved&&now-saved.time<180000)return res.status(200).json({...saved.data,cached:true});
 try{
  const result=await observer.run(keyword,id);
  if(result.status==='ranked'||result.status==='not_in_block')cache.set(key,{time:Date.now(),data:result});
  if(cache.size>250){for(const [k,v] of cache)if(Date.now()-v.time>180000)cache.delete(k)}
  return res.status(200).json(result);
 }catch(err){
  return res.status(200).json({status:'unavailable',rank:null,message:'브라우저 순위 측정이 완료되지 않았습니다. 현재 실행 환경이나 네이버 접속 상태를 확인해야 합니다.',errorType:err?.code==='MODULE_NOT_FOUND'?'browser_package_unavailable':'browser_runtime_or_network',source:'none'});
 }
};
