(function(){
'use strict';
const $=id=>document.getElementById(id);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=iso=>iso?new Date(iso).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—';
let selected=null,days=30,result=null,generation=0;
function notice(msg,error=false){$('historyMessage').textContent=msg;$('historyMessage').classList.toggle('error',error)}
function number(id,value,suffix=''){$(id).textContent=value==null?'—':Number(value).toLocaleString('ko-KR')+suffix}
function setDays(value){
 days=value;document.querySelectorAll('[data-history-days]').forEach(b=>{
  b.classList.toggle('active',Number(b.dataset.historyDays)===days)
 });
}
function chart(rows){
 const mount=$('historyChart');mount.replaceChildren();
 const valid=rows.filter(r=>Number.isInteger(r.rank)&&r.rank>=1);
 if(!valid.length){mount.textContent='실제로 측정된 업체 순위가 없습니다. 순위 기록이 쌓이면 그래프가 표시됩니다.';return}
 const n=rows.length,w=900,h=258,left=54,right=26,top=32,bottom=46;
 const lo=Math.max(1,Math.min(...valid.map(r=>r.rank))-3);
 const hi=Math.max(lo+1,Math.max(...valid.map(r=>r.rank))+3);
 const x=i=>left+(i/Math.max(1,n-1))*(w-left-right);
 const y=r=>top+(r-lo)/(hi-lo)*(h-top-bottom);
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.setAttribute('role','img');
 svg.setAttribute('aria-label','순위가 낮은 숫자일수록 화면 위쪽에 표시되는 실제 순위 관측 그래프');
 function line(attrs,titleText){
  const el=document.createElementNS(ns,'line');
  for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
  if(titleText){const t=document.createElementNS(ns,'title');t.textContent=titleText;el.append(t)}
  svg.append(el);return el;
 }
 for(let i=0;i<=3;i++){
  const r=lo+((hi-lo)*i/3),yp=y(r);
  line({x1:left,x2:w-right,y1:yp,y2:yp,stroke:'#e3ebf4','stroke-dasharray':'5 6','stroke-width':1});
  const label=document.createElementNS(ns,'text');label.setAttribute('x','6');label.setAttribute('y',String(yp+4));
  label.setAttribute('fill','#6d8199');label.setAttribute('font-size','12');
  label.textContent=Math.round(r)+'위';svg.append(label);
 }
 rows.forEach((r,i)=>{
  if(i>0&&r.rank!==null&&rows[i-1].rank!==null){
   line({x1:x(i-1),x2:x(i),y1:y(rows[i-1].rank),y2:y(r.rank),
    stroke:r.approximate||rows[i-1].approximate?'#c79643':'#3277c8','stroke-width':3,
    'stroke-linecap':'round'});
  }
  if(r.rank===null)return;
  const dot=document.createElementNS(ns,'circle');
  for(const [k,v] of Object.entries({cx:x(i),cy:y(r.rank),r:5,fill:r.approximate?'#d39e41':'#3075cb'}))dot.setAttribute(k,v);
  const title=document.createElementNS(ns,'title');
  title.textContent=r.date+' · '+r.rank+'위'+(r.approximate?' (표시 순서 근사)':'');
  dot.append(title);svg.append(dot);
 });
 for(const i of [0,Math.floor((n-1)/2),n-1]){
  if(!rows[i])continue;
  const label=document.createElementNS(ns,'text');label.setAttribute('x',x(i));
  label.setAttribute('y',String(h-12));label.setAttribute('fill','#637c97');
  label.setAttribute('font-size','12');label.setAttribute('text-anchor','middle');
  label.textContent=rows[i].date.slice(5);svg.append(label);
 }
 mount.append(svg);
}
function render(){
 if(!result)return;
 const s=result.summary||{},rows=result.rows||[];
 number('historyMeasured',s.daysMeasured);
 number('historyMatched',s.daysMatched);
 number('historyLatest',s.lastRecordedRank,'위');
 $('historyDelta').textContent=s.change===null||s.change===undefined?'비교 불가':
  (s.change>0?'▲ '+s.change:s.change<0?'▼ '+Math.abs(s.change):'변동 없음');
 $('historyDelta').classList.toggle('positive',s.change>0);
 $('historyDelta').classList.toggle('negative',s.change<0);
 $('historyTitle').textContent=result.target.label+' · 누적 순위';
 $('historySubtitle').textContent=result.target.keyword+' · 플레이스 '+result.target.placeId+
  ' · 마지막 순위 관측 '+(s.lastRecordedAt?format(s.lastRecordedAt):'없음');
 $('historyRows').innerHTML=rows.length?rows.slice().reverse().map(r=>'<tr><td>'+escape(r.date)+'</td>'+
   '<td>'+(r.status==='not_measured'?'측정 없음':r.status==='not_found_in_observed_list'?'목록에서 미발견':'목록 관측')+'</td>'+
   '<td>'+(r.rank===null?'<span class="missing">—</span>':'<b>'+escape(r.rank)+'위</b>')+'</td>'+
   '<td>'+(r.rank===null?'—':r.approximate?'표시 순서 근사':'목록 표시 위치')+'</td>'+
   '<td>'+escape(format(r.observedAt))+'</td></tr>').join(''):
  '<tr><td colspan="5">저장된 관측 이력이 없습니다.</td></tr>';
 chart(rows);
 if(s.daysMeasured===0)notice('선택 기간에는 키워드 관측 자체가 없습니다. 순위는 임의로 생성하지 않습니다.');
 else if(s.daysMatched===0)notice('키워드 목록은 관측됐지만 선택 업체의 순위가 확인되지 않았습니다. 미노출로 단정하지 않습니다.');
 else notice('실제 관측 '+s.daysMeasured+'일 중 업체가 '+s.daysMatched+'일 확인됐습니다. 빈 날짜는 데이터가 없는 상태입니다.');
}
async function load(){
 if(!selected)return;
 const requestGeneration=++generation;
 notice('서버에 저장된 순위 관측 이력을 확인하고 있습니다.');
 $('historyCsv').disabled=true;
 try{
  const response=await fetch('/api/member-history?targetId='+encodeURIComponent(selected)+'&days='+days,
   {credentials:'same-origin',cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'누적 순위 데이터를 불러오지 못했습니다.');
  if(requestGeneration!==generation)return;
  result=data;render();$('historyCsv').disabled=!(data.rows||[]).length;
 }catch(error){
  if(requestGeneration!==generation)return;
  result=null;$('historyRows').innerHTML='<tr><td colspan="5">저장된 기록을 불러오지 못했습니다.</td></tr>';
  $('historyChart').textContent='조회할 수 없습니다.';
  notice(error.message,true);
 }
}
function open(targetId){
 if(!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(String(targetId||'')))return;
 selected=targetId;result=null;$('historyPanel').hidden=false;
 $('historyPanel').scrollIntoView({behavior:'smooth',block:'start'});
 load();
}
function close(){++generation;selected=null;result=null;$('historyPanel').hidden=true}
document.querySelectorAll('[data-history-days]').forEach(b=>b.addEventListener('click',()=>{
 setDays(Number(b.dataset.historyDays));if(selected)load();
}));
$('historyClose').addEventListener('click',close);
$('historyCsv').addEventListener('click',()=>{
 if(!result?.rows?.length)return;
 const t=result.target,quote=value=>{
  const s=String(value??'');const protectedText=/^[=+\-@]/.test(s.trim())?"'"+s:s;
  return '"'+protectedText.replace(/"/g,'""')+'"';
 };
 const lines=[['키워드','플레이스 ID','날짜','목록 관측 시각','업체 순위','근사 여부','상태']];
 for(const row of result.rows)lines.push([t.keyword,t.placeId,row.date,row.observedAt||'',row.rank??'',
  row.rank===null?'':row.approximate?'근사':'',row.status]);
 const blob=new Blob(['\ufeff'+lines.map(line=>line.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download='momentum-my-place-history-'+days+'d.csv';anchor.click();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
});
window.MomentumHistory={open,close};
})();