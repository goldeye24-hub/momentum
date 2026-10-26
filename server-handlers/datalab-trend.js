'use strict';

/** Official NAVER DataLab trends. Search relative index, never absolute volume. */
const BUCKET=new Map();
const CACHE=new Map();
const MAX_BYTES=1600;
const json=(res,status,data)=>res.status(status).json(data);
function todayKst(){return new Date(Date.now()+9*3600000).toISOString().slice(0,10)}
function monthStart(months){const [y,m]=todayKst().split('-').map(Number);return new Date(Date.UTC(y,m-1-months,1)).toISOString().slice(0,10)}
function sanitize(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('입력 형식을 확인하세요.');
 const raw=body.keywords;
 if(!Array.isArray(raw)||!raw.length||raw.length>3)throw Error('비교 검색어를 1~3개 입력하세요.');
 const kw=raw.map(v=>String(v??'').trim()).filter(Boolean);
 if(kw.length!==raw.length||new Set(kw).size!==kw.length||kw.some(k=>k.length>35||/[<>\x00-\x1f]/.test(k)))
   throw Error('중복되지 않는 35자 이내 검색어를 입력하세요.');
 const months=Number(body.months||12);
 if(![3,6,12,24].includes(months))throw Error('조회 기간을 확인하세요.');
 const timeUnit=body.timeUnit==='week'?'week':'month';
 return {kw,months,timeUnit};
}
function limit(ip){
 const now=Date.now();
 if(BUCKET.size>1200)for(const [k,v] of BUCKET)if(now-v.t>60000)BUCKET.delete(k);
 const v=BUCKET.get(ip)||{t:now,n:0};
 if(now-v.t>60000){v.t=now;v.n=0}v.n++;
 BUCKET.set(ip,v);
 return v.n>6;
}
async function callProvider(args,env,fetchFn=fetch){
 const clientId=env.NAVER_DATALAB_CLIENT_ID||env.NAVER_CLIENT_ID;
 const clientSecret=env.NAVER_DATALAB_CLIENT_SECRET||env.NAVER_CLIENT_SECRET;
 if(!clientId||!clientSecret)return {error:'네이버 검색어 트렌드 API 인증 정보가 연결되지 않았습니다.',status:503};
 // Official Naver Open API endpoint, not the unrelated Ncloud Search API HUB.
 const endpoint='https://openapi.naver.com/v1/datalab/search';
 const headers={'X-Naver-Client-Id':clientId,'X-Naver-Client-Secret':clientSecret};
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try {
  const response=await fetchFn(endpoint,{method:'POST',signal:controller.signal,
    headers:{...headers,'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({startDate:monthStart(args.months),endDate:todayKst(),timeUnit:args.timeUnit,
      keywordGroups:args.kw.map(word=>({groupName:word,keywords:[word]}))})});
  if(!response.ok)return {error:response.status===429?'API 호출 한도를 초과했습니다. 잠시 후 다시 조회하세요.':'네이버 데이터랩 응답 오류 ('+response.status+'). 인증과 API 이용 설정을 점검하세요.',status:response.status===429?429:502};
  const payload=await response.json();
  if(!Array.isArray(payload.results))return {error:'검색어 트렌드 데이터 형식이 올바르지 않습니다.',status:502};
  const series=payload.results.slice(0,args.kw.length).map(x=>({
    keyword:String(x.title||'').slice(0,35),
    points:(Array.isArray(x.data)?x.data:[]).slice(0,110).map(point=>({
      date:String(point.period||''),ratio:Number(point.ratio)
    })).filter(p=>/^\d{4}-\d{2}(-\d{2})?$/.test(p.date)&&Number.isFinite(p.ratio)&&p.ratio>=0&&p.ratio<=100)
  }));
  return {series,startDate:monthStart(args.months),endDate:todayKst(),timeUnit:args.timeUnit,
     note:'각 시점의 상대 검색 관심도(최대값 100)입니다. 월간 실제 검색량이나 키워드 순위를 의미하지 않습니다.',
     source:'네이버 데이터랩 공식 API',checkedAt:new Date().toISOString()};
 } catch(e){return {error:e?.name==='AbortError'?'네이버 데이터랩 요청 시간이 초과되었습니다.':'검색어 트렌드 연결 오류입니다.',status:502}}
 finally{clearTimeout(timer)}
}
module.exports=async function(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'POST 요청만 지원합니다.'})}
 if(process.env.MOMENTUM_DATALAB_PUBLIC_ENABLED!=='true'||process.env.MOMENTUM_DATALAB_PUBLIC_DISPLAY_APPROVED!=='true')
  return json(res,503,{error:'공식 네이버 데이터랩 API 연동과 외부 제공 권한 확인이 필요합니다.',code:'not_configured'});
 const origin=String(req.headers?.origin||'');
 if(origin){try{const url=new URL(origin);if(url.protocol!=='https:'||url.host!==req.headers.host)return json(res,403,{error:'허용되지 않은 요청 출처입니다.'})}catch{return json(res,403,{error:'잘못된 요청 출처입니다.'})}}
 const ip=String(req.headers?.['x-forwarded-for']||'unknown').split(',')[0].trim().slice(0,64);
 if(limit(ip))return json(res,429,{error:'1분에 최대 6번 조회할 수 있습니다.'});
 let body=req.body;
 if(typeof body==='string'){if(Buffer.byteLength(body)>MAX_BYTES)return json(res,413,{error:'요청 용량이 너무 큽니다.'});try{body=JSON.parse(body)}catch{return json(res,400,{error:'JSON 형식 오류'})}}
 let args;try{args=sanitize(body)}catch(e){return json(res,400,{error:e.message})}
 const key=JSON.stringify(args),saved=CACHE.get(key);
 if(saved&&Date.now()-saved.ts<600000)return json(res,200,{...saved.data,cache:true});
 const answer=await callProvider(args,process.env);
 if(answer.error)return json(res,answer.status,{error:answer.error});
 if(CACHE.size>250)CACHE.clear();
 CACHE.set(key,{ts:Date.now(),data:answer});
 return json(res,200,answer);
};
module.exports.sanitize=sanitize;
module.exports.callProvider=callProvider;
