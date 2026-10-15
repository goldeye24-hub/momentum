(function(){
'use strict';
const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={data:null,days:30,loading:false};
const input=()=>$('placeId').value.trim();
const formatTime=value=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—';
function note(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error)}
function count(id,value){$(id).textContent=value===undefined||value===null?'—':Number(value).toLocaleString('ko-KR')}
function visibleRows(){
 const arr=state.data?.rows||[],selected=$('filter').value;
 return arr.filter(x=>selected==='all'||selected==='top10'&&x.rank!==null&&x.rank<=10||
  selected==='rising'&&x.delta>0||selected==='falling'&&x.delta<0||
  selected==='missing'&&x.rank===null);
}
function rank(n,approx){return n===null?'<span class="missing">미관측</span>':'<strong>'+esc(n)+'위</strong>'+(approx?'<span class="approx"> · 근사</span>':'')}
function delta(row){return row.delta===null?'<span class="missing">비교 불가</span>':row.delta>0?'<span class="positive">▲ '+row.delta+'</span>':
 row.delta<0?'<span class="negative">▼ '+Math.abs(row.delta)+'</span>':'변동 없음'}
function render(){
 const data=state.data,summary=data?.summary||{};
 count('keywordCount',summary.trackedKeywords);count('top3Count',summary.top3);count('top10Count',summary.top10);
 count('risingCount',summary.rising);count('fallingCount',summary.falling);count('missingCount',summary.notObservedLatest);
 const first=(data?.rows||[]).find(x=>x.name);
 $('storeTitle').textContent=first?.name?first.name+' · 관측 키워드':'업체 관측 키워드';
 $('lastAt').textContent=data?.placeId?'플레이스 ID '+data.placeId:'플레이스 ID 미입력';
 $('totalLabel').textContent=data?data.summary.trackedKeywords+'개 검색어 기록':'실측 기록 없음';
 const rows=visibleRows();
 $('insightRows').innerHTML=rows.length?rows.map(r=>{
  const href='/admin/keyword-matrix/?keyword='+encodeURIComponent(r.keyword);
  const status=r.rank===null?'<span class="missing">최신 목록 미관측</span>':'<span class="observed">관측됨</span>';
  return '<tr><td><strong>'+esc(r.keyword)+'</strong></td><td>'+esc(formatTime(r.observedAt))+'</td><td>'+rank(r.rank,r.approximate)+'</td>'+
   '<td>'+rank(r.previousRank,r.previousApproximate)+'</td><td>'+delta(r)+'</td><td>'+status+'</td>'+
   '<td><a href="'+esc(href)+'">순위표 보기 ↗</a></td></tr>';
 }).join(''):
 '<tr><td colspan="7" class="empty">'+(data?'선택 기간에서 해당 조건에 맞는 실제 관측 키워드가 없습니다.':'플레이스 ID로 저장된 순위 기록을 조회하세요.')+'</td></tr>';
}
async function load(){
 if(state.loading)return;
 const id=input();if(!id){note('업체 숫자 ID 또는 네이버 플레이스 주소를 입력하세요.',true);return}
 state.loading=true;$('search').disabled=true;note('실제 저장된 키워드 기록을 확인하고 있습니다.');
 try{
  const res=await fetch('/admin/place-insights/api?placeId='+encodeURIComponent(id)+'&days='+state.days,{method:'GET'});
  const data=await res.json();if(!res.ok)throw Error(data.error||'서버 조회 오류');
  state.data=data;render();
  note(data.rows.length?'총 '+data.summary.trackedKeywords+'개 키워드의 실제 관측 이력을 확인했습니다.':'이 업체에 대해 저장된 모바일 관측 키워드가 없습니다. 키워드 순위표에서 먼저 관측 목록을 수집해야 합니다.');
 }catch(e){state.data=null;render();note(e.message,true)}
 finally{state.loading=false;$('search').disabled=false}
}
$('insightForm').addEventListener('submit',e=>{e.preventDefault();load()});
document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{
 state.days=Number(b.dataset.days);document.querySelectorAll('[data-days]').forEach(x=>x.classList.toggle('active',Number(x.dataset.days)===state.days));
 if(input())load();
}));
$('filter').addEventListener('change',render);
$('exportCsv').addEventListener('click',()=>{
 if(!state.data?.rows?.length){note('내보낼 실제 관측 기록이 없습니다.',true);return}
 const records=[['키워드','최근 관측','최근 순위','직전 순위','변동','최근 값 근사 여부','현재 관측 상태']];
 for(const x of visibleRows())records.push([x.keyword,x.observedAt,x.rank??'',x.previousRank??'',x.delta??'',x.approximate?'근사':'',x.status]);
 const q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 const blob=new Blob(['\ufeff'+records.map(r=>r.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='momentum-place-observed-keywords.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
});
const params=new URLSearchParams(location.search),preset=params.get('placeId');
if(preset&&preset.length<=550){$('placeId').value=preset;load()}else render();
})();