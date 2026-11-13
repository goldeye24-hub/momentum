'use strict';
// Stateless, read-only Model Context Protocol HTTP adapter.
const oauth=require('./_mcp-oauth-core');
const editorial=require('./editorial-keywords');
const TOOL='naver_monthly_keyword_volume';
const tool={
 name:TOOL,title:'네이버 월간 검색량 실측',description:'실제 NAVER Search Ads API에서 최대 4개 한국어 검색어의 최근 월간 PC·모바일 조회수를 확인합니다. 10 미만은 0이 아니라 10 미만으로 표시합니다. 실측 실패를 추정치로 대체하지 않습니다. 읽기 전용입니다.',
 inputSchema:{type:'object',properties:{keywords:{type:'array',items:{type:'string',minLength:2,maxLength:30},minItems:1,maxItems:4,description:'실측할 검색어 목록 (최대 4개)'}},required:['keywords'],additionalProperties:false},
 annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}
};
function setHeaders(res){
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 res.setHeader('X-Content-Type-Options','nosniff');
}
function rpc(res,id,result){return res.status(200).json({jsonrpc:'2.0',id,result})}
function rpcError(res,id,code,message){return res.status(200).json({jsonrpc:'2.0',id,error:{code,message}})}
function cleanKeyword(s){
 return String(s??'').normalize('NFKC').trim().replace(/\s+/g,' ');
}
async function queryExistingReadOnly(keyword){
 const envToken=String(process.env.MOMENTUM_EDITORIAL_KEYWORD_ACCESS_TOKEN||'');
 if(envToken.length<32)return {status:'error',keyword,message:'비공개 키워드 조회 설정 미확인'};
 let status=200,payload=null;
 const fakeRes={
  setHeader:()=>{},status(n){status=n;return this},
  json(data){payload=data;return this},
  end(){return this}
 };
 const fakeReq={method:'GET',query:{format:'json',keyword,access:envToken},headers:{'x-real-ip':'chatgpt-mcp'}};
 try{await editorial(fakeReq,fakeRes)}catch{return {status:'error',keyword,message:'검색량 조회 처리 오류'}}
 if(status!==200||!payload||payload.status!=='ok')return {status:'error',keyword,message:payload?.message||'조회 실패',httpStatus:status};
 const matches=Array.isArray(payload.rows)?payload.rows.filter(x=>x.isSeed||cleanKeyword(x.keyword).replace(/\s/g,'').toUpperCase()===keyword.replace(/\s/g,'').toUpperCase()):[];
 return {
  status:matches.length?'ok':'not_found',keyword,measuredAt:payload.measuredAt,source:payload.source,
  exactMatch:matches.length?matches[0]:null,
  relatedSuggestions:matches.length?[]:(Array.isArray(payload.rows)?payload.rows.slice(0,5).map(x=>x.keyword):[]),
  note:'검색광고 기준 월간 검색량. 정확한 수치가 없는 10 미만은 0으로 변환하지 않음. 광고 경쟁도와 블로그 노출 난이도는 다름.'
 };
}
module.exports=async function(req,res){
 setHeaders(res);
 if(req.method==='GET'){
  res.setHeader('Allow','POST, OPTIONS');
  return res.status(405).json({error:'method_not_allowed',message:'MCP streamable HTTP POST required'});
 }
 if(req.method==='OPTIONS'){res.setHeader('Allow','POST, OPTIONS');return res.status(204).end()}
 if(req.method!=='POST')return res.status(405).end();
 const b=typeof req.body==='string'?(()=>{try{return JSON.parse(req.body)}catch{return null}})():req.body;
 if(!b||typeof b!=='object'||Array.isArray(b)||JSON.stringify(b).length>16000)return rpcError(res,null,-32700,'Invalid JSON-RPC request');
 if(b.jsonrpc!=='2.0'||typeof b.method!=='string')return rpcError(res,b.id??null,-32600,'Invalid JSON-RPC envelope');
 const id=b.id??null;
 if(b.method==='initialize'){
  const proposed=b.params?.protocolVersion;
  const version=['2025-06-18','2025-03-26','2024-11-05'].includes(proposed)?proposed:'2025-06-18';
  return rpc(res,id,{protocolVersion:version,capabilities:{tools:{}},serverInfo:{name:'momentum-keyword-research',version:'1.0.0'}});
 }
 if(b.method==='notifications/initialized'||b.method==='notifications/cancelled')return res.status(202).end();
 if(b.method==='ping')return rpc(res,id,{});
 if(b.method==='tools/list')return rpc(res,id,{tools:[tool]});
 if(b.method!=='tools/call')return rpcError(res,id,-32601,'Unknown MCP method');
 const identity=oauth.accessFromRequest(req);
 if(!identity)return oauth.challenge(res);
 if(b.params?.name!==TOOL)return rpcError(res,id,-32602,'Unknown tool');
 const words=b.params?.arguments?.keywords;
 if(!Array.isArray(words)||words.length<1||words.length>4||words.some(x=>typeof x!=='string'||cleanKeyword(x).length<2||cleanKeyword(x).length>30||/[<>\x00-\x1f]/.test(x)))
  return rpcError(res,id,-32602,'keywords must contain 1–4 strings of 2–30 characters');
 const keywords=[...new Set(words.map(cleanKeyword))],results=[];
 for(let i=0;i<keywords.length;i++){
  if(i)await new Promise(resolve=>setTimeout(resolve,5200)); // Original editorial endpoint's 5-second throttle.
  results.push(await queryExistingReadOnly(keywords[i]));
 }
 const output={source:'NAVER Search Ads API, via Momentum Marketing private keyword workbench',results};
 const hasError=results.some(x=>x.status==='error');
 return rpc(res,id,{content:[{type:'text',text:JSON.stringify(output)}],structuredContent:output,isError:hasError});
};