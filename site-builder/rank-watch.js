(function(){
'use strict';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let targets=[],observations=[];
function latest(id){
 const rows=observations.filter(x=>x.target_id===id).sort((a,b)=>String(b.observed_at).localeCompare(String(a.observed_at)));
 const r=rows[0],prev=rows.find((x,i)=>i>0&&typeof x.rank==='number');
 if(!r)return '—';
 if(r.status!=='ranked'||r.rank==null)return escape(r.status)+' (순위 미확인)';
 const delta=prev?.rank!=null?' / '+(prev.rank>r.rank?'▲ '+(prev.rank-r.rank):prev.rank<r.rank?'▼ '+(r.rank-prev.rank):'변동 없음'):'';
 return (r.rank_approximate?'약 ':'')+r.rank+'위'+delta;
}
function render(){
 $('watchList').innerHTML=targets.length?targets.map(x=>'<tr><td><b>'+escape(x.label)+'</b>'+escape(x.keyword)+'<small> · ID '+escape(x.place_id||x.target_name||'입력 없음')+'</small></td><td>'+escape(x.scope==='mobile'?'모바일 플레이스':x.scope==='map'?'PC 네이버지도':'PC 통합검색')+'</td><td>'+escape(latest(x.id))+'</td><td>'+(x.active?'추적 대상':'일시 중지')+'</td><td>'+(x.active?'<button data-action="measure" data-id="'+escape(x.id)+'">지금 측정</button>':'')+'<button data-action="'+(x.active?'pause':'resume')+'" data-id="'+escape(x.id)+'">'+(x.active?'중지':'재개')+'</button><button data-action="delete" data-id="'+escape(x.id)+'">삭제</button></td></tr>').join(''):'<tr><td colspan="5">등록된 측정 대상이 없습니다.</td></tr>';
}
async function api(action,payload){
 const r=await fetch('/admin/watches/api',{method:action==='read'?'GET':'POST',headers:{'Content-Type':'application/json'},...(action==='read'?{}:{body:JSON.stringify(payload)})});
 const d=await r.json();if(!r.ok)throw Error(d.error||'관리자 서버 오류');return d;
}
async function load(){
 $('status').textContent='서버 저장소를 확인하고 있습니다…';
 try{const data=await api('read');targets=data.targets||[];observations=data.observations||[];render();$('status').textContent='등록 대상 '+targets.length+'건 · 최근 관측 기록 '+observations.length+'건'}
 catch(err){targets=[];observations=[];render();$('status').textContent=err.message}
}
$('watchForm').addEventListener('submit',async e=>{
 e.preventDefault();const b=$('add');b.disabled=true;
 try{await api('write',{action:'create',label:$('label').value,keyword:$('keyword').value,placeUrl:$('placeUrl').value,scope:$('scope').value});$('watchForm').reset();await load()}
 catch(err){$('status').textContent=err.message}
 finally{b.disabled=false}
});
$('watchList').addEventListener('click',async e=>{
 const button=e.target.closest('button[data-action]');if(!button)return;
 const action=button.dataset.action,id=button.dataset.id;
 if(action==='delete'&&!confirm('선택한 업체와 순위 이력을 삭제할까요?'))return;
 button.disabled=true;
 if(action==='measure')$('status').textContent='선택한 업체의 순위를 측정하고 있습니다. 네이버 요청 제한 시 자동 재시도하지 않습니다.';
 try{
  const result=await api('write',{action,id});
  await load();
  if(action==='measure')$('status').textContent=result.message||'측정 작업을 확인했습니다.';
 }catch(err){$('status').textContent=err.message}finally{button.disabled=false}
});
$('reload').addEventListener('click',load);load();
})();