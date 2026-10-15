(function(){
'use strict';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=v=>v?new Date(v).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'—';
let accounts=[],saving=false;
function message(s,error=false){$('message').textContent=s;$('message').classList.toggle('error',error)}
function render(){
 $('total').textContent=accounts.length;
 $('rows').innerHTML=accounts.length?accounts.map(row=>{
  const free=row.plan==='free',used=Number(row.used_slots)||0;
  return '<tr><td><strong>'+escape(row.email)+'</strong><small>회원 ID '+escape(row.user_id)+'</small></td>'+
   '<td>'+escape(row.plan)+'</td><td><strong>'+used+' / '+escape(row.slot_limit)+'</strong></td>'+
   '<td>'+escape(when(row.created_at))+'</td><td>'+
   (free?'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+
   '<input aria-label="회원 슬롯 배정 수" type="number" min="'+Math.max(1,used)+'" max="200" step="1" value="'+escape(row.slot_limit)+'" data-slot="'+escape(row.user_id)+'">'+
   '<input aria-label="슬롯 변경 사유" type="text" placeholder="테스트 사유 필수" maxlength="200" data-reason="'+escape(row.user_id)+'">'+
   '<button class="action" data-save="'+escape(row.user_id)+'">변경</button></div>':'<small>유료 요금제는 결제 시스템에서 관리</small>')+
   '</td></tr>';
 }).join(''):'<tr><td colspan="5">등록된 회원이 없습니다.</td></tr>';
}
async function read(){
 message('서버에 저장된 회원 정보를 불러오고 있습니다.');
 try{
  const response=await fetch('/admin/members/api',{credentials:'same-origin',cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'회원 데이터를 읽지 못했습니다.');
  accounts=data.accounts||[];render();message(accounts.length+'명의 회원 현황을 불러왔습니다. 변경은 무료 시험 슬롯에만 적용됩니다.');
 }catch(err){accounts=[];render();message(err.message,true)}
}
$('rows').addEventListener('click',async event=>{
 const button=event.target.closest('button[data-save]');if(!button||saving)return;
 const id=button.dataset.save,row=accounts.find(x=>x.user_id===id);
 if(!row||row.plan!=='free')return;
 const limit=Number(document.querySelector('input[data-slot="'+id+'"]')?.value);
 const reason=document.querySelector('input[data-reason="'+id+'"]')?.value.trim()||'';
 if(!Number.isInteger(limit)||limit<Math.max(1,Number(row.used_slots)||0)||limit>200||reason.length<5){
  message('슬롯 수는 사용량 이상 200 이하이고 변경 사유는 5자 이상이어야 합니다.',true);return;
 }
 if(!confirm('이 회원의 무료 파일럿 슬롯 한도를 '+limit+'개로 변경하시겠습니까?'))return;
 saving=true;button.disabled=true;
 try{
  const response=await fetch('/admin/members/api',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'set_pilot_slots',userId:id,limit,reason})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'변경 실패');
  await read();message('무료 파일럿 슬롯 한도를 변경하고 감사 기록에 저장했습니다. 결제 또는 요금제는 변경하지 않았습니다.');
 }catch(err){message(err.message,true)}
 finally{button.disabled=false;saving=false}
});
$('refresh').addEventListener('click',read);
read();
})();