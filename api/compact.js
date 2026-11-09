'use strict';

// Database/member administration uses a lightweight function. Browser-based
// ranking operations run on the existing Chromium-enabled research-admin
// function. Keep the original per-handler auth and method checks.
const handlers=Object.freeze({
 'admin-members':require('../server-handlers/admin-members'),
 'admin-connection':require('../server-handlers/admin-connection')
});
module.exports=async function(req,res){
 const raw=req?.query?.op;
 const op=typeof raw==='string'?raw:'';
 const handler=Object.prototype.hasOwnProperty.call(handlers,op)?handlers[op]:null;
 if(!handler){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store');
  return res.status(404).json({error:'지원하지 않는 API 경로입니다.'});
 }
 return handler(req,res);
};
