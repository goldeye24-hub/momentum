(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
let mode='login',busy=false,account=null;
const fmt=iso=>iso?new Date(iso).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—';
function message(id,str,error=false){$(id).textContent=str;$(id).classList.toggle('error',error)}
function changeMode(newMode){
 mode=newMode;
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
 $('authTitle').textContent=mode==='login'?'회원 로그인':'신규 회원가입';
 $('authSubmit').textContent=mode==='login'?'로그인':'회원가입';
 $('password').autocomplete=mode==='login'?'current-password':'new-password';
 message('authMessage',mode==='login'?'이메일 인증을 마친 회원은 로그인할 수 있습니다.':'이메일 인증 후 로그인해야 합니다.');
}
async function api(path,opts={}){
 const r=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...opts});
 let body;try{body=await r.json()}catch{throw Error('서버 응답을 확인하지 못했습니다.')}
 if(!r.ok)throw Error(body.error||body.message||'서비스 연결을 확인해 주세요.');
 return body;
}
const post=(path,data)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
function showAccount(show){
 $('authPanel').hidden=show;$('dashboard').hidden=!show;$('logout').hidden=!show;
 if(show)window.scrollTo({top:0,behavior:'instant'});
}
function draw(list){
 const rows=Array.isArray(list)?list:[];
 $('watchRows').innerHTML=rows.length?rows.map(row=>{
  const exact=row.place_id!=null;
  const rank=row.rank!==null&&row.rank!==undefined
   ?'<b>'+(row.rank_approximate?'약 ':'')+esc(row.rank)+'위</b>'
   :'<span class="missing">순위 미관측</span>';
  const place=exact?'ID '+esc(row.place_id):'업체명만 등록 · 식별 검증 필요';
  return '<tr><td><b>'+esc(row.label)+'</b><small>'+place+'</small></td><td>'+esc(row.keyword)+'</td>'+
   '<td>'+rank+(!exact?'<small class="approx">정확한 ID 등록 권장</small>':'')+'</td>'+
   '<td>'+esc(fmt(row.observed_at))+'</td><td><button type="button" data-remove="'+esc(row.id)+'">삭제</button></td></tr>';
 }).join(''):'<tr><td colspan="5">등록된 업체와 키워드가 없습니다.</td></tr>';
}
async function load(){
 try{
  const r=await api('member-watches');account=r;
  $('accountLabel').textContent='등록한 업체와 키워드를 확인합니다.';
  $('plan').textContent=({free:'무료',basic:'베이직',pro:'프로',agency:'대행사'})[r.plan]||'회원';
  $('slots').textContent=r.usedSlots+' / '+r.slotLimit;
  $('count').textContent=String(r.targets.length);
  draw(r.targets);
  message('dashboardMessage',r.usedSlots>=r.slotLimit?
   '등록된 슬롯을 모두 사용 중입니다. 다른 키워드를 등록하려면 기존 항목을 삭제하세요.':
   '등록 가능 슬롯 '+(r.slotLimit-r.usedSlots)+'개 · 실제 관측 데이터가 있는 경우에만 순위를 표시합니다.');
  $('addWatch').disabled=r.usedSlots>=r.slotLimit;
 }catch(err){message('dashboardMessage',err.message,true)}
}
async function initialize(){
 try{
  const session=await api('member-auth');
  if(session.authenticated){showAccount(true);await load()}
  else showAccount(false);
 }catch(err){showAccount(false);message('authMessage',err.message,true)}
}
$('authForm').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;busy=true;
 $('authSubmit').disabled=true;
 try{
  const response=await post('member-auth',{action:mode,email:$('email').value,password:$('password').value});
  $('password').value='';
  if(mode==='signup'){
   changeMode('login');
   message('authMessage',response.message||'가입 안내 이메일을 확인해 주세요.');
  }else{
   showAccount(true);await load();
  }
 }catch(err){message('authMessage',err.message,true)}
 finally{busy=false;$('authSubmit').disabled=false}
});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>changeMode(b.dataset.mode)));
$('watchForm').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;busy=true;$('addWatch').disabled=true;
 try{
  const form=new FormData($('watchForm'));
  const data=Object.fromEntries(form.entries());
  const result=await post('member-watches',{action:'add',...data});
  $('watchForm').reset();
  await load();message('dashboardMessage',result.note||'등록했습니다.');
 }catch(err){message('dashboardMessage',err.message,true)}
 finally{busy=false;if(account&&account.usedSlots<account.slotLimit)$('addWatch').disabled=false}
});
$('watchRows').addEventListener('click',async e=>{
 const button=e.target.closest('button[data-remove]');if(!button||busy)return;
 if(!confirm('해당 업체·키워드 등록을 삭제하시겠습니까?'))return;
 busy=true;button.disabled=true;
 try{await post('member-watches',{action:'remove',id:button.dataset.remove});await load()}
 catch(err){message('dashboardMessage',err.message,true)}
 finally{busy=false;button.disabled=false}
});
$('refresh').addEventListener('click',load);
$('logout').addEventListener('click',async()=>{
 try{await post('member-auth',{action:'logout'});account=null;showAccount(false);
  message('authMessage','로그아웃되었습니다.')}catch(err){message('dashboardMessage',err.message,true)}
});
initialize();
})();