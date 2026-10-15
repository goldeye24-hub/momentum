(function(){
'use strict';
const $=id=>document.getElementById(id);let results=[];
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=x=>typeof x==='number'?x.toLocaleString('ko-KR'):x&&typeof x==='object'&&x.lessThan?'< '+x.lessThan:'—';
const content=x=>x.source==='naver_searchads'?'네이버 검색광고 실측 제공':'미측정';
const decodeAds=x=>typeof x==='string'&&x?x:'—';
const nav=x=>'https://search.naver.com/search.naver?query='+encodeURIComponent(x);
function render(){
 let rows=results.slice();const mode=$('sort').value;
 if(mode==='keyword')rows.sort((a,b)=>a.keyword.localeCompare(b.keyword,'ko'));
 if(mode==='volume')rows.sort((a,b)=>(typeof b.monthlyTotal==='number'?b.monthlyTotal:-1)-(typeof a.monthlyTotal==='number'?a.monthlyTotal:-1));
 $('table').innerHTML=rows.length?rows.map(x=>'<tr><td><strong>'+e(x.keyword)+'</strong><div><a href="'+e(nav(x.keyword))+'" target="_blank" rel="noopener noreferrer">직접 검색 ↗</a></div></td><td>'+e(x.intent)+'</td><td><span class="pill">'+e(x.priorityLabel)+'</span><div>'+x.priority+'점 / 가설</div></td><td>'+number(x.monthlyPc)+'</td><td>'+number(x.monthlyMobile)+'</td><td>'+e(decodeAds(x.adCompetition))+'</td><td>'+e(x.basis.join(' · ')||'기본 탐색')+'<div style="color:#8696a0;font-size:10px">'+e(content(x))+'</div></td></tr>').join(''):'<tr><td colspan="7" class="empty">분석 결과가 없습니다.</td></tr>';
}
async function analyse(){
 const seed=$('seed').value.trim(),region=$('region').value.trim();if(!seed)return;
 const b=$('run');b.disabled=true;b.textContent='분석 중…';
 $('apiStatus').textContent='분석 진행 중';
 try{
  const res=await fetch('/api/keyword-opportunities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keyword:seed,region})});
  const d=await res.json();if(!res.ok)throw Error(d.error||'요청 오류');
  results=d.candidates||[];$('summary').textContent=d.input+' · '+d.industry+(d.region?' · 지역 '+d.region:'')+' — '+results.length+'개 후보';
  $('count').textContent=results.length;$('high').textContent=results.filter(x=>x.priority>=76).length;
  $('measured').textContent=d.measurement?.measuredCount||'0';
  $('apiStatus').textContent=d.measurement?.searchAdsStatus==='connected'?'검색광고 데이터 연결':'기획 우선순위 분석';
  $('statusNote').textContent=(d.measurement?.note||'')+' · '+d.disclaimer;render();
 }catch(err){$('apiStatus').textContent='오류';$('statusNote').textContent=err.message}
 finally{b.disabled=false;b.textContent='분석하기 →'}
}
$('explorer').addEventListener('submit',ev=>{ev.preventDefault();analyse()});
document.querySelectorAll('.example').forEach(x=>x.addEventListener('click',()=>{$('seed').value=x.dataset.seed;$('region').value='';analyse()}));
$('sort').addEventListener('change',render);
$('copy').addEventListener('click',()=>{if(!results.length)return;navigator.clipboard?.writeText(results.map(x=>x.keyword).join('\n'));$('copy').textContent='복사 요청됨'});
$('csv').addEventListener('click',()=>{if(!results.length)return;
 const cols=[['keyword','키워드'],['intent','검색 의도'],['priority','기획 우선순위(휴리스틱)'],['monthlyPc','월간 PC 검색량'],['monthlyMobile','월간 모바일 검색량'],['adCompetition','광고 경쟁도'],['source','출처']];
 const quote=v=>'"'+String(v==null?'':typeof v==='object'?'< '+v.lessThan:v).replace(/"/g,'""')+'"';
 const rows=[cols.map(x=>quote(x[1])).join(',')].concat(results.map(x=>cols.map(([id])=>quote(x[id])).join(',')));
 const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='momentum-keyword-opportunities.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
analyse();
})();