'use strict';
const {analyse}=require('./_momentum-intel');
const recent=new Map();
/** Standalone independent analysis: no outside requests, no third-party data or credentials. */
module.exports=async function(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'POST 방식만 지원합니다.'})}
 let payload=req.body;
 if(typeof payload==='string'){
  if(payload.length>4096)return res.status(413).json({error:'입력한 내용이 너무 깁니다.'});
  try{payload=JSON.parse(payload)}catch{return res.status(400).json({error:'올바른 JSON이 아닙니다.'})}
 }
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return res.status(400).json({error:'상호명과 플레이스 URL이 필요합니다.'});
 const ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').slice(0,90).split(',')[0];
 const now=Date.now(),entry=recent.get(ip)||{first:now,count:0};
 if(now-entry.first>60*1000){entry.first=now;entry.count=0}
 entry.count++;recent.set(ip,entry);
 if(recent.size>2500)recent.clear();
 if(entry.count>30)return res.status(429).json({error:'잠시 후 다시 시도해 주세요.'});
 try{return res.status(200).json(analyse({name:payload.name,placeUrl:payload.placeUrl}))}
 catch(err){return res.status(err.status===400?400:500).json({error:err.status===400?err.message:'자체 분석을 처리할 수 없습니다.'})}
};
