'use strict';
// Production HTTP smoke checks: anonymous read-only requests only.
// Never send passwords, cookies, session tokens or Supabase secrets.
const ORIGIN=(process.env.MOMENTUM_SMOKE_BASE||'https://momentum-goldeye24-hubs-projects.vercel.app').replace(/\/$/,'');
const cases=[
 {name:'marketing_home',path:'/',expected:[200],contains:'모멘텀'},
 {name:'member_portal',path:'/platform/',expected:[200],contains:'회원 로그인'},
 {name:'member_js',path:'/platform/portal.js',expected:[200],contains:'REMEMBER_EMAIL_KEY'},
 {name:'member_css',path:'/platform/portal.css',expected:[200],contains:'.remember-email'},
 {name:'member_history_js',path:'/platform/history.js',expected:[200],contains:'MomentumHistory'},
 {name:'admin_login',path:'/admin/',expected:[200],contains:'관리자 로그인'},
 {name:'admin_connection_private',path:'/admin/connection/',expected:[200],contains:'관리자 로그인'},
 {name:'rank_lab',path:'/lab/rank/',expected:[200],contains:'순위'},
 {name:'member_auth_session',path:'/api/member-auth',expected:[200],json:true,check:x=>x.authenticated===false},
 {name:'member_watches_unauthorized',path:'/api/member-watches',expected:[401],json:true},
 {name:'member_history_unauthorized',path:'/api/member-history',expected:[401],json:true},
 {name:'admin_connection_unauthorized',path:'/admin/connection/api',expected:[401],json:true},
 {name:'keyword_matrix_unauthorized',path:'/admin/keyword-matrix/api',expected:[401],json:true},
 {name:'competitors_unauthorized',path:'/admin/competitors/api',expected:[401],json:true},
 {name:'unknown_op',path:'/api/compact?op=invalid-smoke-check',expected:[404],json:true}
];
(async()=>{
 let failures=0;
 console.log('Testing public deployment route responses (no credentials):',ORIGIN);
 for(const item of cases){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),15000);
  try{
   const res=await fetch(ORIGIN+item.path,{method:'GET',redirect:'follow',signal:ctl.signal,headers:{'user-agent':'MomentumQA/1.0','accept':'text/html,application/json;q=0.9,*/*;q=0.8'}});
   const body=(await res.text()).slice(0,100000),mime=res.headers.get('content-type')||'';
   let json=null;if(item.json){try{json=JSON.parse(body)}catch{}}
   const checks=[item.expected.includes(res.status),!item.contains||body.includes(item.contains),!item.json||json!==null,!item.check||item.check(json||{})];
   const ok=checks.every(Boolean);
   if(!ok)failures++;
   // Log only safe diagnostic categories; never echo HTML/JSON, which may
   // accidentally include account info or environment values.
   console.log(JSON.stringify({check:item.name,pass:ok,status:res.status,contentType:mime.split(';')[0],
    redirects:res.url!==ORIGIN+item.path,
    expected:item.expected,markerFound:item.contains?body.includes(item.contains):undefined,
    responseCode:json?.code||undefined,authenticated:typeof json?.authenticated==='boolean'?json.authenticated:undefined}));
  }catch(e){failures++;console.log(JSON.stringify({check:item.name,pass:false,error:e.name||'request_failed'}))}
  finally{clearTimeout(timer)}
 }
 console.log('Smoke route failures:',failures,'/',cases.length);
 if(process.env.MOMENTUM_SMOKE_STRICT==='1'&&failures)process.exitCode=1;
})().catch(e=>{console.error(e.name);process.exitCode=1});
