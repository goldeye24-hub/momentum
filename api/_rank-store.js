'use strict';
// Server-only Supabase PostgREST adapter. Never expose service key to client.
function config(){
 const raw=process.env.MOMENTUM_RANK_DB_URL||'';
 let url;try{url=new URL(raw)}catch{return null}
 if(url.protocol!=='https:'||url.username||url.password||!url.hostname.endsWith('.supabase.co'))return null;
 const key=process.env.MOMENTUM_RANK_DB_SERVICE_KEY||'';
 if(key.length<40)return null;
 return {base:url.origin,token:key};
}
async function request(table,{method='GET',query={},body,prefer=''}={}){
 const cfg=config();
 if(!cfg)throw Object.assign(new Error('순위 기록 DB가 아직 연결되지 않았습니다.'),{code:'not_configured'});
 const u=new URL(cfg.base+'/rest/v1/'+table);
 for(const [key,value] of Object.entries(query))u.searchParams.set(key,String(value));
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);
 try{
  const rsp=await fetch(u,{
   method,signal:ctl.signal,
   headers:{'apikey':cfg.token,...(cfg.token.startsWith('sb_secret_')?{}:{'Authorization':'Bearer '+cfg.token}),
    'Content-Type':'application/json','Accept':'application/json',...(prefer?{Prefer:prefer}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  if(!rsp.ok){
   let reason=null;
   try{const detail=await rsp.json();
    if(['slot_limit_reached','member_not_found','invalid_target'].includes(detail?.message))reason=detail.message;
   }catch{}
   throw Object.assign(new Error('DB 요청 오류 ('+rsp.status+')'),{code:'database_error',status:rsp.status,reason});
  }
  if(rsp.status===204)return [];
  const raw=await rsp.text();
  return raw?JSON.parse(raw):[];
 }finally{clearTimeout(timer)}
}
const uuid=x=>/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(String(x||''));
module.exports={config,request,uuid};
