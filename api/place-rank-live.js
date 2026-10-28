'use strict';
const observer=require('./_place-observe');
const {controller}=require('./_rank-live-control');
const {sharedMeasure}=require('./_rank-live-shared');
const dailyQuota=require('./_public-rank-quota');
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Robots-Tag','noindex');
 const method=String(req.method||'GET').toUpperCase();
 if(!['GET','POST'].includes(method))return res.status(405).json({status:'error',message:'GET 또는 POST만 허용합니다.'});
 const origin=req.headers?.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)return res.status(403).json({status:'error',message:'허용되지 않은 출처입니다.'})}catch{return res.status(403).json({status:'error',message:'요청 출처를 확인해 주세요.'})}}
 let body=method==='GET'?req.query:req.body;
 if(typeof body==='string'){if(body.length>1200)return res.status(413).json({status:'error',message:'요청이 너무 깁니다.'});try{body=JSON.parse(body)}catch{return res.status(400).json({status:'error',message:'JSON 요청을 확인해 주세요.'})}}
 if(!body||typeof body!=='object'||Array.isArray(body))body={};
 const anonymous=dailyQuota.check(req);
 if(!anonymous.allowed){
  if(anonymous.retryAfterSeconds)res.setHeader('Retry-After',String(anonymous.retryAfterSeconds));
  return res.status(anonymous.status).json({status:anonymous.reason,message:anonymous.message,
   dailyLimit:1,resetAt:anonymous.resetAt||null,retryAfterSeconds:anonymous.retryAfterSeconds||null});
 }
 const keyword=observer.validateKeyword(body.keyword);
 const scope=body.scope==='mobile'?'mobile':body.scope==='map'?'map':'integrated';
 const targetValue=body.placeId||body.placeUrl||body.target||body.name;
 const mobileTarget=scope==='mobile'?observer.mobileTarget(targetValue):null;
 const id=observer.placeId(targetValue);
 if(!keyword||(scope==='mobile'?!mobileTarget:!id))return res.status(400).json({status:'invalid',message:'검색어와 업체명 또는 플레이스 ID/주소를 확인하세요.'});
 const key=scope+'\n'+keyword+'\n'+(id||observer.normalizeBusinessName(mobileTarget?.name));
 const ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'unknown').split(',')[0].slice(0,100);
 const outcome=await controller.handle({key,ip,measure:()=>sharedMeasure({key,scope,ip,measure:()=>scope==='mobile'?
  observer.runMobile(keyword,mobileTarget):scope==='map'?observer.runMap(keyword,id):observer.run(keyword,id)})});
 if(outcome.data?.retryAfterSeconds&&outcome.code!==200)res.setHeader('Retry-After',String(outcome.data.retryAfterSeconds));
 const observed=outcome.code===200&&['ranked','not_in_block'].includes(outcome.data?.status);
 if(observed&&!anonymous.member){
  dailyQuota.consume(res);
  return res.status(outcome.code).json({...outcome.data,anonymousDailyLimit:1,
   anonymousRemaining:0,anonymousResetAt:new Date(dailyQuota._test.nextReset()).toISOString()});
 }
 return res.status(outcome.code).json(outcome.data);
};
