(function(){
'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
let days=30,result=null,working=false;
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error)}
function value(id){return $(id).value.trim()}
function count(id,n){$(id).textContent=n==null?'—':n.toLocaleString('ko-KR')}
function time(iso){return iso?new Date(iso).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'—'}
function setDays(d){days=d;document.querySelectorAll('[data-days]').forEach(b=>b.classList.toggle('active',Number(b.dataset.days)===days))}
function shownRows(){return (result?.rows||[]).filter(r=>$('filter').value==='all'||r.comparison===$('filter').value)}
function rank(n,approximate){return n===null?'<span class="missing">미관측</span>':'<b>'+esc(n)+'위</b>'+(approximate?'<span class="estimate"> · 근사</span>':'')}
function paint(){
 const sum=result?.summary||{};
 count('bothCount',sum.both);count('aCount',sum.onlyA);count('bCount',sum.onlyB);
 count('aTop10',sum.top10A);count('bTop10',sum.top10B);
 $('resultLabel').textContent=result?('A '+result.placeA+' · B '+result.placeB+' · '+result.days+'일'):'아직 선택된 업체 없음';
 const total=Math.max(1,(sum.top10A||0)+(sum.top10B||0));
 $('aBar').style.width=(100*(sum.top10A||0)/total).toFixed(1)+'%';
 $('bBar').style.width=(100*(sum.top10B||0)/total).toFixed(1)+'%';
 const rows=shownRows();
 $('compareRows').innerHTML=rows.length?rows.map(r=>'<tr><td><b>'+esc(r.keyword)+'</b></td><td>'+esc(time(r.observedAt))+'</td><td>'+rank(r.rankA,r.approximateA)+'</td><td>'+rank(r.rankB,r.approximateB)+'</td><td>'+
  (r.comparison==='both'?'<span class="flag-both">공통 관측</span>':r.comparison==='only_a'?'<span class="flag-a">A만 관측</span>':'<span class="flag-b">B만 관측</span>')+'</td></tr>').join(''):
  '<tr><td colspan="5" class="empty">'+(result?'선택한 조건에서 비교 가능한 실제 관측 기록이 없습니다.':'두 업체의 플레이스 ID 또는 URL을 입력하세요.')+'</td></tr>';
}
async function load(){
 if(working)return;
 const a=value('placeA'),b=value('placeB');
 if(!a||!b){message('두 업체의 플레이스 숫자 ID 또는 URL을 입력하세요.',true);return}
 working=true;$('submitCompare').disabled=true;message('저장된 모바일 키워드 자료를 비교하고 있습니다.');
 try{
  const url='/admin/competitors/api?a='+encodeURIComponent(a)+'&b='+encodeURIComponent(b)+'&days='+days;
  const response=await fetch(url,{method:'GET'});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'비교 데이터 조회 실패');
  result=data;paint();
  message(data.summary.keywordsObserved?('동일한 모바일 관측 기준으로 '+data.summary.keywordsObserved+'개 키워드를 비교했습니다.'):'아직 두 업체의 비교 가능한 관측 키워드가 없습니다. 순위표에서 관련 키워드의 자료를 먼저 수집하세요.');
 }catch(e){result=null;paint();message(e.message,true)}
 finally{working=false;$('submitCompare').disabled=false}
}
$('compareForm').addEventListener('submit',e=>{e.preventDefault();load()});
document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{setDays(Number(b.dataset.days));if(value('placeA')&&value('placeB'))load()}));
$('filter').addEventListener('change',paint);
$('exportCsv').addEventListener('click',()=>{
 if(!result?.rows?.length){message('내보낼 비교 기록이 없습니다.',true);return}
 const rows=[['검색어','수집일','A 업체 ID','A 관측 순위','A 근사 여부','B 업체 ID','B 관측 순위','B 근사 여부','관측 분류']];
 for(const r of shownRows())rows.push([r.keyword,r.observedAt,result.placeA,r.rankA??'',r.approximateA?'근사':'',result.placeB,r.rankB??'',r.approximateB?'근사':'',r.comparison]);
 const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const blob=new Blob(['\ufeff'+rows.map(a=>a.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='momentum-place-competitor-comparison.csv';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
});
const params=new URLSearchParams(location.search);
if(params.has('a'))$('placeA').value=params.get('a').slice(0,550);
if(params.has('b'))$('placeB').value=params.get('b').slice(0,550);
if(value('placeA')&&value('placeB'))load();
paint();
})();