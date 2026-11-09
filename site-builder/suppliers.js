(function(){
'use strict';
const KEY='momentum-internal-crm-commerce-v1';
const BASE_KEY='momentum-internal-crm-mvp-v1';
const EDIT_KEY='momentum.crm.editSupplier';
const $=id=>document.getElementById(id);
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let suppliers=[],bundles=[],customers=[],selectedId='',lastFocus=null;
function read(key){try{const obj=JSON.parse(localStorage.getItem(key)||'{}');return obj&&typeof obj==='object'?obj:{}}catch{return {}}}
function ratesOf(s){return Array.isArray(s.rates)?s.rates.filter(r=>r&&(r.productId||r.productName)).slice(0,150):[]}
function linkedBundles(s){return bundles.filter(b=>Array.isArray(b.lines)&&b.lines.some(l=>l&&l.supplierId===s.id))}
function activeLinked(s){return linkedBundles(s).filter(b=>!['종료','견적'].includes(b.status))}
function updated(s){return typeof s.updatedAt==='string'?s.updatedAt:''}
function refresh(){
 const info=read(KEY),base=read(BASE_KEY);
 suppliers=(Array.isArray(info.suppliers)?info.suppliers:[]).filter(s=>s&&s.id&&s.name).slice(0,1500);
 bundles=(Array.isArray(info.bundles)?info.bundles:[]).filter(b=>b&&b.id).slice(0,10000);
 customers=(Array.isArray(base.customers)?base.customers:[]).filter(c=>c&&c.id).slice(0,10000);
 render();
}
function safeUrl(url){return typeof url==='string'&&/^https:\/\/[^\s"'<>]+$/i.test(url)?url:''}
function rateLabel(r){return (r.productName||'상품명 미등록')+' · '+Number(r.cost||0).toLocaleString('ko-KR')+'원/'+(r.unit||'건')}
function linkedCount(s){return linkedBundles(s).length}
function matches(s,q){
 return [s.name,s.manager,s.phone,s.orderMethod,...ratesOf(s).map(r=>r.productName)].join(' ').toLocaleLowerCase('ko').includes(q);
}
function filtered(){
 const query=$('supplierSearch').value.trim().toLocaleLowerCase('ko'),status=$('supplierFilter').value,order=$('supplierSort').value;
 const rows=suppliers.filter(s=>(status==='all'||(status==='archived'?!!s.archived:!s.archived))&&matches(s,query));
 rows.sort((a,b)=>order==='rates'?ratesOf(b).length-ratesOf(a).length||a.name.localeCompare(b.name,'ko'):
  order==='recent'?updated(b).localeCompare(updated(a))||a.name.localeCompare(b.name,'ko'):
  a.name.localeCompare(b.name,'ko'));
 return rows;
}
function summary(){
 $('supplierTotal').textContent=suppliers.length.toLocaleString('ko-KR');
 $('supplierActive').textContent=suppliers.filter(s=>!s.archived).length.toLocaleString('ko-KR');
 $('supplierArchived').textContent=suppliers.filter(s=>!!s.archived).length.toLocaleString('ko-KR');
 $('supplierRateCount').textContent=suppliers.reduce((n,s)=>n+ratesOf(s).length,0).toLocaleString('ko-KR');
}
function render(){
 summary();
 const list=filtered();
 $('supplierShown').textContent=list.length.toLocaleString('ko-KR')+'개 표시';
 $('supplierEmpty').hidden=list.length>0;
 $('supplierRows').innerHTML=list.map(s=>{
  const price=ratesOf(s);
  const lines=price.length?price.slice(0,2).map(r=>'<span class="rate-line">'+esc(rateLabel(r))+'</span>').join('')+
   (price.length>2?'<span class="small-muted">외 '+(price.length-2)+'개 상품</span>':''):'<span class="small-muted">공급단가 미등록</span>';
  return '<tr><td><strong class="customer-name">'+esc(s.name)+'</strong><span class="small-muted">'+(s.archived?'보관된 협력업체':'거래 가능 업체')+'</span></td>'+
   '<td><strong class="supplier-person">'+esc(s.manager||'담당자 미등록')+'</strong><span class="small-muted">'+esc(s.phone||'연락처 미등록')+'</span></td>'+
   '<td>'+esc(s.orderMethod||'-')+'</td>'+
   '<td class="supplier-rates">'+lines+'</td>'+
   '<td><span class="contract-count">'+linkedCount(s)+'건</span><small class="small-muted">진행 관련 '+activeLinked(s).length+'건</small></td>'+
   '<td><span class="stage '+(s.archived?'stage--hold':'stage--contracted')+'">'+(s.archived?'보관':'거래 가능')+'</span></td>'+
   '<td class="right"><div class="row-actions"><button class="small-button" type="button" data-detail="'+esc(s.id)+'">상세</button><button class="small-button strong" type="button" data-edit="'+esc(s.id)+'">수정 ↗</button></div></td></tr>';
 }).join('');
}
function pair(label,value){return '<div class="detail-pair"><small>'+esc(label)+'</small><strong>'+esc(value||'-')+'</strong></div>'}
function openDetails(id,button){
 const s=suppliers.find(x=>x.id===id);if(!s)return;
 selectedId=id;lastFocus=button||document.activeElement;
 $('supplierDetailTitle').textContent=s.name;
 const prices=ratesOf(s);
 const safe=safeUrl(s.orderUrl);
 const link=safe?'<a href="'+esc(safe)+'" target="_blank" rel="noopener noreferrer" class="supplier-order-link">접수 웹사이트 열기 ↗</a>':'';
 const connected=linkedBundles(s);
 const base='<section class="supplier-detail-section"><div class="detail-grid">'+
  pair('거래 상태',s.archived?'보관':'거래 가능')+pair('담당자',s.manager)+
  pair('연락처',s.phone)+pair('접수 방식',s.orderMethod)+
  pair('은행명',s.bank)+pair('등록 상품',prices.length+'개')+'</div>'+link+'</section>';
 const costs='<section class="supplier-detail-section"><h3 class="detail-subhead">취급 상품·공급단가 <small>'+prices.length+'개</small></h3>'+
 (prices.length?'<div class="supplier-rate-list">'+prices.map(r=>'<div class="supplier-rate-card"><strong>'+esc(r.productName||'상품명 미등록')+'</strong><span>'+Number(r.cost||0).toLocaleString('ko-KR')+'원 / '+esc(r.unit||'건')+'</span></div>').join('')+'</div>':
 '<p class="detail-note">등록된 상품별 공급단가가 없습니다.</p>')+'</section>';
 const contracts='<section class="supplier-detail-section"><h3 class="detail-subhead">연결된 묶음 계약 <small>'+connected.length+'건</small></h3>'+
 (connected.length?connected.slice(0,25).map(b=>{
  const c=customers.find(x=>x.id===b.customerId);
  const found=(Array.isArray(b.lines)?b.lines:[]).filter(l=>l&&l.supplierId===s.id);
  return '<div class="supplier-linked"><strong>'+esc(b.title||'계약명 미등록')+'</strong><span>'+esc(c?.name||'광고주 미등록')+' · '+esc(b.status||'-')+' · '+esc(found.map(l=>l.productName||'상품').join(' / '))+'</span></div>';
 }).join(''):'<p class="detail-note">연결된 묶음 계약이 없습니다.</p>')+
 (connected.length>25?'<p class="small-muted">최근 목록 중 25건까지 표시됩니다.</p>':'')+'</section>';
 $('supplierDetailContent').innerHTML=base+costs+contracts+
 (s.notes?'<section class="supplier-detail-section"><h3 class="detail-subhead">업무 메모</h3><p class="detail-note">'+esc(s.notes)+'</p></section>':'');
 const modal=$('supplierDialog');if(typeof modal.showModal==='function')modal.showModal();else modal.setAttribute('open','');
}
function closeDetails(){
 const modal=$('supplierDialog');if(modal.open&&typeof modal.close==='function')modal.close();else modal.removeAttribute('open');
 if(lastFocus?.isConnected)lastFocus.focus();
}
function editSupplier(id){
 if(!suppliers.some(s=>s.id===id))return;
 try{sessionStorage.setItem(EDIT_KEY,id)}catch{}
 location.assign('/admin/crm/');
}
function setup(){
 $('supplierSearch').addEventListener('input',render);
 $('supplierFilter').addEventListener('change',render);
 $('supplierSort').addEventListener('change',render);
 $('refreshSuppliers').addEventListener('click',refresh);
 $('supplierRows').addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.detail)openDetails(button.dataset.detail,button);
  if(button.dataset.edit)editSupplier(button.dataset.edit);
 });
 $('editSupplier').addEventListener('click',()=>editSupplier(selectedId));
 $('closeSupplier').addEventListener('click',closeDetails);
 $('closeSupplierBottom').addEventListener('click',closeDetails);
 $('supplierDialog').addEventListener('click',e=>{if(e.target===$('supplierDialog'))closeDetails()});
 window.addEventListener('storage',event=>{if(!event.key||[KEY,BASE_KEY].includes(event.key))refresh()});
 window.addEventListener('pageshow',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();