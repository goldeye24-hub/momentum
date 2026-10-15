(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={keyword:'',days:7,limit:100,data:null,selectedId:null};
const fmtTime=iso=>iso?new Date(iso).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'기록 없음';
function note(message,error=false){$('message').textContent=message;$('message').classList.toggle('error',error)}
function number(id,value){$(id).textContent=value===null||value===undefined?'—':Number(value).toLocaleString('ko-KR')}
function setActive(type,value){document.querySelectorAll('[data-'+type+']').forEach(el=>el.classList.toggle('active',Number(el.dataset[type])===value))}
function cleanKeyword(){return $('keyword').value.normalize('NFKC').trim().replace(/\s+/g,' ')}
function changeButtons(disabled){$('load').disabled=disabled;$('capture').disabled=disabled;$('load').textContent=disabled?'불러오는 중…':'기존 기록 조회'}
function known(row,i){return row?.ranks?.[i]!==null&&row?.ranks?.[i]!==undefined}
function pill(diff){return diff===null?'비교 불가':diff>0?'▲ '+diff:diff<0?'▼ '+Math.abs(diff):'변동 없음'}
function render(){
 const data=state.data,summary=data?.summary||{};
 number('latestCount',summary.latestObservedCount);number('matchedCount',summary.matchedAcrossLastTwo);
 number('risingCount',summary.rising);number('fallingCount',summary.falling);
 $('latestAt').textContent=data?.columns?.length?'최근 관측: '+fmtTime(summary.latestObservedAt):'저장된 관측 없음';
 $('coverage').textContent=(data?.columns?.length||0)+'개 관측일';
 const columns=data?.columns||[],rows=data?.rows||[];
 if(!columns.length){
  $('matrixHead').innerHTML='<tr><th>순위</th><th>관측 기록 없음</th></tr>';
  $('matrixBody').innerHTML='<tr><td colspan="2" class="empty">아직 저장된 관측이 없습니다. 새로운 목록을 관측하거나 이전 기록을 조회하세요.</td></tr>';
  $('movementRows').innerHTML='<tr><td colspan="5" class="empty">업체별 관측 데이터가 없습니다.</td></tr>';
  $('chartTitle').textContent='업체별 순위 추이';$('trendChart').textContent='관측값 두 개 이상이 필요합니다.';return;
 }
 $('matrixHead').innerHTML='<tr><th>순위</th>'+columns.map(c=>'<th>'+esc(c.date)+'<small style="display:block;margin-top:6px">'+esc(String(c.observedCount||0))+'개 관측</small></th>').join('')+'</tr>';
 const indexes=columns.map((col,i)=>{
  const map=new Map(),before=i>0?new Map((columns[i-1].entries||[]).map(x=>[x.placeId,x.rank])):null;
  for(const entry of col.entries||[]){
   const rank=entry.rank;
   if(!Number.isInteger(rank)||rank<1||rank>500)continue;
   if(!map.has(rank))map.set(rank,[]);
   map.get(rank).push({id:entry.placeId,name:entry.name,rank,
    approx:entry.approximate===true,previous:before?.get(entry.placeId)??null});
  }
  return map;
 });
 let body='';
 for(let rank=1;rank<=state.limit;rank++){
  body+='<tr><td>'+rank+'위</td>';
  for(const map of indexes){
   const entries=map.get(rank)||[];
   body+='<td>'+(entries.length?entries.map(r=>{
    const difference=r.previous!==null?r.previous-rank:null;
    const cls=difference>0?'diff-up':difference<0?'diff-down':'';
    return '<span class="store-name">'+esc(r.name)+' '+(r.approx?'<span class="estimate">근사</span>':'')+'</span>'+
     '<span class="store-sub">ID '+esc(r.id)+' · <span class="'+cls+'">'+esc(pill(difference))+'</span></span>';
   }).join('<div style="border-top:1px solid #e7eaf0;margin-top:5px;padding-top:5px"></div>'):'<span class="muted">—</span>')+'</td>';
  }
  body+='</tr>';
 }
 $('matrixBody').innerHTML=body;
 const movements=data.movements||[];
 $('movementRows').innerHTML=movements.length?movements.slice(0,100).map(m=>{
  const cls=m.delta>0?'up':m.delta<0?'down':'';
  return '<tr class="'+(state.selectedId===m.placeId?'selected':'')+'"><td><button type="button" data-place="'+esc(m.placeId)+'">'+esc(m.name)+'</button><small style="display:block;color:#94a1b3">ID '+esc(m.placeId)+'</small></td>'+
   '<td><b>'+esc(m.rank)+'위</b></td><td>'+(m.previousRank===null?'—':esc(m.previousRank)+'위')+'</td>'+
   '<td class="'+cls+'">'+esc(pill(m.delta))+'</td><td>'+(m.approximate?'근사 포함':'목록 관측')+'</td></tr>';
 }).join(''):'<tr><td colspan="5" class="empty">최근 관측값이 없습니다.</td></tr>';
 if(!state.selectedId||!rows.find(x=>x.id===state.selectedId))state.selectedId=movements[0]?.placeId||rows[0]?.id||null;
 trend();
}
function trend(){
 const data=state.data,row=(data?.rows||[]).find(x=>x.id===state.selectedId),columns=data?.columns||[];
 const mount=$('trendChart');
 if(!row){mount.textContent='업체를 선택하면 관측 기록을 표시합니다.';return}
 $('chartTitle').textContent=row.name+' · 순위 추이';
 const valid=row.ranks.map((rank,i)=>({rank,i})).filter(x=>Number.isInteger(x.rank)&&x.rank>0);
 if(!valid.length){mount.textContent='이 업체의 관측 순위가 없습니다.';return}
 const w=550,h=255,p=34,rs=valid.map(x=>x.rank),low=Math.min(...rs),high=Math.max(...rs),span=Math.max(1,high-low);
 const x=i=>p+(i/Math.max(1,columns.length-1))*(w-p*2);
 const y=rank=>p+((rank-low)/span)*(h-p*2);
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.setAttribute('role','img');
 svg.setAttribute('aria-label',row.name+' 순위 관측 그래프 (1위에 가까울수록 상단)');
 for(let i=0;i<3;i++){
  const guide=document.createElementNS(ns,'line'),gy=p+i*(h-p*2)/2;
  for(const [k,v] of Object.entries({x1:p,x2:w-p,y1:gy,y2:gy,stroke:'#e2eaf4','stroke-dasharray':'4 5'}))guide.setAttribute(k,v);
  svg.appendChild(guide);
 }
 // Never draw a segment through an unobserved date.
 for(let i=1;i<row.ranks.length;i++){
  if(!known(row,i)||!known(row,i-1))continue;
  const line=document.createElementNS(ns,'line');
  for(const [k,v] of Object.entries({x1:x(i-1),y1:y(row.ranks[i-1]),x2:x(i),y2:y(row.ranks[i]),stroke:'#3676d1','stroke-width':3,'stroke-linecap':'round'}))line.setAttribute(k,v);
  svg.appendChild(line);
 }
 for(const item of valid){
  const circle=document.createElementNS(ns,'circle');
  for(const [k,v] of Object.entries({cx:x(item.i),cy:y(item.rank),r:5,fill:row.approximate[item.i]?'#e7a548':'#3676d1'}))circle.setAttribute(k,v);
  const title=document.createElementNS(ns,'title');title.textContent=columns[item.i].date+' · '+item.rank+'위'+(row.approximate[item.i]?' (근사)':'');
  circle.appendChild(title);svg.appendChild(circle);
 }
 mount.replaceChildren(svg);
 const desc=document.createElement('div');desc.style.fontSize='11px';desc.textContent='관측 '+valid.length+'회 · '+low+'~'+high+'위';
 mount.appendChild(desc);
}
async function request(method,keyword,days){
 const opts=method==='POST'?{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({keyword,days})}:{method};
 const url='/admin/keyword-matrix/api'+(method==='GET'?'?keyword='+encodeURIComponent(keyword)+'&days='+days:'');
 const response=await fetch(url,opts);
 let data;try{data=await response.json()}catch{throw Error('서버가 JSON 결과를 반환하지 않았습니다.')}
 if(!response.ok)throw Error(data.message||data.error||'저장소에 접근하지 못했습니다.');
 return data;
}
async function load(){
 const keyword=cleanKeyword();if(keyword.length<2||keyword.length>60){note('검색 키워드는 2~60자로 입력하세요.',true);return}
 changeButtons(true);note('실제 저장된 관측 기록을 불러오고 있습니다.');
 try{
  const data=await request('GET',keyword,state.days);state.data=data;state.keyword=keyword;render();
  note(data.columns?.length?keyword+' · '+data.columns.length+'개 관측일의 기록을 불러왔습니다.':'저장된 관측 기록이 없습니다. 신규 관측을 실행할 수 있습니다.');
 }catch(err){note(err.message,true)}
 finally{changeButtons(false)}
}
async function capture(){
 const keyword=cleanKeyword();if(keyword.length<2||keyword.length>60){note('검색 키워드는 2~60자로 입력하세요.',true);return}
 if(!confirm('관리자 전용 모바일 목록 관측을 1회 요청합니다. 네이버 요청 제한이 발생하면 즉시 중단합니다. 계속하시겠습니까?'))return;
 changeButtons(true);note('새 목록 관측을 요청했습니다. 이미 수집된 30분 이내 데이터는 재사용됩니다.');
 try{
  const result=await request('POST',keyword,state.days);
  note('실제 관측 '+result.observedCount+'개 · '+fmtTime(result.observedAt)+(result.cached?' (저장된 캐시 재사용)':'')+'. 그래프를 갱신합니다.');
  await load();
 }catch(err){note(err.message,true)}
 finally{changeButtons(false)}
}
$('keywordForm').addEventListener('submit',e=>{e.preventDefault();load()});
$('capture').addEventListener('click',capture);
document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{state.days=Number(b.dataset.days);setActive('days',state.days);load()}));
document.querySelectorAll('[data-limit]').forEach(b=>b.addEventListener('click',()=>{state.limit=Number(b.dataset.limit);setActive('limit',state.limit);render()}));
$('movementRows').addEventListener('click',e=>{const el=e.target.closest('button[data-place]');if(!el)return;state.selectedId=el.dataset.place;render()});
$('exportCsv').addEventListener('click',()=>{
 const data=state.data;if(!data?.columns?.length){note('내보낼 관측 기록이 없습니다.',true);return}
 const csvRows=[['플레이스 ID','업체명',...data.columns.map(c=>c.date)]];
 const union=new Map();
 data.columns.forEach((column,i)=>{
  for(const entry of column.entries||[]){
   if(!union.has(entry.placeId))union.set(entry.placeId,{name:entry.name,ranks:Array(data.columns.length).fill('')});
   const row=union.get(entry.placeId);row.name=entry.name;
   row.ranks[i]=String(entry.rank)+(entry.approximate?' (근사)':'');
  }
 });
 for(const [id,r] of union)csvRows.push([id,r.name,...r.ranks]);
 const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const blob=new Blob(['\ufeff'+csvRows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='momentum-keyword-rank-'+state.keyword.replace(/[^\p{L}\p{N}-]/gu,'_')+'.csv';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
});
load();
})();