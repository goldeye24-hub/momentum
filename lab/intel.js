"use strict";
(()=>{
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','>':'&gt;','<':'&lt;','"':'&quot;',"'":'&#39;'}[ch]));
const navSearch=term=>'https://search.naver.com/search.naver?query='+encodeURIComponent(term);
let result=null,lastRequest=0;
function getResult(){return result}
function renderKeywords(){
 if(!result||!$('keywordIdeas'))return false;
 const kws=result.keywords||[];
 $('keywordIdeas').className='';
 $('keywordIdeas').innerHTML='<p class="hint">입력된 상호·URL에서 자체 생성한 키워드 후보입니다. 실제 검색량·노출 순위는 조회하지 않았습니다.</p>'+
 '<div class="own-keyword-table">'+kws.map(x=>'<div class="own-keyword-tile"><strong>'+esc(x.keyword)+'</strong><small>'+esc(x.group)+' · 자체 조합</small>'+
 '<a href="'+esc(navSearch(x.keyword))+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(x.keyword)+' 네이버 검색 열기">네이버 직접 검색 ↗</a></div>').join('')+'</div>';
 return true;
}
function render(){
 if(!result)return;
 const r=result,merchant=r.merchant,identity=merchant.identity;
 const el=$('ownIntelStatus');if(!el)return;
 el.className='own-intel-status ready';
 el.textContent='자체 분석 완료 · 네이버 데이터를 수집하지 않고 입력한 상호·URL만 사용했습니다.';
 const facts=[
 ['입력 링크 종류',identity.provider==='naver'?'네이버 플레이스':identity.provider==='kakao'?'카카오맵':'구글 지도',identity.urlType==='shortlink'?'단축 URL · ID 미확인':'고객 제공 URL'],
 ['플레이스 ID',identity.placeId||'미확인',identity.placeId?'링크 문자열에서 추출 · 업체 실재 검증 아님':'API·자동 스크래핑 미사용'],
 ['지역·업종 추정',(merchant.region.value||'지역 미확인')+' / '+(merchant.industry.label||'업종 미확인'),'상호명 또는 URL의 문구로 추정 · 실제 소재지 미확인']
 ];
 $('ownIntelFacts').innerHTML=facts.map(([l,v,n])=>'<div class="own-fact"><div class="lab">'+esc(l)+'</div><strong>'+esc(v)+'</strong><small>'+esc(n)+'</small></div>').join('');
 $('ownIntelKeywords').className='';
 $('ownIntelKeywords').innerHTML=r.keywords.slice(0,8).map(item=>
 '<div class="own-kw"><div><strong>'+esc(item.keyword)+'</strong><small>'+esc(item.group)+' · 월간 검색량 미측정</small></div><a href="'+esc(navSearch(item.keyword))+'" target="_blank" rel="noopener noreferrer">검색 열기 ↗</a></div>').join('');
 $('ownIntelActions').className='';
 $('ownIntelActions').innerHTML=r.actions.slice(0,4).map((a,i)=>'<div class="own-act"><span class="own-num">'+(i+1)+'</span><div><strong>'+esc(a.headline)+'</strong><p>'+esc(a.detail)+'</p></div></div>').join('');
 $('ownIntelCampaigns').innerHTML='<h4>매장에 맞춰 구성한 홍보 실행안</h4><div class="own-campaigns">'+r.campaigns.map((x,i)=>
 '<div class="own-campaign"><strong>'+esc(x.channel)+'</strong><p><b>'+esc(x.headline)+'</b></p><p>'+esc(x.body)+'</p><small>'+esc(x.outcome)+'</small>'+
 '<button type="button" class="btn sml alt" style="display:block;margin-top:10px" data-own-studio="'+i+'">홍보물 편집에 적용 ↗</button></div>').join('')+'</div>';
 $('ownIntelCampaigns').querySelectorAll('[data-own-studio]').forEach(b=>b.addEventListener('click',()=>{
 const x=r.campaigns[Number(b.dataset.ownStudio)];
 const mapped={studioBusiness:merchant.name,studioHeadline:x.headline,studioSubline:x.body,studioCTA:'문의 및 예약 안내'};
 for(const [id,value] of Object.entries(mapped)){
  const input=$(id);if(input){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))}
 }
 document.querySelector('[data-view="creative"]')?.click();
 }));
 renderKeywords();
 document.dispatchEvent(new CustomEvent('momentum:intel-ready',{detail:{name:merchant.name,placeUrl:document.getElementById('placeUrl')?.value||''}}));
 if(typeof window.MomentumCustomerReport==='function')window.MomentumCustomerReport();
}
async function run(){
 const name=String($('storeName')?.value||'').trim();
 const placeUrl=String($('placeUrl')?.value||'').trim();
 if(name.length<2||!/^https:\/\//.test(placeUrl))return;
 result=null;lastRequest+=1;
 const which=lastRequest,stat=$('ownIntelStatus');
 if(stat){stat.className='own-intel-status';stat.textContent='모멘텀 자체 엔진이 입력한 상호와 링크를 분석하는 중입니다.'}
 try{
  const res=await fetch('/api/own-intelligence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,placeUrl})});
  if(res.status===401||res.status===403)throw Error('현재 사이트 접근 보호 때문에 진단 API를 사용할 수 없습니다.');
  const body=await res.json();
  if(which!==lastRequest)return;
  if(!res.ok)throw Error(body.error||'자체 분석 오류');
  result=body;
  render();
 }catch(err){
  if(which!==lastRequest)return;
  if(stat){stat.className='own-intel-status error';stat.textContent='자체 엔진 연결을 확인할 수 없습니다. '+(err.message||'')}
 }
}
function init(){
 const form=$('auditForm');if(!form)return;
 form.addEventListener('submit',()=>{void run()});
}
window.MomentumIntel={getResult,renderKeywords};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
