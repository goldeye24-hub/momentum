(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palette=['#1669df','#0a987f','#8b5bd2','#dc7a2c','#cc477d'];
let dataset=null;
function parseTerms(input){
 const words=String(input||'').split(/[,\n\r]+/).map(x=>x.trim()).filter(Boolean);
 if(!words.length||words.length>5)throw Error('비교할 검색어는 1~5개까지 입력하세요.');
 const ids=new Set();
 for(const term of words){
  if(term.length<2||term.length>40||/[<>\x00-\x1f]/.test(term))throw Error('각 검색어는 2~40자로 입력하세요.');
  const key=term.replace(/\s/g,'').toLocaleLowerCase('ko');
  if(ids.has(key))throw Error('동일한 검색어를 중복 입력했습니다.');
  ids.add(key);
 }
 return words;
}
function pad(x){return String(x).padStart(2,'0')}
function dates(months){
 const now=new Date(Date.now()+9*3600000);
 const end=now.toISOString().slice(0,10);
 const year=now.getUTCFullYear(),month=now.getUTCMonth();
 const start=new Date(Date.UTC(year,month-Number(months)+1,1)).toISOString().slice(0,10);
 return {startDate:start,endDate:end};
}
function updateStatus(message,kind){
 const el=$('status');
 el.className='status'+(kind?' '+kind:'');
 el.textContent=message;
}
function normalizeData(data,origin){
 const series=(Array.isArray(data?.series)?data.series:[]).map((item,i)=>({
  title:String(item.title||'검색어 '+(i+1)).slice(0,60),
  points:(Array.isArray(item.points)?item.points:[])
   .filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(String(p.period))&&Number.isFinite(Number(p.ratio))&&Number(p.ratio)>=0&&Number(p.ratio)<=100)
   .map(p=>({period:String(p.period),ratio:Number(p.ratio)}))
 })).filter(x=>x.points.length);
 if(!series.length)throw Error('표시 가능한 검색어 추이 데이터가 없습니다.');
 const periods=[...new Set(series.flatMap(x=>x.points.map(p=>p.period)))].sort();
 if(periods.length<2)throw Error('비교 가능한 기간 데이터가 2개 이상 필요합니다.');
 return {series,periods,origin,checkedAt:data.checkedAt||null,from:data.startDate||periods[0],to:data.endDate||periods[periods.length-1],note:data.note||''};
}
function render(){
 if(!dataset)return;
 const {series,periods}=dataset;
 const w=850,h=340,left=52,right=16,top=18,bottom=52,drawWidth=w-left-right,drawHeight=h-top-bottom;
 const x=index=>left+(periods.length===1?0:drawWidth*index/(periods.length-1));
 const y=v=>top+(100-v)*drawHeight/100;
 let svg='<svg role="img" aria-label="검색어별 상대 관심도 추이 그래프. 자세한 수치는 아래 표에 있습니다." viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg">';
 for(let n=0;n<=4;n++){const val=n*25;svg+='<line x1="'+left+'" y1="'+y(val)+'" x2="'+(w-right)+'" y2="'+y(val)+'" stroke="#e6edf7" stroke-width="1"/><text x="'+(left-12)+'" y="'+(y(val)+5)+'" font-size="12" fill="#7389a4" text-anchor="end">'+val+'</text>';}
 const xLabels=[...new Set([0,Math.round((periods.length-1)/4),Math.round((periods.length-1)/2),Math.round((periods.length-1)*3/4),periods.length-1])];
 for(const i of xLabels)svg+='<text x="'+x(i)+'" y="'+(h-17)+'" font-size="11" fill="#6a819d" text-anchor="middle">'+esc(periods[i].slice(0,7))+'</text>';
 series.forEach((line,index)=>{
  const known=new Map(line.points.map(p=>[p.period,p.ratio]));
  const path=periods.flatMap((p,j)=>known.has(p)?[[x(j),y(known.get(p))]]:[]);
  const points=path.map(z=>z.join(',')).join(' ');
  if(path.length>1)svg+='<polyline points="'+points+'" fill="none" stroke="'+palette[index%palette.length]+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  path.forEach(([cx,cy])=>{svg+='<circle cx="'+cx+'" cy="'+cy+'" r="3.4" fill="'+palette[index%palette.length]+'" stroke="#fff" stroke-width="1.5"/>';});
 });
 svg+='</svg>';
 const graph=$('chart');graph.className='chart';graph.innerHTML=svg;
 $('legend').innerHTML=series.map((v,i)=>'<span><i style="--line:'+palette[i%palette.length]+'"></i>'+esc(v.title)+'</span>').join('');
 $('chartSubtitle').textContent=dataset.from+' ~ '+dataset.to+' · '+series.length+'개 검색어 · '+periods.length+'개 시점';
 $('source').textContent=(dataset.origin==='naver'?'출처: 네이버 API HUB 실제 검색어 추이': '출처: 사용자 업로드 CSV · 원본 진위 미검증')+' · 기간 안 상대 지수 0~100 · 절대 검색량 아님'+(dataset.checkedAt?' · '+new Date(dataset.checkedAt).toLocaleString('ko-KR'):'');
 $('export').disabled=false;
 $('thead').innerHTML='<tr><th scope="col">기간</th>'+series.map(x=>'<th scope="col">'+esc(x.title)+'</th>').join('')+'</tr>';
 const maps=series.map(x=>new Map(x.points.map(v=>[v.period,v.ratio])));
 $('tbody').innerHTML=periods.map(p=>'<tr><th scope="row">'+esc(p)+'</th>'+maps.map(m=>'<td>'+(m.has(p)?m.get(p).toFixed(1):'—')+'</td>').join('')+'</tr>').join('');
}
function parseRows(text){
 const cleaned=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
 const sep=(cleaned.split('\n')[0]||'').includes('\t')?'\t':',';
 const rows=[],row=[];let cell='',quoted=false;
 for(let i=0;i<cleaned.length;i++){
  const c=cleaned[i];
  if(c==='"'){
   if(quoted&&cleaned[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
  }else if(c===sep&&!quoted){row.push(cell);cell=''}
  else if(c==='\n'&&!quoted){row.push(cell);if(row.some(x=>String(x).trim()))rows.push(row.splice(0));else row.length=0;cell=''}
  else cell+=c;
 }
 if(quoted)throw Error('CSV 큰따옴표가 닫히지 않았습니다.');
 row.push(cell);if(row.some(x=>String(x).trim()))rows.push(row);
 return rows;
}
function parseCsv(text){
 const rows=parseRows(text);
 if(rows.length<3||rows.length>800)throw Error('첫 줄 제목과 2개 이상의 기간 데이터(최대 798개)가 필요합니다.');
 const cols=rows[0].map(v=>String(v).trim());
 if(cols.length<2||cols.length>6)throw Error('날짜 열 1개와 검색어 열 1~5개가 필요합니다.');
 const titles=cols.slice(1);
 if(titles.some(x=>x.length<2||x.length>40)||new Set(titles).size!==titles.length)throw Error('검색어 열 제목을 서로 다른 이름으로 입력하세요.');
 const records=rows.slice(1).map((row,i)=>{
  const period=String(row[0]||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(period)||Number.isNaN(Date.parse(period+'T00:00:00Z')))throw Error((i+2)+'행 날짜는 YYYY-MM-DD 형식이어야 합니다.');
  if(row.length!==cols.length)throw Error((i+2)+'행의 열 개수가 제목과 다릅니다.');
  const values=row.slice(1).map((str,index)=>{
   const raw=String(str).trim();
   if(raw==='')return null;
   const n=Number(raw);
   if(!Number.isFinite(n)||n<0||n>100)throw Error((i+2)+'행 '+titles[index]+'에는 0~100의 상대 지수만 입력하세요.');
   return n;
  });
  return {period,values};
 });
 const unique=new Set(records.map(x=>x.period));
 if(unique.size!==records.length)throw Error('중복된 날짜가 있습니다.');
 records.sort((a,b)=>a.period.localeCompare(b.period));
 const series=titles.map((title,i)=>({title,points:records.filter(v=>v.values[i]!==null).map(v=>({period:v.period,ratio:v.values[i]}))}));
 return normalizeData({series,startDate:records[0].period,endDate:records[records.length-1].period,note:'CSV 수동 가져오기; 파일 내용은 브라우저에서만 처리됩니다.'},'csv');
}
function exportCsv(){
 if(!dataset)return;
 const safe=x=>{const s=String(x??'');return '"'+(/^[=+@\-]/.test(s)?"'"+s:s).replace(/"/g,'""')+'"';};
 const maps=dataset.series.map(x=>new Map(x.points.map(v=>[v.period,v.ratio])));
 const rows=[['날짜',...dataset.series.map(x=>x.title)].map(safe).join(',')].concat(dataset.periods.map(date=>[date,...maps.map(m=>m.has(date)?m.get(date):'')].map(safe).join(',')));
 const blob=new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='momentum-search-trends.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function queryServer(){
 let terms;try{terms=parseTerms($('terms').value)}catch(e){updateStatus(e.message,'error');return}
 const range=dates($('period').value);
 const payload={...range,timeUnit:$('unit').value,keywordGroups:terms.map(groupName=>({groupName,keywords:[groupName]}))};
 const device=$('device').value;if(device!=='all')payload.device=device;
 const button=$('runTrend');button.disabled=true;button.textContent='공식 데이터 연결 확인 중…';updateStatus('네이버 데이터랩 API 연결과 제공 권한을 확인합니다.');
 try{
  const res=await fetch('/api/search-trends',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});
  const body=await res.json();
  if(!res.ok)throw Error(body.error||'공식 데이터 조회 실패');
  dataset=normalizeData(body,'naver');render();
  updateStatus('네이버 공식 데이터랩 검색어 추이를 불러왔습니다. 비교 기준을 확인하세요.','success');
 }catch(e){updateStatus(e.message||'데이터랩에 연결할 수 없습니다.','error')}
 finally{button.disabled=false;button.textContent='검색어 추이 조회하기 ↗'}
}
function bind(){
 $('trendForm').addEventListener('submit',e=>{e.preventDefault();queryServer()});
 $('copySearch').addEventListener('click',async()=>{
  try{
   const words=parseTerms($('terms').value),value=words.join(', ');
   await navigator.clipboard.writeText(value);
   updateStatus('검색어 '+words.length+'개를 복사했습니다. 네이버 공식 데이터랩에서도 검색할 수 있습니다.','success');
  }catch(e){$('terms').focus();$('terms').select();updateStatus('자동 복사가 제한되었거나 입력이 잘못되었습니다. 선택된 텍스트를 직접 복사할 수 있습니다.','error')}
 });
 $('csvFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>200000){$('uploadStatus').textContent='파일 크기가 200KB를 초과합니다.';return}
  try{
   const csv=await file.text();dataset=parseCsv(csv);render();
   $('uploadStatus').textContent='파일에서 '+dataset.series.length+'개 검색어를 읽었습니다. 업로드 없이 이 브라우저에서 표시합니다.';
   updateStatus('사용자 CSV 데이터를 그래프로 표시했습니다. 실제 출처·기간·기기 조건을 확인하세요.','success');
   $('chart').scrollIntoView({behavior:'smooth',block:'center'});
  }catch(e){$('uploadStatus').textContent='CSV 형식 오류: '+e.message}
 });
 $('export').addEventListener('click',exportCsv);
}
if(typeof window!=='undefined')window.MomentumTrendUtils={parseTerms,parseCsv,dates,normalizeData};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();}
})();
