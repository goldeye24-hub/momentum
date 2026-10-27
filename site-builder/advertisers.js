(function(){
'use strict';
const BASE_KEY='momentum-internal-crm-mvp-v1';
const COMMERCE_KEY='momentum-internal-crm-commerce-v1';
const editKey='momentum.crm.openCustomer';
const $=id=>document.getElementById(id);
let records=[],contracts=[],bundles=[],catalog=[],customProducts=[],opened='',lastFocus=null;
const escapeHtml=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const isTodayOrPast=date=>/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))&&date<=localToday();
function localToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function inNext30Days(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return false;const today=localToday();const now=new Date(today+'T12:00:00');const end=new Date(now);end.setDate(now.getDate()+30);return date>=today&&date<=[end.getFullYear(),String(end.getMonth()+1).padStart(2,'0'),String(end.getDate()).padStart(2,'0')].join('-')}
function read(key){try{let data=JSON.parse(localStorage.getItem(key)||'{}');return data&&typeof data==='object'?data:{}}catch{return {}}}
function reload(){
 const crm=read(BASE_KEY),commerce=read(COMMERCE_KEY);
 records=(Array.isArray(crm.customers)?crm.customers:[]).filter(x=>x&&x.id&&x.name).slice(0,10000);
 contracts=(Array.isArray(crm.contracts)?crm.contracts:[]).filter(x=>x&&x.customerId).slice(0,40000);
 bundles=(Array.isArray(commerce.bundles)?commerce.bundles:[]).filter(x=>x&&x.customerId).slice(0,10000);
 customProducts=Array.isArray(crm.customProducts)?crm.customProducts:[];
 render();
}
function productName(id){return [...catalog,...customProducts].find(p=>p.id===id)?.name||'계약 상품'}
function relatedContracts(customerId){return contracts.filter(c=>c.customerId===customerId)}
function relatedBundles(customerId){return bundles.filter(b=>b.customerId===customerId)}
function contractTotal(customerId){return relatedContracts(customerId).length+relatedBundles(customerId).length}
function contractNotes(c){
 const own=relatedContracts(c.id).map(x=>({
  id:x.id,kind:'single',name:productName(x.productId),status:x.status||'미등록',
  signedDate:x.signedDate||'',startDate:x.startDate||'',endDate:x.endDate||'',domainEnd:x.domainEnd||'',
  amount:num(x.amount),paid:num(x.paid),quantity:x.quantity==null?null:num(x.quantity),usedQuantity:x.usedQuantity==null?0:num(x.usedQuantity),unit:x.unit||'건',renewalCheckDate:x.renewalCheckDate||'',renewalCheckedAt:x.renewalCheckedAt||'',items:[]
 }));
 const multiple=relatedBundles(c.id).map(x=>({
  id:x.id,kind:'bundle',name:x.title||'묶음 상품 계약',status:x.status||'미등록',
  signedDate:x.signedDate||'',startDate:x.startDate||'',endDate:x.endDate||'',
  amount:Math.max(0,(Array.isArray(x.lines)?x.lines:[]).reduce((sum,line)=>sum+num(line.unitPrice)*num(line.quantity),0)-num(x.discount)),
  paid:num(x.paid),renewalCheckDate:x.renewalCheckDate||'',renewalCheckedAt:x.renewalCheckedAt||'',items:(Array.isArray(x.lines)?x.lines:[]).map(line=>({
   name:line.productName||productName(line.productId),
   startDate:line.startDate||x.startDate||'',endDate:line.endDate||x.endDate||'',
   quantity:num(line.quantity),unit:line.unit||'건',
   usedQuantity:Math.round((Array.isArray(line.usageLog)?line.usageLog:[]).filter(log=>log&&!log.canceled).reduce((sum,log)=>sum+num(log.quantity),0)*1000)/1000
  }))
 }));
 return own.concat(multiple);
}
const WON=new Intl.NumberFormat('ko-KR',{style:'currency',currency:'KRW',maximumFractionDigits:0});
function dateText(date){return /^\d{4}-\d{2}-\d{2}$/.test(String(date||''))?escapeHtml(date):'미등록'}
function daysFromToday(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return null;
 const end=new Date(date+'T12:00:00'),today=new Date(localToday()+'T12:00:00');
 return Number.isNaN(end.valueOf())?null:Math.round((end-today)/86400000);
}
function contractEndDate(x){
 const all=[x.endDate,...x.items.map(z=>z.endDate)].filter(z=>/^\d{4}-\d{2}-\d{2}$/.test(String(z||''))).sort();
 return all[0]||'';
}
function checkDate(x){
 if(/^\d{4}-\d{2}-\d{2}$/.test(String(x.renewalCheckDate||'')))return x.renewalCheckDate;
 const end=contractEndDate(x);if(!end)return '';
 const date=new Date(end+'T12:00:00');date.setDate(date.getDate()-7);
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function isTracked(x){return ['계약','진행중','완료','갱신완료'].includes(x.status)}
function checked(x){const check=checkDate(x);return !!(check&&x.renewalCheckedAt&&x.renewalCheckedAt>=check)}
function actionState(x){
 if(!isTracked(x))return 'inactive';
 const end=contractEndDate(x),confirm=checkDate(x),today=localToday();
 if(end&&end<today)return 'expired';
 if(confirm&&!checked(x)&&confirm<=today)return 'due';
 if(checked(x))return 'checked';
 if(confirm&&daysFromToday(confirm)<=30)return 'soon';
 return 'normal';
}
function actionLabel(x){
 const code=actionState(x);
 if(code==='expired')return ['기간 만료','danger'];
 if(code==='due')return ['재연장 확인 필요','danger'];
 if(code==='soon')return ['곧 확인','warning'];
 if(code==='checked')return ['확인 처리됨','complete'];
 if(code==='inactive')return [x.status,'muted'];
 return ['예정','muted'];
}

function contractEndLabel(x){
 const ends=x.kind==='bundle'&&x.items.length?x.items.map(z=>z.endDate).filter(Boolean):[x.endDate];
 const remaining=ends.map(daysFromToday).filter(z=>z!==null);
 if(['종료','보류','문의','견적','시안'].includes(x.status)||!remaining.length)return '';
 const nearest=Math.min(...remaining);
 return nearest<0?'<span class="term-chip term-expired">만료 '+Math.abs(nearest)+'일 경과</span>':
  nearest===0?'<span class="term-chip term-urgent">오늘 만료</span>':
  nearest<=30?'<span class="term-chip term-urgent">D-'+nearest+'</span>':
  '<span class="term-chip term-normal">D-'+nearest+'</span>';
}
function fmtQuantity(q){return Number(q).toLocaleString('ko-KR',{maximumFractionDigits:3})}
function usageParts(line){
 if(line.quantity===null||line.quantity===undefined||!Number.isFinite(Number(line.quantity))||Number(line.quantity)<=0)return null;
 const contracted=num(line.quantity),used=Math.max(0,num(line.usedQuantity)),remaining=Math.max(0,Math.round((contracted-used)*1000)/1000);
 return {contracted:fmtQuantity(contracted),used:fmtQuantity(used),remaining:fmtQuantity(remaining),unit:line.unit||'건',empty:remaining===0};
}
function usageHtml(line){
 const u=usageParts(line);
 if(!u)return '<span class="quantity-unregistered">수량 미등록</span>';
 return '<div class="usage-group"><span>계약 <b>'+u.contracted+escapeHtml(u.unit)+'</b></span><span>사용 <b>'+u.used+escapeHtml(u.unit)+'</b></span><span class="'+(u.empty?'usage-zero':'usage-left')+'">잔여 <b>'+u.remaining+escapeHtml(u.unit)+'</b></span></div>';
}
function contractUsageHtml(x){
 return x.kind==='bundle'?'<div class="bundle-usage-list">'+
 x.items.map(i=>'<div class="bundle-usage"><b>'+escapeHtml(i.name)+'</b>'+usageHtml(i)+'</div>').join('')+
 '</div>':usageHtml(x);
}
function contractCard(x){
 const fields=[
  ['계약일',dateText(x.signedDate)],
  ['시작일',dateText(x.startDate)],
  ['종료일',dateText(x.endDate)],
  ['재연장 확인',dateText(checkDate(x))+(x.renewalCheckDate?' (직접 지정)':' (자동)')],
  ['계약금액',WON.format(x.amount)]
 ].map(([label,value])=>'<div class="contract-cell"><span>'+label+'</span><strong>'+value+'</strong></div>').join('');
 const products=x.kind==='bundle'?
  '<div class="bundle-detail"><strong class="bundle-heading">포함된 상품 '+x.items.length+'개</strong>'+
  (x.items.length?x.items.map((line,index)=>'<div class="bundle-line"><span class="bundle-number">'+(index+1)+'</span><div><strong>'+escapeHtml(line.name)+'</strong><small>시작 '+dateText(line.startDate)+' · 종료 '+dateText(line.endDate)+'</small>'+usageHtml(line)</div></div>').join(''):'<p>등록된 세부 상품이 없습니다.</p>')+'</div>':'';
 return '<article class="detail-contract-card"><div class="detail-contract-title">'+
 '<div><span class="contract-kind">'+(x.kind==='bundle'?'묶음 계약':'단일 상품')+'</span><strong class="contract-product-name">'+escapeHtml(x.name)+'</strong></div>'+
 '<div class="contract-flags"><span class="contract-stage">'+escapeHtml(x.status)+'</span>'+contractEndLabel(x)+'</div></div>'+
 '<div class="contract-fields">'+fields+'</div>'+ 
 '<div class="contract-quantity-detail"><strong class="quantity-title">계약수량 · 사용수량 · 잔여수량</strong>'+contractUsageHtml(x)+'</div>'+
 '<div class="contract-footer"><span>수금 '+WON.format(x.paid)+'</span><span>미수 '+WON.format(Math.max(0,x.amount-x.paid))+'</span>'+
 (x.domainEnd?'<span>도메인 만료 '+dateText(x.domainEnd)+'</span>':'')+'</div>'+products+'</article>';
}
function contractSection(c){
 const contracts=contractNotes(c);
 contracts.sort((a,b)=>(a.endDate||'9999').localeCompare(b.endDate||'9999')||a.name.localeCompare(b.name,'ko'));
 const title='<div class="contract-section-title"><div><span class="eyebrow">CONTRACT OVERVIEW</span><h3>계약 상품 · 기간 <small>총 '+contracts.length+'건</small></h3></div><button class="small-button strong" type="button" data-create-contract="'+escapeHtml(c.id)+'">+ 상품 계약 등록 ↗</button></div>';
 return title+(contracts.length?'<div class="detail-contract-list">'+contracts.map(contractCard).join('')+'</div>':
  '<div class="detail-contract-empty"><strong>등록된 계약이 없습니다.</strong><p>광고주 정보와 별개로 계약 상품을 등록해야 계약일·종료일이 나타납니다.</p><button type="button" class="small-button strong" data-create-contract="'+escapeHtml(c.id)+'">+ 첫 상품 계약 등록하기 ↗</button></div>');
}
function summary(){
 $('metricTotal').textContent=records.length.toLocaleString('ko-KR');
 $('metricContracted').textContent=records.filter(c=>c.stage==='계약고객').length.toLocaleString('ko-KR');
 $('metricFollowup').textContent=records.filter(c=>isTodayOrPast(c.nextContact)).length.toLocaleString('ko-KR');
 $('metricExpiring').textContent=records.filter(c=>contractNotes(c).some(x=>!['종료','보류','문의','견적','시안'].includes(x.status)&&[x.endDate,...x.items.map(item=>item.endDate)].some(inNext30Days))).length.toLocaleString('ko-KR');
}
function resultRows(){
 const q=$('advertiserSearch').value.trim().toLocaleLowerCase('ko');
 const stage=$('stageFilter').value;
 const sort=$('sortFilter').value;
 const found=records.filter(c=>{
  if(stage&&c.stage!==stage)return false;
  const names=contractNotes(c).flatMap(t=>[t.name,...t.items.map(item=>item.name)]).join(' ');
  const hay=[c.name,c.region,c.industry,c.manager,c.source,c.stage,names].join(' ').toLocaleLowerCase('ko');
  return !q||hay.includes(q);
 });
 found.sort((a,b)=>{
  if(sort==='recent')return (b.createdAt||'').localeCompare(a.createdAt||'');
  if(sort==='followup')return (a.nextContact||'9999').localeCompare(b.nextContact||'9999')||a.name.localeCompare(b.name,'ko');
  if(sort==='contracts')return contractTotal(b.id)-contractTotal(a.id)||a.name.localeCompare(b.name,'ko');
  return a.name.localeCompare(b.name,'ko');
 });
 return found;
}

function allContractRows(){
 return records.flatMap(c=>contractNotes(c).map(x=>({...x,advertiserId:c.id,advertiserName:c.name,region:c.region||''})));
}
function statusPill(x){
 const [label,kind]=actionLabel(x);
 return '<span class="action-pill action-'+kind+'">'+escapeHtml(label)+'</span>';
}
function contractControls(x){
 const kind=escapeHtml(x.kind),id=escapeHtml(x.id),customer=escapeHtml(x.advertiserId);
 const mark=actionState(x)==='due'?
  '<button type="button" class="small-button action-mark" data-mark-renewal="'+id+'" data-mark-kind="'+kind+'">확인 처리 ✓</button>':'';
 return '<div class="schedule-buttons">'+mark+
 '<button type="button" class="small-button" data-open-advertiser="'+customer+'">상세</button>'+
 '<button type="button" class="small-button strong" data-edit-agreement="'+id+'" data-edit-kind="'+kind+'">계약 수정 ↗</button></div>';
}
function priorityOf(x){return {expired:0,due:1,soon:2,normal:3,checked:4,inactive:5}[actionState(x)]??9}
function renderContractSchedule(){
 const all=allContractRows();
 const due=all.filter(x=>['expired','due'].includes(actionState(x)))
  .sort((a,b)=>priorityOf(a)-priorityOf(b)||(checkDate(a)||'9999').localeCompare(checkDate(b)||'9999')||a.advertiserName.localeCompare(b.advertiserName,'ko'));
 $('actionCount').textContent=due.length+'건';
 $('actionQueue').innerHTML=due.length?due.map(x=>
  '<article class="queue-item"><div><div class="queue-head">'+statusPill(x)+'<strong>'+escapeHtml(x.advertiserName)+'</strong></div>'+
  '<p class="queue-product">'+escapeHtml(x.name)+(x.kind==='bundle'?' · '+x.items.map(i=>escapeHtml(i.name)).join(' / '):'')+'</p>'+
  '<small>계약금액 '+WON.format(x.amount)+' · 종료 '+dateText(contractEndDate(x))+' · 재연장 확인일 '+dateText(checkDate(x))+'</small>'+contractUsageHtml(x)+'</div>'+
  '<div class="queue-actions">'+contractControls(x)+'</div></article>').join(''):
  '<div class="queue-all-clear"><strong>지금 확인할 계약이 없습니다.</strong><p>확인 기한이 도래하거나 만료된 계약이 생기면 여기에 표시됩니다. 브라우저를 열었을 때만 자동 갱신됩니다.</p></div>';
 const q=$('contractSearch').value.trim().toLowerCase(),filter=$('contractActionFilter').value;
 const listed=all.filter(x=>{
  const text=[x.advertiserName,x.region,x.name,...x.items.map(i=>i.name)].join(' ').toLowerCase();
  if(q&&!text.includes(q))return false;
  const code=actionState(x);
  if(filter==='action')return code==='expired'||code==='due';
  if(filter==='soon')return code==='soon';
  if(filter==='checked')return code==='checked';
  return true;
 }).sort((a,b)=>priorityOf(a)-priorityOf(b)||
  (checkDate(a)||'9999').localeCompare(checkDate(b)||'9999')||
  a.advertiserName.localeCompare(b.advertiserName,'ko'));
 $('scheduleCount').textContent=listed.length+'건';
 $('scheduleEmpty').hidden=listed.length>0;
 $('contractScheduleRows').innerHTML=listed.map(x=>
  '<div class="schedule-row" role="row"><div role="cell" class="schedule-customer"><strong>'+escapeHtml(x.advertiserName)+'</strong>'+
  '<span class="schedule-product">'+escapeHtml(x.name)+'</span>'+
  (x.items.length?'<small class="schedule-line-items">'+x.items.map(i=>escapeHtml(i.name)).join(' · ')+'</small>':'')+'</div>'+
  '<div role="cell" class="schedule-money">'+WON.format(x.amount)+'</div>'+ 
  '<div role="cell" class="schedule-usage">'+contractUsageHtml(x)+'</div>'+
  '<div role="cell">'+dateText(x.signedDate)+'</div>'+
  '<div role="cell" class="schedule-end">'+dateText(contractEndDate(x))+
  (contractEndDate(x)?'<small>'+((daysFromToday(contractEndDate(x))<0)?'만료 '+Math.abs(daysFromToday(contractEndDate(x)))+'일 경과':'종료 D-'+daysFromToday(contractEndDate(x)))+'</small>':'')+'</div>'+
  '<div role="cell" class="schedule-check"><strong>'+dateText(checkDate(x))+'</strong><small>'+
  (x.renewalCheckDate?'직접 지정':'종료 7일 전 자동')+
  (x.renewalCheckedAt?' · 최근 확인 '+dateText(x.renewalCheckedAt):'')+'</small></div>'+
  '<div role="cell">'+statusPill(x)+'</div>'+
  '<div role="cell">'+contractControls(x)+'</div></div>').join('');
}
function markRenewal(kind,id){
 const key=kind==='bundle'?COMMERCE_KEY:BASE_KEY;
 const raw=read(key),group=kind==='bundle'?'bundles':'contracts';
 if(!Array.isArray(raw[group]))return;
 const row=raw[group].find(x=>x.id===id);if(!row)return;
 row.renewalCheckedAt=localToday();
 try{localStorage.setItem(key,JSON.stringify(raw));reload();}
 catch{window.alert('확인 처리 내역을 저장하지 못했습니다. CRM 데이터 백업과 브라우저 저장 공간을 확인하세요.')}
}
function contractAction(ev){
 const btn=ev.target.closest('button');if(!btn)return;
 const data=btn.dataset;
 if(data.openAdvertiser){details(data.openAdvertiser,btn);return}
 if(data.markRenewal){
  const kind=data.markKind;
  if(!['single','bundle'].includes(kind))return;
  if(!window.confirm('재연장 협의 또는 확인 작업을 실제로 완료했습니까? 기록만 저장하며 계약이 자동 연장되지는 않습니다.'))return;
  markRenewal(kind,data.markRenewal);return;
 }
 if(data.editAgreement){
  const key=data.editKind==='bundle'?'momentum.crm.editBundle':'momentum.crm.editContract';
  try{sessionStorage.setItem(key,data.editAgreement)}catch{}
  location.assign('/admin/crm/');
 }
}

function render(){
 summary();renderContractSchedule();
 const found=resultRows();
 $('resultCount').textContent=found.length.toLocaleString('ko-KR')+'개 표시';
 $('emptyState').hidden=found.length>0;
 $('advertiserRows').innerHTML=found.map(c=>{
  const stage=c.stage||'잠재고객';
  const badge=stage==='계약고객'?'stage--contracted':stage==='견적중'?'stage--quote':stage==='보류'?'stage--hold':'';
  return '<tr><td><strong class="customer-name">'+escapeHtml(c.name)+'</strong><span class="small-muted">'+escapeHtml(c.industry||'업종 미등록')+'</span></td>'+
  '<td>'+escapeHtml(c.region||'-')+'</td>'+
  '<td><span class="stage '+badge+'">'+escapeHtml(stage)+'</span></td>'+
  '<td>'+escapeHtml(c.manager||'-')+'</td>'+
  '<td><span class="contract-count">'+contractTotal(c.id)+'건</span></td>'+
  '<td class="'+(isTodayOrPast(c.nextContact)?'contact-due':'')+'">'+escapeHtml(c.nextContact||'미등록')+'</td>'+
  '<td class="right"><div class="row-actions"><button class="small-button" type="button" data-detail="'+escapeHtml(c.id)+'">상세</button><button class="small-button strong" type="button" data-edit="'+escapeHtml(c.id)+'">수정 ↗</button></div></td></tr>';
 }).join('');
}
function field(label,value){return '<div class="detail-pair"><small>'+escapeHtml(label)+'</small><strong>'+escapeHtml(value||'-')+'</strong></div>'}
function details(id,origin){
 const c=records.find(x=>x.id===id);if(!c)return;
 lastFocus=origin||document.activeElement;opened=id;
 $('detailTitle').textContent=c.name;
 $('detailContent').innerHTML=contractSection(c)+
 '<section class="customer-details"><h3 class="detail-subhead">광고주 기본정보</h3><div class="detail-grid">'+
 field('영업 단계',c.stage)+field('업종',c.industry)+field('지역',c.region)+field('담당자',c.manager)+
 field('연락처',c.phone)+field('이메일',c.email)+field('유입 경로',c.source)+field('다음 연락',c.nextContact)+
 field('거래처 반응',c.feedback)+field('소개해 준 업체',c.referredBy)+'</div>'+
 (c.notes?'<h3 class="detail-subhead">메모</h3><p class="detail-note">'+escapeHtml(c.notes)+'</p>':'')+'</section>';
 const dlg=$('detailsDialog');if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');
}
function closeDialog(){
 const dlg=$('detailsDialog');if(dlg.open&&typeof dlg.close==='function')dlg.close();else dlg.removeAttribute('open');
 if(lastFocus?.isConnected)lastFocus.focus();
}
function editCustomer(id){
 if(!records.some(c=>c.id===id))return;
 try{sessionStorage.setItem(editKey,id)}catch{}
 location.assign('/admin/crm/');
}
function setup(){
 $('contractSearch').addEventListener('input',renderContractSchedule);
 $('contractActionFilter').addEventListener('change',renderContractSchedule);
 $('actionQueue').addEventListener('click',contractAction);
 $('contractScheduleRows').addEventListener('click',contractAction);
  $('advertiserSearch').addEventListener('input',render);
 $('stageFilter').addEventListener('change',render);
 $('sortFilter').addEventListener('change',render);
 $('refreshList').addEventListener('click',reload);
 $('advertiserRows').addEventListener('click',ev=>{
  const target=ev.target.closest('button');if(!target)return;
  if(target.dataset.detail)details(target.dataset.detail,target);
  if(target.dataset.edit)editCustomer(target.dataset.edit);
 });
 $('closeDetails').addEventListener('click',closeDialog);
 $('closeDetailsBottom').addEventListener('click',closeDialog);
 $('editAdvertiser').addEventListener('click',()=>editCustomer(opened));
 $('detailContent').addEventListener('click',ev=>{
  const btn=ev.target.closest('button[data-create-contract]');if(!btn)return;
  const id=btn.dataset.createContract;
  if(!records.some(c=>c.id===id))return;
  try{sessionStorage.setItem('momentum.crm.newContract',id)}catch{}
  location.assign('/admin/crm/');
 });
 $('detailsDialog').addEventListener('click',ev=>{if(ev.target===$('detailsDialog'))closeDialog()});
 window.addEventListener('storage',ev=>{if(!ev.key||[BASE_KEY,COMMERCE_KEY].includes(ev.key))reload()});
 window.addEventListener('pageshow',reload);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)reload()});
 fetch('/admin/assets/products.json',{credentials:'same-origin',cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Product data unavailable');return r.json()}).then(json=>{catalog=Array.isArray(json.products)?json.products:[];render()}).catch(()=>render());
 reload();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();