(function(){
'use strict';
const $=x=>document.getElementById(x),key='momentum-rank-observations-v1',e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let history=[];try{const v=JSON.parse(localStorage.getItem(key)||'[]');history=Array.isArray(v)?v.slice(0,300):[]}catch{}
const val=id=>$(id).value.trim(),norm=s=>String(s||'').normalize('NFKC').replace(/^[ \t]*\d+\s*[.)\]:-]\s*/gm,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
const s=id=>$(id).textContent;
function safeKind(){return val('kind')==='blog'?'blog':'place'}
function currentMethod(){return document.querySelector('input[name="method"]:checked')?.value||'observed'}
function searchLink(){return (safeKind()==='place'&&document.getElementById('rankScope')?.value==='map'?'https://map.naver.com/p/search/':'https://search.naver.com/search.naver?query=')+encodeURIComponent(val('keyword'))}
function store(){
 try{localStorage.setItem(key,JSON.stringify(history.slice(0,300)));return true}catch{return false}
}
function updateSearch(){$('openNaver').href=searchLink()}
function switchMode(){
 const type=safeKind(),method=currentMethod();if(type==='place'&&method==='api'){document.querySelector('input[value="live"][name="method"]').checked=true}if(type==='blog'&&method==='live'){document.querySelector('input[value="observed"][name="method"]').checked=true}
 document.querySelector('input[value="api"][name="method"]').disabled=type==='place';
 document.querySelector('input[value="live"][name="method"]').disabled=type==='blog';
 for(const m of ['live','observed','paste','api'])$(m+'Panel').hidden=currentMethod()!==m;
 $('target').placeholder=type==='blog'?'https://blog.naver.com/아이디/글번호':'https://map.naver.com/p/entry/place/1234567890 또는 숫자 ID';
 updateSearch();paint()
}
document.querySelectorAll('[name="method"]').forEach(x=>x.addEventListener('change',switchMode));$('kind').addEventListener('change',switchMode);$('keyword').addEventListener('input',updateSearch);$('target').addEventListener('input',paint);$('rankScope').addEventListener('change',()=>{updateSearch();paint()});
function cleanLine(line){return String(line||'').replace(/^\s*(?:\d+\s*[.)\]:-]|[-•*])\s*/,'').trim()}
function fromPaste(raw,target){
 const names=String(raw).split(/\r?\n/g).map(cleanLine).filter(Boolean).slice(0,200);
 const exact=names.map((name,i)=>({name,index:i+1})).filter(x=>norm(x.name)===norm(target));
 if(!names.length)throw Error('순서대로 업체 이름 목록을 붙여넣으세요.');
 if(exact.length>1)throw Error('동일 이름이 두 곳 이상 발견됐습니다. 실제 매장을 구분해 순위를 직접 입력하세요.');
 return {rank:exact.length?exact[0].index:null,depth:names.length,message:exact.length?'붙여넣은 목록의 '+exact[0].index+'번째입니다.':'붙여넣은 '+names.length+'개 목록 안에서 동일 상호를 찾지 못했습니다.'};
}
function format(r){return r.rank==null?'미확인':r.rank+'위'}
function currentScope(){return safeKind()==='place'?(currentMethod()==='live'?val('rankScope'):'manual_place'):(currentMethod()==='api'?'blog_api':'manual_blog')}
function match(r){return r.kind===safeKind()&&r.keyword===val('keyword')&&r.target===val('target')&&(r.scope||'manual_place')===currentScope()}
function paintTrend(all){
 const mount=$('rankTrend');if(!mount)return;
 const usable=all.filter(x=>typeof x.rank==='number'&&x.rank>0).slice(0,14).reverse();
 if(usable.length<2){mount.textContent='동일 키워드·대상에서 2회 이상 측정하면 순위 변화 그래프가 나타납니다.';return}
 const ranks=usable.map(x=>x.rank),lo=Math.min(...ranks),hi=Math.max(...ranks),span=Math.max(1,hi-lo);
 const w=800,h=225,p=32;
 const points=usable.map((x,i)=>[p+i*(w-2*p)/Math.max(usable.length-1,1),p+(x.rank-lo)/span*(h-2*p)]);
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.setAttribute('role','img');svg.setAttribute('aria-label','측정 순위 변화: '+ranks.join('위, ')+'위');svg.style.width='100%';
 for(const fraction of [0,.5,1]){
  const line=document.createElementNS(ns,'line');const y=p+fraction*(h-2*p);
  for(const [k,v] of Object.entries({x1:p,x2:w-p,y1:y,y2:y,stroke:'#dfeaf0','stroke-dasharray':'5 5'}))line.setAttribute(k,v);
  svg.appendChild(line);
 }
 const path=document.createElementNS(ns,'polyline');path.setAttribute('points',points.map(x=>x.join(',')).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','#286cdf');path.setAttribute('stroke-width','4');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.appendChild(path);
 points.forEach((pos,i)=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',pos[0]);c.setAttribute('cy',pos[1]);c.setAttribute('r','6');c.setAttribute('fill','#286cdf');const t=document.createElementNS(ns,'title');t.textContent=new Date(usable[i].at).toLocaleString('ko-KR')+' · '+usable[i].rank+'위';c.appendChild(t);svg.appendChild(c)});
 mount.replaceChildren(svg);
 const cap=document.createElement('p');cap.className='trend-caption';cap.textContent='관측 '+usable.length+'건 · '+ranks[0]+'위 → '+ranks[ranks.length-1]+'위 (실제 저장된 관측 기록)';mount.appendChild(cap);
}
function paint(){
 const all=history.filter(match),recent=all[0],prior=all[1];
 paintTrend(all);
 $('latest').textContent=recent?format(recent):'—';$('latestNote').textContent=recent?recent.methodLabel:'측정되지 않음';
 $('samples').textContent=all.length+'회';
 $('delta').textContent=recent?.rank!=null&&prior?.rank!=null?(prior.rank-recent.rank>0?'▲ '+(prior.rank-recent.rank):prior.rank-recent.rank<0?'▼ '+(recent.rank-prior.rank):'변동 없음'):'—';
 $('measuredAt').textContent=recent?new Date(recent.at).toLocaleString('ko-KR'):'아직 측정 전';
 const names={place:'플레이스',blog:'블로그'};
 $('history').innerHTML=history.length?history.slice(0,100).map(r=>'<tr><td>'+e(new Date(r.at).toLocaleString('ko-KR'))+'</td><td>'+e(names[r.kind]||r.kind)+'</td><td>'+e(r.keyword)+'</td><td>'+e(r.target)+'</td><td><strong>'+e(format(r))+'</strong></td><td>'+e(r.methodLabel)+'</td><td>'+e(r.depth)+'</td></tr>').join(''):'<tr><td colspan="7" class="empty">저장된 측정 기록이 없습니다.</td></tr>';
}
function add(data){
 const item={kind:safeKind(),keyword:val('keyword'),target:val('target'),scope:currentScope(),rank:data.rank,depth:data.depth,methodLabel:data.methodLabel,at:new Date().toISOString()};
 history.unshift(item);history=history.slice(0,300);
 const saved=store();paint();
 $('message').textContent=(data.message||'')+' · '+(saved?'현재 브라우저에 기록했습니다.':'브라우저 저장에 실패했습니다. CSV로 내보내세요.');
}
$('rankForm').addEventListener('submit',async ev=>{
 ev.preventDefault();const keyword=val('keyword'),target=val('target'),kind=safeKind(),method=currentMethod();
 if(keyword.length<2||!target){$('message').textContent='검색어와 매장명(또는 블로그 URL)을 입력하세요.';return}
 const btn=$('measure');btn.disabled=true;btn.textContent='확인 중…';
 try{
  if(method==='live'){
   if(kind!=='place')throw Error('플레이스 자동 측정만 지원합니다.');
   $('message').textContent='실제 네이버 검색 화면을 확인하고 있습니다…';
   const response=await fetch('/api/place-rank-live',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keyword,placeUrl:target,scope:val('rankScope')})});
   const result=await response.json();
   if(!response.ok)throw Error(result.message||'자동 측정 실패');
   if(!['ranked','not_in_block'].includes(result.status)){$('message').textContent=result.message||'자동 측정이 완료되지 않았습니다.';return}
   add({rank:result.rank,depth:result.maxObservedRank||result.observedCount,methodLabel:val('rankScope')==='map'?'네이버지도 검색 목록 자동 관측':'PC 통합검색 플레이스 블록 자동 관측',message:result.message});
  }else if(method==='observed'){
   const found=val('found')==='yes',rank=found?Number(val('rankNumber')):null,depth=Number(val('depth'));
   if(found&&(!Number.isInteger(rank)||rank<1||rank>depth))throw Error('확인한 순위가 1~'+depth+' 안에 있어야 합니다.');
   add({rank,depth,methodLabel:'네이버 화면 직접 확인',message:found?'직접 확인한 '+rank+'위를 기록했습니다.':'상위 '+depth+'에서 미확인으로 기록했습니다.'});
  }else if(method==='paste'){
   if(kind==='blog'&&!target.includes('blog.naver.com'))throw Error('블로그는 URL을 입력해 주세요.');
   const data=fromPaste(val('list'),target);
   add({...data,methodLabel:'검색 결과 붙여넣기'});
  }else{
   if(kind!=='blog')throw Error('API 자동 조회는 블로그 전용입니다.');
   const response=await fetch('/api/blog-rank-observation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keyword,target})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'조회 실패');
   if(result.status!=='measured'){$('message').textContent=result.message;return}
   add({rank:result.rank,depth:result.depth,methodLabel:'네이버 블로그 검색 API',message:result.message});
  }
 }catch(err){$('message').textContent=err.message}
 finally{btn.disabled=false;btn.textContent='순위 측정·기록하기 →'}
});
$('clearHistory').addEventListener('click',()=>{if(!confirm('이 브라우저의 순위 기록을 모두 삭제할까요?'))return;history=[];store();paint();$('message').textContent='기록을 비웠습니다.'});
$('exportCsv').addEventListener('click',()=>{const head=['관측일시','채널','키워드','대상','측정 범위','순위','측정 방법','확인 범위'];const quote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';const rows=[head.map(quote).join(',')];for(const r of history)rows.push([r.at,r.kind,r.keyword,r.target,r.scope||'legacy',r.rank,r.methodLabel,r.depth].map(quote).join(','));const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='momentum-search-ranking-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)});
switchMode();
})();