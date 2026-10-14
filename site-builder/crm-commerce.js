(function(){
'use strict';
const KEY='momentum-internal-crm-commerce-v1';
const CRM_KEY='momentum-internal-crm-mvp-v1';
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=(v,n=300)=>String(v==null?'':v).trim().slice(0,n);
const won=v=>Math.round(Number(v||0)).toLocaleString('ko-KR')+'원';
const uniq=()=>window.crypto&&window.crypto.randomUUID?window.crypto.randomUUID():'x'+Date.now().toString(36)+Math.random().toString(36).slice(2);
const numeric=(v,max=1e10)=>Math.min(max,Math.max(0,Math.round(Number(v)||0)));
const decimal=(v,max=1e6)=>Math.min(max,Math.max(0,Math.round((Number(v)||0)*1000)/1000));
const numText=v=>Number(v||0).toLocaleString('ko-KR',{maximumFractionDigits:3});
const iso=()=>{let d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const validDate=v=>{const s=clean(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '';const d=new Date(s+'T12:00:00');return Number.isNaN(d.getTime())||d.getFullYear()!==+s.slice(0,4)||d.getMonth()+1!==+s.slice(5,7)||d.getDate()!==+s.slice(8)?'':s};
const safeUrl=v=>/^https:\/\/[^ \s"'<>]+$/i.test(clean(v))?clean(v,300):'';
const fresh=()=>({version:1,suppliers:[],bundles:[]});
let db=fresh(),products=[],lineSeed=0,currentUsage=null,searchTerm='';
function notice(message){$('notice').textContent=message}
function readBase(){try{return JSON.parse(localStorage.getItem(CRM_KEY)||'{}')}catch{return {}}}
function customers(){return Array.isArray(readBase().customers)?readBase().customers.filter(x=>x.id&&x.name):[]}
function catalogs(){
 const own=readBase().customProducts;
 return products.concat(Array.isArray(own)?own.filter(x=>x.id&&x.name):[]);
}
function productInfo(id){return catalogs().find(p=>p.id===id)}
function supplierInfo(id){return db.suppliers.find(s=>s.id===id)}
function customerInfo(id){return customers().find(c=>c.id===id)}
function options(values,current,placeholder){
 return '<option value="">'+esc(placeholder||'선택')+'</option>'+values.map(p=>'<option value="'+esc(p.id)+'"'+(p.id===current?' selected':'')+'>'+esc(p.name)+'</option>').join('');
}
function clone(o){return JSON.parse(JSON.stringify(o))}
function normalizeSupplier(o){
 const rates=(Array.isArray(o.rates)?o.rates:[]).slice(0,150).map(r=>({
  id:clean(r.id,110)||uniq(),productId:clean(r.productId,100),productName:clean(r.productName,110),
  unit:clean(r.unit,18)||'건',cost:numeric(r.cost)
 })).filter(r=>r.productId);
 return {id:clean(o.id,110)||uniq(),name:clean(o.name,90),manager:clean(o.manager,70),phone:clean(o.phone,45),
 orderMethod:clean(o.orderMethod,40)||'카카오톡',orderUrl:safeUrl(o.orderUrl),bank:clean(o.bank,50),
 notes:clean(o.notes,1200),archived:!!o.archived,rates,updatedAt:clean(o.updatedAt,42)};
}
function normalizeLog(x){
 return {id:clean(x.id,110)||uniq(),date:validDate(x.date)||iso(),quantity:decimal(x.quantity),note:clean(x.note,280),
 canceled:!!x.canceled,createdAt:clean(x.createdAt,42)||new Date().toISOString(),canceledAt:clean(x.canceledAt,42)};
}
function normalizeLine(x){
 return {id:clean(x.id,110)||uniq(),productId:clean(x.productId,110),productName:clean(x.productName,110),supplierId:clean(x.supplierId,110),supplierName:clean(x.supplierName,90),
 unit:clean(x.unit,16)||'건',quantity:decimal(x.quantity,1e6),unitPrice:numeric(x.unitPrice),unitCost:numeric(x.unitCost),
 startDate:validDate(x.startDate),endDate:validDate(x.endDate),note:clean(x.note,280),usageLog:(Array.isArray(x.usageLog)?x.usageLog:[]).slice(0,2500).map(normalizeLog)};
}
function normalizeBundle(x){
 return {id:clean(x.id,110)||uniq(),customerId:clean(x.customerId,110),title:clean(x.title,110),signedDate:validDate(x.signedDate),
 startDate:validDate(x.startDate),endDate:validDate(x.endDate),status:['견적','계약','진행중','완료','종료'].includes(x.status)?x.status:'견적',
 discount:numeric(x.discount),paid:numeric(x.paid),notes:clean(x.notes,2000),createdAt:clean(x.createdAt,42)||new Date().toISOString(),
 updatedAt:clean(x.updatedAt,42)||new Date().toISOString(),lines:(Array.isArray(x.lines)?x.lines:[]).slice(0,100).map(normalizeLine).filter(t=>t.productId),
 history:(Array.isArray(x.history)?x.history:[]).slice(-60).map(h=>({
  at:clean(h.at,42),status:clean(h.status,20),total:numeric(h.total),discount:numeric(h.discount),
  signedDate:validDate(h.signedDate),startDate:validDate(h.startDate),endDate:validDate(h.endDate),
  lines:(Array.isArray(h.lines)?h.lines:[]).slice(0,100).map(z=>({productName:clean(z.productName,110),supplierName:clean(z.supplierName,90),unit:clean(z.unit,16),
  quantity:decimal(z.quantity),unitPrice:numeric(z.unitPrice),unitCost:numeric(z.unitCost),startDate:validDate(z.startDate),endDate:validDate(z.endDate)}))
 }))};
}
function validate(input){
 if(!input||typeof input!=='object'||!Array.isArray(input.suppliers)||!Array.isArray(input.bundles))throw Error('외주업체/묶음 계약 구조가 올바르지 않습니다.');
 if(input.suppliers.length>1500||input.bundles.length>10000)throw Error('데이터가 너무 많습니다.');
 return {version:1,suppliers:input.suppliers.map(normalizeSupplier).filter(x=>x.name),bundles:input.bundles.map(normalizeBundle).filter(x=>x.title&&x.customerId&&x.lines.length)};
}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(db));return true}catch{notice('저장 실패: 브라우저 용량을 확인하고 데이터를 백업하세요.');return false}}
function notify(){window.dispatchEvent(new CustomEvent('momentum-commerce-updated'))}
function fillCustomerSelect(){
 const names=customers().slice().sort((a,b)=>a.name.localeCompare(b.name,'ko')),select=$('bundleCustomer'),before=select.value;
 select.innerHTML=options(names,before,'거래처 선택');if(before)select.value=before;
}
function productOptions(current){return options(catalogs(),current,'상품 선택')}
function supplierOptions(current){return options(db.suppliers.filter(x=>!x.archived||x.id===current),current,'외주업체 선택 (선택사항)')}
function rateRow(data={}){
 const row=document.createElement('div');row.className='supplier-rate';row.dataset.id=data.id||uniq();
 row.innerHTML='<label>상품<select data-rate="productId">'+productOptions(data.productId)+'</select></label>'+
  '<label>단위<select data-rate="unit">'+['건','회','개','명','월','일','건수','세트'].map(v=>'<option'+(v===(data.unit||'건')?' selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
  '<label>공급단가 (원)<input data-rate="cost" type="number" min="0" step="1" value="'+numeric(data.cost)+'"></label>'+
  '<button type="button" class="rate-delete" data-rate-remove aria-label="공급단가 행 삭제">삭제</button>';
 $('supplierRates').append(row);return row;
}
function resetSupplier(){
 const f=$('supplierForm');f.reset();$('supplierId').value='';$('supplierRates').innerHTML='';rateRow();
 $('supplierSection').querySelector('#supplierForm input[name="name"]').focus();
}
function saveSupplier(e){
 e.preventDefault();const f=$('supplierForm'),d=Object.fromEntries(new FormData(f)),old=supplierInfo(d.id);
 const rates=[...$('supplierRates').querySelectorAll('.supplier-rate')].map(row=>{
  const get=key=>row.querySelector('[data-rate="'+key+'"]').value;
  const p=productInfo(get('productId'));return p?{id:row.dataset.id,productId:p.id,productName:p.name,unit:get('unit'),cost:numeric(get('cost'))}:null;
 }).filter(Boolean);
 if(!clean(d.name,90)){notice('외주업체명을 입력하세요.');return}
 const next=normalizeSupplier({...old,...d,id:old?.id||uniq(),rates,updatedAt:new Date().toISOString()});
 if(old)db.suppliers[db.suppliers.indexOf(old)]=next;else db.suppliers.push(next);
 if(!persist())return;renderSuppliers();renderBundleSelects();resetSupplier();notice('외주업체와 상품별 공급단가가 저장되었습니다.');
}
function renderSuppliers(){
 $('supplierCount').textContent=String(db.suppliers.filter(s=>!s.archived).length);
 const entries=db.suppliers.slice().sort((a,b)=>Number(a.archived)-Number(b.archived)||a.name.localeCompare(b.name,'ko'));
 $('supplierList').innerHTML=entries.length?entries.map(s=>{
  const rates=s.rates.map(r=>esc(r.productName)+' '+won(r.cost)+'/'+esc(r.unit)).join(' · ');
  return '<article class="supplier-card"><strong>'+esc(s.name)+(s.archived?' (보관)':'')+'</strong>'+
   '<small>담당: '+esc(s.manager||'-')+' · 연락처: '+esc(s.phone||'-')+' · 접수: '+esc(s.orderMethod||'-')+'</small>'+
   '<small>은행: '+esc(s.bank||'-')+' · 계좌번호는 보안 저장 도입 후 관리</small>'+
   (s.orderUrl?'<small><a href="'+esc(s.orderUrl)+'" target="_blank" rel="noopener noreferrer">접수 URL 열기 ↗</a></small>':'')+
   '<p>'+esc(rates||'등록된 공급단가 없음')+'</p><div class="supplier-actions"><button type="button" data-supplier-edit="'+esc(s.id)+'">수정</button><button type="button" data-supplier-archive="'+esc(s.id)+'">'+(s.archived?'복구':'보관')+'</button></div></article>';
 }).join(''):'<p class="empty">등록된 외주업체가 없습니다.</p>';
}
function supplierAction(e){
 const btn=e.target.closest('button');if(!btn)return;
 const edit=btn.dataset.supplierEdit,archive=btn.dataset.supplierArchive;
 const data=supplierInfo(edit||archive);if(!data)return;
 if(edit){
  const f=$('supplierForm');f.reset();Object.entries(data).forEach(([k,v])=>{if(k==='rates')return;const item=f.elements.namedItem(k);if(item&&'value'in item)item.value=v||''});
  $('supplierRates').innerHTML='';data.rates.forEach(rateRow);if(!data.rates.length)rateRow();
  $('supplierSection').scrollIntoView({behavior:'smooth'});return;
 }
 if(archive){
  data.archived=!data.archived;persist();renderSuppliers();renderBundleSelects();notice(data.archived?'외주업체를 보관 처리했습니다. 기존 계약은 유지됩니다.':'외주업체가 복구되었습니다.');
 }
}
function lineRow(data={}){
 const row=document.createElement('div');row.className='bundle-line';row.dataset.lineId=data.id||uniq();
 row.innerHTML='<div class="bundle-line-top"><strong>상품 계약 항목</strong><button type="button" class="line-delete" data-line-remove>항목 삭제</button></div>'+
 '<div class="bundle-line-grid">'+
 '<label class="line-product">계약 상품 *<select data-line="productId" required>'+productOptions(data.productId)+'</select></label>'+
 '<label>판매 단위<select data-line="unit">'+['건','회','개','명','월','일','세트','건수'].map(u=>'<option'+(u===(data.unit||'건')?' selected':'')+'>'+u+'</option>').join('')+'</select></label>'+
 '<label>계약 수량 *<input data-line="quantity" type="number" min="0.001" step="0.001" required value="'+(data.quantity===undefined?1:decimal(data.quantity))+'"></label>'+
 '<label>판매 단가 (원)<input data-line="unitPrice" type="number" min="0" step="1" value="'+numeric(data.unitPrice)+'"></label>'+
 '<label>매입 단가 (원)<input data-line="unitCost" type="number" min="0" step="1" value="'+numeric(data.unitCost)+'"></label>'+
 '<label class="line-supplier">실행 외주업체<select data-line="supplierId">'+supplierOptions(data.supplierId)+'</select></label>'+
 '<label class="line-date">서비스 시작일<input data-line="startDate" type="date" value="'+esc(data.startDate||'')+'"></label>'+
 '<label class="line-date">서비스 만료일<input data-line="endDate" type="date" value="'+esc(data.endDate||'')+'"></label>'+
 '<label class="line-note">계약 메모<input data-line="note" maxlength="280" placeholder="조건·서비스 구성 등" value="'+esc(data.note||'')+'"></label>'+
 '</div><div class="line-total"><span>이 항목 판매 합계 <b data-line-total>0원</b></span><span>예상 외주비 <b data-line-cost>0원</b></span></div>';
 $('bundleLines').append(row);calculate();
 return row;
}
function getLine(row){
 const val=k=>row.querySelector('[data-line="'+k+'"]').value;
 const p=productInfo(val('productId')),s=supplierInfo(val('supplierId'));
 const id=row.dataset.lineId||uniq();
 return {id,productId:val('productId'),productName:p?.name||'',supplierId:val('supplierId'),supplierName:s?.name||'',
  unit:val('unit'),quantity:decimal(val('quantity')),unitPrice:numeric(val('unitPrice')),
  unitCost:numeric(val('unitCost')),startDate:validDate(val('startDate')),endDate:validDate(val('endDate')),note:clean(val('note'),280)};
}
function draft(){
 const f=$('bundleForm'),d=Object.fromEntries(new FormData(f));
 return {id:clean(d.id,110),customerId:clean(d.customerId,110),title:clean(d.title,110),signedDate:validDate(d.signedDate),
  startDate:validDate(d.startDate),endDate:validDate(d.endDate),status:clean(d.status,20),
  discount:numeric(d.discount),paid:numeric(d.paid),notes:clean(d.notes,2000),
  lines:[...$('bundleLines').querySelectorAll('.bundle-line')].map(getLine)};
}
function moneyTotals(bundle){
 const subtotal=Math.round(bundle.lines.reduce((n,l)=>n+l.quantity*l.unitPrice,0));
 const cost=Math.round(bundle.lines.reduce((n,l)=>n+l.quantity*l.unitCost,0));
 const discount=Math.min(subtotal,numeric(bundle.discount));
 const total=subtotal-discount;
 return {subtotal,cost,discount,total,profit:total-cost,outstanding:Math.max(0,total-numeric(bundle.paid))};
}
function calculate(){
 const all=[...$('bundleLines').querySelectorAll('.bundle-line')];
 for(const row of all){
  const l=getLine(row);
  row.querySelector('[data-line-total]').textContent=won(l.quantity*l.unitPrice);
  row.querySelector('[data-line-cost]').textContent=won(l.quantity*l.unitCost);
 }
 const t=moneyTotals(draft());
 for(const [id,val] of Object.entries({bundleSubtotal:t.subtotal,bundleDiscountView:t.discount,bundleTotal:t.total,bundleCost:t.cost,bundleProfit:t.profit,bundleOutstanding:t.outstanding}))$(id).textContent=won(val);
}
function resetBundle(){
 $('bundleForm').reset();$('bundleId').value='';$('bundleLines').innerHTML='';$('bundleDiscount').value='0';$('bundlePaid').value='0';
 $('bundleForm').elements.signedDate.value=iso();lineRow();calculate();
}
function renderBundleSelects(){
 fillCustomerSelect();
 document.querySelectorAll('.bundle-line').forEach(row=>{
  for(const key of ['productId','supplierId']){
   const select=row.querySelector('[data-line="'+key+'"]');const val=select.value;
   select.innerHTML=key==='productId'?productOptions(val):supplierOptions(val);
   select.value=val;
  }
 });
}
function fillSupplierRate(line){
 const productId=line.querySelector('[data-line="productId"]').value,supplierId=line.querySelector('[data-line="supplierId"]').value;
 const rate=supplierInfo(supplierId)?.rates.find(r=>r.productId===productId);
 if(rate){line.querySelector('[data-line="unitCost"]').value=rate.cost;line.querySelector('[data-line="unit"]').value=rate.unit}
}
function onBundleChange(e){
 const el=e.target;if(!el.closest('.bundle-line')){calculate();return}
 const line=el.closest('.bundle-line');
 if(['productId','supplierId'].includes(el.dataset.line))fillSupplierRate(line);
 calculate();
}
function used(line){return Math.round(line.usageLog.filter(x=>!x.canceled).reduce((n,e)=>n+e.quantity,0)*1000)/1000}
function remainingDays(line,bundle){
 const end=line.endDate||bundle.endDate;if(!end)return null;
 const today=new Date(iso()+'T12:00:00'),day=new Date(end+'T12:00:00');
 return Math.max(0,Math.round((day-today)/86400000));
}
function snapshot(b){
 const t=moneyTotals(b);
 return {at:new Date().toISOString(),status:b.status,total:t.total,discount:t.discount,
  signedDate:b.signedDate,startDate:b.startDate,endDate:b.endDate,
  lines:b.lines.map(l=>({productName:l.productName,supplierName:l.supplierName,unit:l.unit,quantity:l.quantity,
   unitPrice:l.unitPrice,unitCost:l.unitCost,startDate:l.startDate,endDate:l.endDate}))};
}
function saveBundle(ev){
 ev.preventDefault();const draftBundle=draft(),old=db.bundles.find(x=>x.id===draftBundle.id);
 if(!customerInfo(draftBundle.customerId)){notice('먼저 거래처를 등록하고 선택하세요.');return}
 if(!draftBundle.title){notice('견적·계약명을 입력하세요.');return}
 if(!draftBundle.lines.length||draftBundle.lines.some(x=>!productInfo(x.productId)||x.quantity<=0)){notice('각 항목의 상품과 계약 수량을 확인하세요.');return}
 if(draftBundle.lines.some(x=>x.endDate&&x.startDate&&x.endDate<x.startDate)){notice('상품 만료일이 시작일보다 빠릅니다.');return}
 if(draftBundle.endDate&&draftBundle.startDate&&draftBundle.endDate<draftBundle.startDate){notice('계약 만료일은 시작일 이후여야 합니다.');return}
 const totals=moneyTotals(draftBundle);
 if(draftBundle.discount>totals.subtotal){notice('할인액은 상품 합계보다 클 수 없습니다.');return}
 if(draftBundle.paid>totals.total){notice('수금액은 계약금액보다 클 수 없습니다.');return}
 if(old){
  for(const line of draftBundle.lines){
   const prev=old.lines.find(x=>x.id===line.id);
   line.usageLog=prev?clone(prev.usageLog):[];
   if(used(line)>line.quantity){notice('이미 사용한 수량보다 계약 수량을 줄일 수 없습니다.');return}
  }
 }
 const now=new Date().toISOString();
 const next=normalizeBundle({...draftBundle,id:old?.id||uniq(),createdAt:old?.createdAt||now,updatedAt:now,
  history:old?[...old.history,snapshot(old)].slice(-60):[],lines:draftBundle.lines});
 if(old)db.bundles[db.bundles.indexOf(old)]=next;else db.bundles.push(next);
 if(!persist())return;
 renderBundles();resetBundle();notice(old?'묶음 계약을 수정했습니다. 이전 단가와 조건은 변경 이력에 보존했습니다.':'묶음 견적·계약을 저장했습니다.');
 notify();
}
function fillBundleForm(bundle){
 resetBundle();
 const f=$('bundleForm');
 for(const [key,value] of Object.entries(bundle)){
  if(key==='lines'||key==='history')continue;
  const input=f.elements.namedItem(key);if(input&&'value'in input)input.value=value??'';
 }
 $('bundleLines').innerHTML='';
 bundle.lines.forEach(lineRow);
 calculate();$('bundleSection').scrollIntoView({behavior:'smooth'});
}
function renderBundles(){
 const q=searchTerm.toLowerCase(),list=db.bundles.slice().filter(x=>{
  const c=customerInfo(x.customerId);
  return !q||[x.title,c?.name,...x.lines.map(l=>l.productName)].join(' ').toLowerCase().includes(q);
 }).sort((a,b)=>(b.signedDate||b.createdAt).localeCompare(a.signedDate||a.createdAt));
 $('bundleRecords').innerHTML=list.length?list.map(b=>{
  const c=customerInfo(b.customerId),t=moneyTotals(b);
  const rows=b.lines.map(l=>{
   const usedQty=used(l),remain=Math.max(0,Math.round((l.quantity-usedQty)*1000)/1000),days=remainingDays(l,b);
   return '<tr><td><b>'+esc(l.productName)+'</b><small>'+esc(l.supplierName||'직접 진행')+'</small></td>'+
     '<td>'+numText(l.quantity)+' '+esc(l.unit)+'</td><td>'+won(l.unitPrice)+'</td>'+
     '<td>'+won(l.quantity*l.unitPrice)+'</td><td><span>'+numText(usedQty)+' / '+numText(l.quantity)+'</span>'+
     '<span class="quantity-meter"><i style="width:'+Math.min(100,usedQty/Math.max(.001,l.quantity)*100)+'%"></i></span>'+
     '<b>잔여 '+numText(remain)+' '+esc(l.unit)+'</b></td>'+
     '<td>'+esc(l.endDate||b.endDate||'기간 미지정')+(days!==null?'<small>잔여 '+days+'일</small>':'')+'</td>'+
     '<td><button type="button" data-use-bundle="'+esc(b.id)+'" data-use-line="'+esc(l.id)+'">사용 기록</button></td></tr>';
  }).join('');
  const revs=b.history.length?'<details class="bundle-revisions"><summary>계약 변경 이력 '+b.history.length+'건</summary>'+
    b.history.slice().reverse().map(h=>'<div class="bundle-revision"><small>'+esc(h.at.slice(0,19).replace('T',' '))+' · 이전 계약 '+esc(h.status)+' · 당시 계약금액 '+won(h.total)+'</small>'+
    '<p>'+h.lines.map(l=>esc(l.productName)+' '+numText(l.quantity)+esc(l.unit)+' × '+won(l.unitPrice)+(l.supplierName?' / '+esc(l.supplierName):'')).join('<br>')+'</p></div>').join('')+'</details>':'';
  return '<article class="bundle-record"><div class="bundle-record-heading"><div><small>'+esc(b.status)+' · 계약일 '+esc(b.signedDate||'미기재')+'</small><h4>'+esc(b.title)+'</h4><span class="bundle-meta">'+esc(c?.name||'미등록 거래처')+' · '+b.lines.length+'개 상품 · 계약번호 '+esc(b.id.slice(0,12))+'</span></div>'+
   '<div class="bundle-record-actions"><button data-edit-bundle="'+esc(b.id)+'">수정</button><button data-print-bundle="'+esc(b.id)+'">견적서 출력</button><button class="danger" data-remove-bundle="'+esc(b.id)+'">보관</button></div></div>'+
   '<div class="bundle-financials"><span>계약금액 <b>'+won(t.total)+'</b></span><span>수금 <b>'+won(b.paid)+'</b></span>'+
   '<span>미수 <b>'+won(t.outstanding)+'</b></span><span>예상 마진 <b>'+won(t.profit)+'</b></span><span>할인 <b>'+won(t.discount)+'</b></span></div>'+
   '<div class="bundle-table-wrap"><table class="bundle-table"><thead><tr><th>계약 상품 / 외주업체</th><th>수량</th><th>당시 판매단가</th><th>항목 합계</th><th>사용량 / 잔여</th><th>기간</th><th>작업</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+revs+'</article>';
 }).join(''):'<p class="empty">조건에 맞는 묶음 계약이 없습니다.</p>';
}
function openUsage(bundleId,lineId){
 const b=db.bundles.find(x=>x.id===bundleId),line=b?.lines.find(x=>x.id===lineId);
 if(!b||!line)return;
 currentUsage={bundleId,lineId};$('usageTitle').textContent=line.productName+' · 사용량 기록';
 $('usageForm').reset();$('usageForm').elements.date.value=iso();renderUsageDetails();$('usageDialog').showModal();
}
function renderUsageDetails(){
 const b=db.bundles.find(x=>x.id===currentUsage?.bundleId),line=b?.lines.find(x=>x.id===currentUsage?.lineId);if(!line)return;
 const remaining=Math.max(0,Math.round((line.quantity-used(line))*1000)/1000);
 $('usageStatus').innerHTML='<div class="bundle-financials"><span>계약 '+numText(line.quantity)+esc(line.unit)+'</span><span>사용 '+numText(used(line))+esc(line.unit)+'</span><span><b>잔여 '+numText(remaining)+esc(line.unit)+'</b></span></div>';
 $('usageHistory').innerHTML=line.usageLog.length?'<h3>사용·취소 이력</h3>'+line.usageLog.slice().reverse().map(e=>
  '<div class="usage-history-entry"><div><b>'+esc(e.date)+'</b> · '+numText(e.quantity)+esc(line.unit)+' · '+esc(e.note||'설명 없음')+(e.canceled?' (취소됨)':'')+'</div>'+
  (!e.canceled?'<button type="button" data-cancel-usage="'+esc(e.id)+'">기록 취소</button>':'')+'</div>').join(''):'<p class="empty">아직 사용 기록이 없습니다.</p>';
}
function saveUsage(ev){
 ev.preventDefault();const b=db.bundles.find(x=>x.id===currentUsage?.bundleId),line=b?.lines.find(x=>x.id===currentUsage?.lineId);
 if(!line)return;const d=Object.fromEntries(new FormData($('usageForm'))),qty=decimal(d.quantity),remaining=line.quantity-used(line);
 if(qty<=0||qty>remaining+0.00000001){notice('이번 사용량은 0보다 크고 잔여 수량 이하여야 합니다.');return}
 line.usageLog.push(normalizeLog({id:uniq(),date:d.date||iso(),quantity:qty,note:d.note||'',createdAt:new Date().toISOString()}));
 b.updatedAt=new Date().toISOString();
 if(!persist())return;renderUsageDetails();renderBundles();$('usageForm').reset();$('usageForm').elements.date.value=iso();
 notice('사용량을 기록했습니다. 남은 수량이 자동 계산됩니다.');
}
function cancelUsage(ev){
 const btn=ev.target.closest('[data-cancel-usage]');if(!btn||!currentUsage)return;
 const b=db.bundles.find(x=>x.id===currentUsage.bundleId),line=b?.lines.find(x=>x.id===currentUsage.lineId),log=line?.usageLog.find(x=>x.id===btn.dataset.cancelUsage);
 if(!log||log.canceled||!confirm('이 사용 기록을 취소할까요? 취소 이력은 남습니다.'))return;
 log.canceled=true;log.canceledAt=new Date().toISOString();persist();renderUsageDetails();renderBundles();notice('사용 기록이 취소되어 잔여 수량에 다시 반영되었습니다.');
}
function quoteData(b){
 const customer=customerInfo(b.customerId);const t=moneyTotals(b);
 const tr=b.lines.map(l=>'<tr><td>'+esc(l.productName)+'</td><td>'+numText(l.quantity)+' '+esc(l.unit)+'</td><td>'+won(l.unitPrice)+'</td><td>'+won(l.quantity*l.unitPrice)+'</td><td>'+esc(l.startDate||b.startDate||'-')+' ~ '+esc(l.endDate||b.endDate||'-')+'</td></tr>').join('');
 return '<!doctype html><html lang="ko"><meta charset="utf-8"><title>견적서 - '+esc(b.title)+'</title>'+
 '<style>body{font-family:system-ui,sans-serif;padding:35px;color:#152738}h1{font-size:28px}h2{font-size:18px}p{font-size:12px;line-height:1.8}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #d9e0e5;padding:11px;text-align:left;font-size:12px}th{background:#eef3f5}.total{text-align:right;font-size:17px;font-weight:800}.note{background:#f4f6f7;padding:15px;white-space:pre-wrap}</style>'+
 '<h1>견적서 / 계약 내역</h1><h2>'+esc(b.title)+'</h2><p>거래처: '+esc(customer?.name||'-')+'　 계약일: '+esc(b.signedDate||'-')+'</p>'+
 '<table><thead><tr><th>상품</th><th>수량</th><th>판매 단가</th><th>판매 금액</th><th>운영 기간</th></tr></thead><tbody>'+tr+'</tbody></table>'+
 '<p class="total">상품 합계 '+won(t.subtotal)+' / 할인 '+won(t.discount)+'</p><p class="total">최종 계약 금액 '+won(t.total)+'</p>'+
 '<p class="note">조건: '+esc(b.notes||'-')+'</p><p>모멘텀마케팅 · 사내 기록용 견적서 초안입니다. 발송 전 계약 조건을 확인하세요.</p></html>';
}
function printQuote(b){
 if(!b?.lines.length||!b.customerId){notice('거래처와 상품을 먼저 선택하세요.');return}
 const w=window.open('','_blank','noopener,noreferrer');
 if(!w){notice('팝업 차단을 해제한 뒤 견적서 출력을 다시 눌러주세요.');return}
 w.document.open();w.document.write(quoteData(b));w.document.close();
 w.addEventListener('load',()=>w.print(),{once:true});
}
function bundleAction(ev){
 const target=ev.target.closest('button');if(!target)return;
 const edit=target.dataset.editBundle,remove=target.dataset.removeBundle,print=target.dataset.printBundle;
 if(target.dataset.useBundle&&target.dataset.useLine){openUsage(target.dataset.useBundle,target.dataset.useLine);return}
 const b=db.bundles.find(x=>x.id===(edit||remove||print));if(!b)return;
 if(edit){fillBundleForm(b);return}
 if(print){printQuote(b);return}
 if(remove){
  if(!confirm('계약 내역은 매출 기록이므로 삭제하지 않고 "종료" 상태로 보관합니다. 종료 처리할까요?'))return;
  b.history.push(snapshot(b));b.history=b.history.slice(-60);b.status='종료';b.updatedAt=new Date().toISOString();
  persist();renderBundles();notice('계약을 종료 상태로 보관했습니다.');
 }
}
function init(){
 try{const raw=localStorage.getItem(KEY);if(raw)db=validate(JSON.parse(raw))}catch{db=fresh();notice('묶음계약 데이터를 읽지 못했습니다. 백업을 확인하세요.')}
 window.MomentumCommerce={validate,read:()=>clone(db),replace:input=>{
  db=validate(input);if(!persist())throw Error('저장 실패');renderSuppliers();renderBundles();renderBundleSelects();notify();
 }};
 fetch('/admin/assets/products.json',{credentials:'same-origin',cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{
  products=data.products||[];rateRow();resetBundle();renderSuppliers();renderBundles();fillCustomerSelect();
 }).catch(()=>{rateRow();resetBundle();renderSuppliers();notice('상품 목록 로딩에 실패했습니다. 관리자 로그인을 다시 확인하세요.')});
 $('supplierForm').addEventListener('submit',saveSupplier);
 $('clearSupplier').addEventListener('click',resetSupplier);$('resetSupplier').addEventListener('click',resetSupplier);
 $('addSupplierRate').addEventListener('click',()=>rateRow());
 $('supplierRates').addEventListener('click',e=>{
  if(e.target.closest('[data-rate-remove]')){e.target.closest('.supplier-rate').remove();if(!$('supplierRates').children.length)rateRow()}
 });
 $('supplierList').addEventListener('click',supplierAction);
 $('bundleForm').addEventListener('submit',saveBundle);
 $('addBundleLine').addEventListener('click',()=>lineRow());
 $('newBundle').addEventListener('click',resetBundle);
 $('resetBundle').addEventListener('click',resetBundle);
 $('bundleForm').addEventListener('input',calculate);
 $('bundleForm').addEventListener('change',onBundleChange);
 $('bundleLines').addEventListener('click',e=>{
  const btn=e.target.closest('[data-line-remove]');if(!btn)return;
  if($('bundleLines').children.length<=1){notice('계약 상품을 한 개 이상 선택하세요.');return}
  btn.closest('.bundle-line').remove();calculate();
 });
 $('printBundleDraft').addEventListener('click',()=>printQuote(draft()));
 $('bundleRecords').addEventListener('click',bundleAction);
 $('bundleSearch').addEventListener('input',e=>{searchTerm=e.target.value;renderBundles()});
 $('usageForm').addEventListener('submit',saveUsage);
 $('closeUsage').addEventListener('click',()=>$('usageDialog').close());
 $('usageHistory').addEventListener('click',cancelUsage);
 window.addEventListener('momentum-crm-updated',()=>{renderBundleSelects();renderBundles()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
