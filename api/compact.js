'use strict';

/** Hobby-safe fixed handler dispatch. Each original handler still checks auth,
 * same-origin requirements, HTTP method and DB permissions individually.
 * No dynamic filesystem paths, external proxying or untrusted require().
 */
const handlers=Object.freeze({
 'admin-keyword-matrix':require('../server-handlers/admin-keyword-matrix'),
 'admin-competitor-compare':require('../server-handlers/admin-competitor-compare'),
 'admin-members':require('../server-handlers/admin-members'),
 'admin-place-keyword-insights':require('../server-handlers/admin-place-keyword-insights'),
 'member-auth':require('../server-handlers/member-auth'),
 'member-watches':require('../server-handlers/member-watches'),
 'member-history':require('../server-handlers/member-history'),
 'admin-rank-watches':require('../server-handlers/admin-rank-watches')
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
