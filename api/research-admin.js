'use strict';

// The original research console continues to handle requests with no 'op'.
// Browser-based admin ranking endpoints share this existing Chromium function,
// instead of bundling the Chromium binary into api/compact.js as well.
// Each server handler retains its own authorization, CSRF, and method checks.
const research=require('./_research-admin');
const rankingHandlers=Object.freeze({
 'admin-keyword-matrix':require('../server-handlers/admin-keyword-matrix'),
 'admin-competitor-compare':require('../server-handlers/admin-competitor-compare'),
 'admin-place-keyword-insights':require('../server-handlers/admin-place-keyword-insights'),
 'admin-rank-watches':require('../server-handlers/admin-rank-watches')
});
module.exports=function(req,res){
 const raw=req?.query?.op;
 if(raw===undefined||raw===null||raw==='')return research(req,res);
 const op=typeof raw==='string'?raw:'';
 const handler=Object.prototype.hasOwnProperty.call(rankingHandlers,op)?rankingHandlers[op]:null;
 if(!handler){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store');
  return res.status(404).json({error:'지원하지 않는 API 경로입니다.'});
 }
 return handler(req,res);
};
