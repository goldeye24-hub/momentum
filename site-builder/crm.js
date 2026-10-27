(function(){
'use strict';
const DB_KEY='momentum-internal-crm-mvp-v1';
const el=id=>document.getElementById(id);
const escapeHtml=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>Number(value||0).toLocaleString('ko-KR')+'원';
const id=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
const clean=(v,n=120)=>String(v==null?'':v).trim().slice(0,n);
const allowedStatus=new Set(['문의','시안','계약','진행중','완료','갱신완료','보류','종료']);
const allowedPayments=new Set(['미입금','일부입금','완납']);
const allowedStages=new Set(['잠재고객','상담중','견적중','계약고객','보류']);
const MAX_AMOUNT=10000000000;
const amount=v=>Math.max(0,Math.min(MAX_AMOUNT,Math.floor(Number(v)||0)));
const empty=()=>({version:2,customers:[],contracts:[],tasks:[],customProducts:[]});
let db=empty(),catalog=[],category='전체',filterText='',taskFilter='open';
function message(str){el('notice').textContent=str}
function normalizeDate(value){
 const v=clean(value,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return '';
 const date=new Date(v+'T12:00:00');
 return Number.isNaN(date.valueOf())||date.getFullYear()!==Number(v.slice(0,4))||date.getMonth()+1!==Number(v.slice(5,7))||date.getDate()!==Number(v.slice(8))?'':v;
}
function qtyValue(raw){
 if(raw===null||raw===undefined||String(raw).trim()==='')return null;
 const n=Number(raw);
 return Number.isFinite(n)&&n>=0&&n<=1000000?Math.round(n*1000)/1000:null;
}
function normalizeData(raw){
 if(!raw||!Array.isArray(raw.customers)||!Array.isArray(raw.contracts)||!Array.isArray(raw.customProducts))throw Error('구조 오류');
 if(raw.customers.length>10000||raw.contracts.length>40000||raw.customProducts.length>1000)throw Error('데이터가 너무 많습니다');
 const cs=raw.customers.map(x=>({
  id:clean(x.id,100),name:clean(x.name,90),industry:clean(x.industry,70),manager:clean(x.manager,60),phone:clean(x.phone,40),
  region:clean(x.region,80),source:clean(x.source,70),referredBy:clean(x.referredBy,90),feedback:clean(x.feedback,30),notes:clean(x.notes,1000),
  email:clean(x.email,120),stage:allowedStages.has(x.stage)?x.stage:'잠재고객',nextContact:normalizeDate(x.nextContact),
  createdAt:clean(x.createdAt,40)
 })).filter(x=>x.id&&x.name);
 const ids=new Set(cs.map(x=>x.id));
 const custom=raw.customProducts.map(x=>({
  id:clean(x.id,100),name:clean(x.name,70),category:'추가 상품',cycle:'campaign',requiresPolicyReview:false
 })).filter(x=>x.id.startsWith('custom-')&&x.name);
 const contracts=raw.contracts.map(x=>({
  id:clean(x.id,100),customerId:clean(x.customerId,100),productId:clean(x.productId,100),
  signedDate:normalizeDate(x.signedDate),startDate:normalizeDate(x.startDate),endDate:normalizeDate(x.endDate),domainEnd:normalizeDate(x.domainEnd),
  renewalCheckDate:normalizeDate(x.renewalCheckDate),renewalCheckedAt:normalizeDate(x.renewalCheckedAt),
  quantity:qtyValue(x.quantity),usedQuantity:qtyValue(x.usedQuantity),unit:clean(x.unit,16),
  amount:amount(x.amount),cost:amount(x.cost),paid:amount(x.paid===undefined?(x.payment==='완납'?x.amount:0):x.paid),
  supplier:clean(x.supplier,90),owner:clean(x.owner,60),
  status:allowedStatus.has(x.status)?x.status:'문의',
  payment:allowedPayments.has(x.payment)?x.payment:'미입금',
  includedEdits:Math.max(0,Math.min(100,Math.floor(Number(x.includedEdits)||0))),
  usedEdits:Math.max(0,Math.min(100,Math.floor(Number(x.usedEdits)||0))),
  link:/^https:\/\//i.test(String(x.link||''))?clean(x.link,300):'',
  notes:clean(x.notes,1000),createdAt:clean(x.createdAt,40)
 })).filter(x=>x.id&&ids.has(x.customerId));
 const tasks=(Array.isArray(raw.tasks)?raw.tasks:[]).slice(0,30000).map(x=>({
  id:clean(x.id,100),title:clean(x.title,150),customerId:ids.has(x.customerId)?x.customerId:'',
  dueDate:normalizeDate(x.dueDate),priority:x.priority==='높음'?'높음':'보통',
  done:!!x.done,notes:clean(x.notes,800),createdAt:clean(x.createdAt,40)
 })).filter(x=>x.id&&x.title);
 return {version:2,customers:cs,contracts,tasks,customProducts:custom};
}
function persist(){
 try{localStorage.setItem(DB_KEY,JSON.stringify(db));window.dispatchEvent(new CustomEvent('momentum-crm-updated'));return true}
 catch(e){message('저장 실패: 브라우저 저장 공간 문제입니다. 데이터를 백업하세요.');return false}
}
function getProducts(){return catalog.concat(db.customProducts)}
function product(id){return getProducts().find(x=>x.id===id)||{name:'미등록 상품',id,category:'기타',cycle:'campaign'};}
function customer(id){return db.customers.find(x=>x.id===id);}
function fromForm(form){return Object.fromEntries(new FormData(form).entries())}
function toForm(form,value){Array.from(form.elements).forEach(input=>{if(input.name&&input.name in value)input.value=value[input.name]});}
function todayKey(){
 const now=new Date();
 return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}
function daysUntil(date){
 const day=new Date(date+'T12:00:00'),now=new Date(todayKey()+'T12:00:00');
 return Math.round((day-now)/86400000);
}
function reminderEvents(){
 const output=[];
 db.contracts.filter(x=>x.status!=='종료'&&x.status!=='보류').forEach(x=>{
  const c=customer(x.customerId);if(!c)return;
  [{type:'계약 만료',date:x.endDate},{type:'도메인 연장',date:x.domainEnd}].forEach(t=>{
   if(!t.date)return;
   const days=daysUntil(t.date);
   if(days>60)return;
   output.push({...t,days,contract:x,business:c.name,product:product(x.productId).name});
  });
 });
 return output.sort((a,b)=>a.days-b.days||a.business.localeCompare(b.business,'ko'));
}
function selectedProducts(){
 return getProducts().filter(x=>category==='전체'||x.category===category);
}
function renderCatalog(){
 const products=getProducts(),cats=['전체',...new Set(products.map(x=>x.category))];
 el('productCount').textContent='('+products.length+'종)';
 el('catalogFilters').innerHTML=cats.map(name=>'<button type="button" data-category="'+escapeHtml(name)+'" class="'+(name===category?'active':'')+'">'+escapeHtml(name)+'</button>').join('');
 el('productGrid').innerHTML=selectedProducts().map(x=>'<div class="product"><div><strong>'+escapeHtml(x.name)+'</strong><small>'+escapeHtml(x.category)+' · '+(x.cycle==='annual'?'연간 재연장':x.cycle==='recurring'?'월정액·기간 계약':x.cycle==='oneoff'?'단발 제작':'캠페인별 계약')+'</small></div>'+(x.requiresPolicyReview?'<mark>정책 검토</mark>':'')+'</div>').join('');
 const selected=el('contractProduct').value;
 el('contractProduct').innerHTML='<option value="">상품 선택</option>'+products.map(p=>'<option value="'+escapeHtml(p.id)+'">'+escapeHtml(p.category+' · '+p.name)+'</option>').join('');
 if(products.some(x=>x.id===selected))el('contractProduct').value=selected;
}
function renderClientDropdown(){
 const val=el('contractCustomer').value;
 el('contractCustomer').innerHTML='<option value="">거래처 선택</option>'+db.customers.slice().sort((a,b)=>a.name.localeCompare(b.name,'ko')).map(c=>'<option value="'+escapeHtml(c.id)+'">'+escapeHtml(c.name)+'</option>').join('');
 if(db.customers.some(x=>x.id===val))el('contractCustomer').value=val;
 const taskVal=el('taskCustomer').value;
 el('taskCustomer').innerHTML='<option value="">공통 업무</option>'+db.customers.slice().sort((a,b)=>a.name.localeCompare(b.name,'ko')).map(c=>'<option value="'+escapeHtml(c.id)+'">'+escapeHtml(c.name)+'</option>').join('');
 if(db.customers.some(x=>x.id===taskVal))el('taskCustomer').value=taskVal;
}
function renderStats(){
 el('totalCustomers').textContent=String(db.customers.length);
 const bundleData=window.MomentumCommerce?.read()?.bundles||[];
 const activeBundles=bundleData.filter(b=>['계약','진행중','완료'].includes(b.status));
 const bundleTotals=activeBundles.map(b=>{const subtotal=Math.round(b.lines.reduce((n,l)=>n+l.quantity*l.unitPrice,0));const cost=Math.round(b.lines.reduce((n,l)=>n+l.quantity*l.unitCost,0));return {total:Math.max(0,subtotal-b.discount),cost,paid:b.paid};});
 el('activeContracts').textContent=String(db.contracts.filter(x=>!['종료','보류','문의'].includes(x.status)).length+activeBundles.length);
 const bundleRenewals=bundleData.filter(b=>b.status!=='종료').flatMap(b=>b.lines.map(l=>({type:'묶음상품 만료',date:l.endDate||b.endDate,business:customer(b.customerId)?.name||'거래처',product:l.productName})).filter(r=>r.date&&daysUntil(r.date)<=60));
 el('dueSoon').textContent=String(reminderEvents().filter(x=>x.days>=0&&x.days<=30).length+bundleRenewals.filter(x=>daysUntil(x.date)>=0&&daysUntil(x.date)<=30).length);
 const billable=db.contracts.filter(x=>!['종료','보류','문의','시안'].includes(x.status));
 el('outstanding').textContent=money(billable.reduce((sum,x)=>sum+Math.max(0,x.amount-x.paid),0)+bundleTotals.reduce((n,t)=>n+Math.max(0,t.total-t.paid),0));
 el('grossProfit').textContent=money(billable.reduce((sum,x)=>sum+x.amount-x.cost,0)+bundleTotals.reduce((n,t)=>n+t.total-t.cost,0));
 el('openTasks').textContent=String(db.tasks.filter(t=>!t.done).length);
 const upcoming=reminderEvents().concat(bundleRenewals.map(x=>({...x,days:daysUntil(x.date)}))).sort((a,b)=>a.days-b.days);
 el('renewalList').innerHTML=upcoming.length?upcoming.map(x=>{
  const urgent=x.days<0||x.days<=7,soon=x.days<=30;
  const badge=x.days<0?Math.abs(x.days)+'일 지남':x.days===0?'오늘 만료':x.days+'일 남음';
  return '<div class="alert '+(urgent?'urgent':soon?'soon':'')+'"><div class="alert-main"><strong>'+escapeHtml(x.business)+' · '+escapeHtml(x.type)+'</strong><small>'+escapeHtml(x.product)+' | 만료일 '+escapeHtml(x.date)+'</small></div><span class="pill">'+badge+'</span></div>';
 }).join(''):'<p class="empty">60일 이내 만료 예정인 계약과 도메인이 없습니다.</p>';
}
function renderRecords(){
 const q=filterText.trim().toLowerCase();
 const found=db.customers.filter(c=>{
  const contracts=db.contracts.filter(x=>x.customerId===c.id);
  const text=[c.name,c.region,c.industry,c.referredBy,c.manager,...contracts.map(x=>product(x.productId).name)].join(' ').toLowerCase();
  return !q||text.includes(q);
 });
 el('recordList').innerHTML=found.length?found.map(c=>{
  const contracts=db.contracts.filter(x=>x.customerId===c.id);
  const rows=contracts.length?contracts.map(x=>{
   const remain=Math.max(0,x.includedEdits-x.usedEdits);
   const usage=x.quantity==null?'수량 미등록':'계약수량 '+x.quantity.toLocaleString('ko-KR')+(x.unit||'건')+' · 사용 '+(x.usedQuantity||0).toLocaleString('ko-KR')+(x.unit||'건')+' · 잔여 '+Math.max(0,x.quantity-(x.usedQuantity||0)).toLocaleString('ko-KR')+(x.unit||'건');
   return '<div class="contract-line"><div><strong>'+escapeHtml(product(x.productId).name)+'</strong> <span class="contract-meta">'+escapeHtml(x.status)+' · '+escapeHtml(x.payment)+' · '+money(x.amount)+'</span><div class="contract-meta">'+(x.endDate?'계약 만료 '+escapeHtml(x.endDate)+'　':'')+(x.domainEnd?'도메인 만료 '+escapeHtml(x.domainEnd)+'　':'')+'무료수정 '+x.usedEdits+'/'+x.includedEdits+'회 · 잔여 '+remain+'회</div><div class="contract-meta">'+escapeHtml(usage)+'</div><div class="contract-meta">매입 '+money(x.cost)+' · 수금 '+money(x.paid)+' · 미수 '+money(Math.max(0,x.amount-x.paid))+' · 예상이익 '+money(x.amount-x.cost)+'</div></div><div class="contract-ops"><button type="button" data-edit-contract="'+escapeHtml(x.id)+'">계약 수정</button><button type="button" data-delete-contract="'+escapeHtml(x.id)+'">삭제</button></div></div>';
  }).join(''):'<p class="empty">등록된 계약 상품이 없습니다.</p>';
  return '<article class="record"><div class="record-head"><div><div class="record-title">'+escapeHtml(c.name)+'</div><div class="record-sub">'+escapeHtml([c.industry,c.region,c.manager,c.phone,c.stage].filter(Boolean).join(' · '))+(c.referredBy?'<br>소개 업체: '+escapeHtml(c.referredBy):'')+(c.feedback?' · 반응 '+escapeHtml(c.feedback):'')+(c.nextContact?' · 다음 연락 '+escapeHtml(c.nextContact):'')+'</div></div><div class="record-actions"><button type="button" data-add-contract="'+escapeHtml(c.id)+'">+ 상품 계약</button><button type="button" data-edit-customer="'+escapeHtml(c.id)+'">업체 수정</button><button type="button" data-delete-customer="'+escapeHtml(c.id)+'">삭제</button></div></div><div class="contracts">'+rows+'</div></article>';
 }).join(''):'<p class="empty">'+(q?'검색 결과가 없습니다.':'아직 거래처가 없습니다. 위에서 첫 거래처를 등록하세요.')+'</p>';
}
function render(){renderCatalog();renderClientDropdown();renderStats();renderRecords();renderTasks();}
function resetCustomer(){el('customerForm').reset();el('customerId').value='';}
function resetContract(){el('contractForm').reset();el('contractId').value='';}
function goTo(id){el(id).scrollIntoView({behavior:'smooth',block:'start'});}
function saveCustomer(ev){
 ev.preventDefault();
 const form=el('customerForm'),d=fromForm(form);
 if(!clean(d.name)){message('업체명을 입력하세요.');return;}
 const old=db.customers.find(x=>x.id===d.id);
 const row={id:old?old.id:id(),name:clean(d.name,90),industry:clean(d.industry,70),manager:clean(d.manager,60),phone:clean(d.phone,40),
 region:clean(d.region,80),source:clean(d.source,70),referredBy:clean(d.referredBy,90),feedback:clean(d.feedback,30),
 notes:clean(d.notes,1000),email:clean(d.email,120),
 stage:allowedStages.has(d.stage)?d.stage:'잠재고객',nextContact:normalizeDate(d.nextContact),
 createdAt:old?old.createdAt:new Date().toISOString()};
 if(old)db.customers[db.customers.indexOf(old)]=row;else db.customers.push(row);
 persist();render();resetCustomer();message('거래처가 저장되었습니다.');
}
function saveContract(ev){
 ev.preventDefault();
 const form=el('contractForm'),d=fromForm(form);
 if(!customer(d.customerId)||!getProducts().some(x=>x.id===d.productId)){message('거래처와 계약 상품을 확인하세요.');return;}
 if(d.endDate&&!normalizeDate(d.endDate)){message('계약 만료일이 잘못되었습니다.');return;}
 if(d.signedDate&&!normalizeDate(d.signedDate)){message('계약 체결일이 잘못되었습니다.');return;}
 if(d.renewalCheckDate&&!normalizeDate(d.renewalCheckDate)){message('재연장 확인일을 확인하세요.');return;}
 const quantity=qtyValue(d.quantity),usedQuantity=qtyValue(d.usedQuantity);
 if(String(d.quantity||'').trim()&&(quantity===null||quantity<=0)){message('계약수량은 0보다 크고 100만 이하여야 합니다.');return;}
 if(String(d.usedQuantity||'').trim()&&usedQuantity===null){message('사용수량은 0 이상 100만 이하여야 합니다.');return;}
 if(usedQuantity!==null&&(quantity===null||usedQuantity>quantity)){message('사용수량은 계약수량을 초과할 수 없습니다. 계약수량을 먼저 입력하세요.');return;}
 const old=db.contracts.find(x=>x.id===d.id);
 const row={
 id:old?old.id:id(),customerId:d.customerId,productId:d.productId,signedDate:normalizeDate(d.signedDate),startDate:normalizeDate(d.startDate),
 endDate:normalizeDate(d.endDate),domainEnd:normalizeDate(d.domainEnd),
 renewalCheckDate:normalizeDate(d.renewalCheckDate),renewalCheckedAt:old&&old.endDate===normalizeDate(d.endDate)&&old.renewalCheckDate===normalizeDate(d.renewalCheckDate)?old.renewalCheckedAt||'':'',
 quantity,usedQuantity:quantity===null?null:(usedQuantity??0),unit:quantity===null?'':clean(d.unit,16)||'건',
 amount:amount(d.amount),cost:amount(d.cost),paid:amount(d.paid),
 supplier:clean(d.supplier,90),owner:clean(d.owner,60),
 status:allowedStatus.has(d.status)?d.status:'문의',payment:allowedPayments.has(d.payment)?d.payment:'미입금',
 includedEdits:Math.max(0,Math.min(100,Number(d.includedEdits)||0)),usedEdits:Math.max(0,Math.min(100,Number(d.usedEdits)||0)),
 link:/^https:\/\//i.test(d.link||'')?clean(d.link,300):'',notes:clean(d.notes,1000),
 createdAt:old?old.createdAt:new Date().toISOString()};
 if(row.payment==='완납'&&row.paid===0&&row.amount>0)row.paid=row.amount;
 if(row.paid>row.amount){message('수금액은 계약금액을 초과할 수 없습니다.');return;}
 row.payment=row.paid>=row.amount&&row.amount>0?'완납':row.paid>0?'일부입금':'미입금';
 if(row.endDate&&row.startDate&&row.endDate<row.startDate){message('계약 만료일은 시작일보다 빠를 수 없습니다.');return;}
 if(old)db.contracts[db.contracts.indexOf(old)]=row;else db.contracts.push(row);
 persist();render();resetContract();message('상품별 계약이 저장되었습니다. 만료일을 입력했다면 알림 대상에 자동 반영됩니다.');
}
function handleRecords(ev){
 const target=ev.target.closest('button');if(!target)return;
 const customerId=target.dataset.editCustomer,customerDelete=target.dataset.deleteCustomer;
 const contractId=target.dataset.editContract,contractDelete=target.dataset.deleteContract;
 const add=target.dataset.addContract;
 if(customerId){const row=customer(customerId);if(row){resetCustomer();toForm(el('customerForm'),row);goTo('customerSection')}return;}
 if(add){resetContract();el('contractCustomer').value=add;goTo('contractSection');return;}
 if(contractId){const row=db.contracts.find(x=>x.id===contractId);if(row){resetContract();toForm(el('contractForm'),row);goTo('contractSection')}return;}
 if(contractDelete){
  if(!confirm('이 계약을 삭제할까요? 복원하려면 백업 파일이 필요합니다.'))return;
  db.contracts=db.contracts.filter(x=>x.id!==contractDelete);persist();render();message('계약이 삭제되었습니다.');return;
 }
 if(customerDelete){
  const row=customer(customerDelete);if(!row||!confirm(row.name+' 거래처와 연결된 계약을 모두 삭제할까요?'))return;
  db.customers=db.customers.filter(x=>x.id!==customerDelete);db.contracts=db.contracts.filter(x=>x.customerId!==customerDelete);db.tasks=db.tasks.filter(t=>t.customerId!==customerDelete);
  persist();render();message('거래처와 해당 계약이 삭제되었습니다.');
 }
}
function renderTasks(){
 const list=db.tasks.slice().filter(x=>taskFilter==='all'||(taskFilter==='done'?x.done:!x.done)).sort((a,b)=>Number(a.done)-Number(b.done)||(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
 el('taskList').innerHTML=list.length?list.map(t=>{
  const c=customer(t.customerId);const due=t.dueDate?daysUntil(t.dueDate):null;
  const urgent=!t.done&&due!==null&&due<=1;
  return '<div class="task-item '+(t.done?'complete':'')+(urgent?' urgent':'')+'"><button type="button" class="task-check" data-task-toggle="'+escapeHtml(t.id)+'" aria-label="'+(t.done?'미완료 전환':'완료 처리')+'">'+(t.done?'✓':'')+'</button><div class="task-meta"><strong>'+escapeHtml(t.title)+'</strong><small>'+escapeHtml(c?.name||'공통 업무')+' · '+escapeHtml(t.dueDate||'기한 없음')+' · '+escapeHtml(t.priority)+(t.notes?' · '+escapeHtml(t.notes):'')+'</small></div><div class="task-ops"><button type="button" data-task-edit="'+escapeHtml(t.id)+'">수정</button><button type="button" data-task-delete="'+escapeHtml(t.id)+'">삭제</button></div></div>';
 }).join(''):'<p class="empty">해당 업무가 없습니다.</p>';
 el('openTasks').textContent=String(db.tasks.filter(t=>!t.done).length);
 el('taskList').querySelectorAll('button').forEach(b=>{b.addEventListener('click',()=>taskAction(b))});
}
function taskAction(target){
 const toggle=target.dataset.taskToggle,edit=target.dataset.taskEdit,drop=target.dataset.taskDelete;
 if(toggle){const t=db.tasks.find(x=>x.id===toggle);if(t){t.done=!t.done;persist();render();message(t.done?'업무를 완료했습니다.':'업무를 다시 미완료로 변경했습니다.')}return;}
 if(edit){const t=db.tasks.find(x=>x.id===edit);if(!t)return;resetTask();toForm(el('taskForm'),t);goTo('pipelineSection');return;}
 if(drop){if(!confirm('업무를 삭제할까요?'))return;db.tasks=db.tasks.filter(x=>x.id!==drop);persist();render();message('업무를 삭제했습니다.');}
}
function resetTask(){el('taskForm').reset();el('taskId').value='';}
function saveTask(ev){
 ev.preventDefault();const d=fromForm(el('taskForm'));if(!clean(d.title)){message('업무명을 입력하세요.');return;}
 const old=db.tasks.find(x=>x.id===d.id);
 const t={id:old?old.id:id(),title:clean(d.title,150),customerId:customer(d.customerId)?d.customerId:'',
 dueDate:normalizeDate(d.dueDate),priority:d.priority==='높음'?'높음':'보통',notes:clean(d.notes,800),done:old?old.done:false,createdAt:old?old.createdAt:new Date().toISOString()};
 if(old)db.tasks[db.tasks.indexOf(old)]=t;else db.tasks.push(t);
 persist();render();resetTask();message('업무가 저장되었습니다.');
}
function csvCell(value){
 const input=String(value??'');
 const excelSafe=/^[=+\-@\t\r]/.test(input)?"'"+input:input;
 return '"'+excelSafe.replace(/"/g,'""')+'"';
}
function exportCsv(){
 const rows=[['업체명','업종','지역','담당자','연락처','이메일','영업 단계','유입경로','소개 업체','거래처 반응','다음 연락일']];
 db.customers.forEach(c=>rows.push([c.name,c.industry,c.region,c.manager,c.phone,c.email,c.stage,c.source,c.referredBy,c.feedback,c.nextContact]));
 dl('momentum-clients-'+todayKey()+'.csv','\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
 message('거래처 CSV를 저장했습니다. 연락처가 포함되므로 안전하게 보관하세요.');
}
function dl(name,text,mime){
 const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=name;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function backup(){
 const commerce=window.MomentumCommerce?.read()||null;
 dl('momentum-crm-'+todayKey()+'.json',JSON.stringify({...db,commerce},null,2),'application/json');
 message('거래처·단일 계약·묶음 견적·외주업체를 포함한 JSON 백업을 저장했습니다. 안전하게 보관하세요.');
}
function restore(file){
 if(!file||file.size>5000000){message('5MB 이하 JSON 파일만 사용할 수 있습니다.');return;}
 const reader=new FileReader();
 reader.onload=()=>{
  try{
   const raw=JSON.parse(String(reader.result));
   const input=normalizeData(raw);
   const commerce=raw.commerce?window.MomentumCommerce?.validate(raw.commerce):null;
   if(raw.commerce&&!commerce)throw Error('묶음계약 모듈을 불러오지 못했습니다.');
   if(!confirm('현재 이 브라우저의 거래처·계약 데이터를 백업 내용으로 교체할까요?'))return;
   const previous=localStorage.getItem(DB_KEY);
   const prevCommerce=localStorage.getItem('momentum-internal-crm-commerce-v1');
   try{
    localStorage.setItem(DB_KEY,JSON.stringify(input));
    if(commerce)window.MomentumCommerce.replace(commerce);
    db=input;render();resetCustomer();resetContract();
    window.dispatchEvent(new CustomEvent('momentum-crm-updated'));
    message(commerce?'전체 CRM 백업을 복원했습니다.':'기존 형식의 거래처·단일 계약 백업을 복원했습니다. 묶음 계약 데이터는 유지했습니다.');
   }catch(err){
    if(previous===null)localStorage.removeItem(DB_KEY);else localStorage.setItem(DB_KEY,previous);
    if(prevCommerce===null)localStorage.removeItem('momentum-internal-crm-commerce-v1');else localStorage.setItem('momentum-internal-crm-commerce-v1',prevCommerce);
    throw err;
   }
  }catch(e){message('백업 파일 형식이 올바르지 않습니다. '+e.message)}
 };
 reader.readAsText(file);
}
function icsEscape(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;').slice(0,220)}
function calendar(){
 const events=[];
 db.contracts.filter(x=>x.status!=='종료').forEach(x=>{
  const c=customer(x.customerId);if(!c)return;
  [{label:'계약 재연장',date:x.endDate},{label:'도메인 연장',date:x.domainEnd}].forEach(y=>{
   if(!y.date||daysUntil(y.date)<0)return;
   const stamp=y.date.replace(/-/g,'');
   const title=icsEscape(c.name+' · '+product(x.productId).name+' '+y.label);
   events.push('BEGIN:VEVENT\r\nUID:'+icsEscape(x.id+'-'+y.label+'@momentum-crm')+'\r\nDTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')+'\r\nDTSTART;VALUE=DATE:'+stamp+'\r\nSUMMARY:'+title+'\r\nDESCRIPTION:'+icsEscape('모멘텀마케팅 계약·도메인 만료 일정')+'\r\n'+[60,30,7].map(n=>'BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:'+title+'\r\nTRIGGER:-P'+n+'D\r\nEND:VALARM\r\n').join('')+'END:VEVENT');
  });
 });
 if(!events.length){message('미래 만료일이 있는 계약을 먼저 등록하세요.');return;}
 dl('momentum-contract-renewals.ics','BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Momentum Marketing//CRM//KO\r\nCALSCALE:GREGORIAN\r\n'+events.join('\r\n')+'\r\nEND:VCALENDAR\r\n','text/calendar');
 message('만료 일정을 캘린더 파일로 저장했습니다. 캘린더 앱에 가져오면 알림을 설정할 수 있습니다. 변경 시 새 파일을 다시 가져와야 합니다.');
}
function applyPendingContract(){
 try{
  const editId=sessionStorage.getItem('momentum.crm.editContract');
  if(editId){
   sessionStorage.removeItem('momentum.crm.editContract');
   const match=db.contracts.find(x=>x.id===editId);
   if(match){
    resetContract();
    toForm(el('contractForm'),match);
    window.requestAnimationFrame(()=>goTo('contractSection'));
    message('선택한 계약을 수정할 수 있습니다.');
   }
   return;
  }
 }catch{/* standard contract editing remains available. */}
 try{
  const target=sessionStorage.getItem('momentum.crm.newContract');
  if(!target)return;
  sessionStorage.removeItem('momentum.crm.newContract');
  if(!customer(target))return;
  resetContract();
  el('contractCustomer').value=target;
  window.requestAnimationFrame(()=>goTo('contractSection'));
  message('선택한 광고주의 새 상품 계약을 등록할 수 있습니다.');
 }catch{/* sessionStorage disabled: standard contract form still works. */}
}
function setup(){
 try{
  const stored=localStorage.getItem(DB_KEY);
  if(stored)db=normalizeData(JSON.parse(stored));
 }catch(e){db=empty();message('저장된 데이터를 읽지 못했습니다. 백업 파일을 확인하세요.');}
 fetch('/admin/assets/products.json',{credentials:'same-origin',cache:'no-store'}).then(r=>{if(!r.ok)throw Error('카탈로그 로딩 실패');return r.json();}).then(data=>{
  if(!data||!Array.isArray(data.products)||data.products.length!==18)throw Error('상품 기본 목록이 올바르지 않습니다.');
  catalog=data.products;render();applyPendingContract();
 }).catch(()=>{message('상품 카탈로그를 불러오지 못했습니다. 관리자 로그인을 확인하세요.');render();applyPendingContract();});
 const pendingKey='momentum.crm.openCustomer';
 try{
   const selectedId=sessionStorage.getItem(pendingKey);
   if(selectedId){
     sessionStorage.removeItem(pendingKey);
     const selected=customer(selectedId);
     if(selected){
       resetCustomer();
       toForm(el('customerForm'),selected);
       window.requestAnimationFrame(()=>goTo('customerSection'));
       message('광고주 목록에서 선택한 업체를 편집할 수 있습니다.');
     }
   }
 }catch{/* sessionStorage disabled: normal CRM functionality remains. */}
 el('customerForm').addEventListener('submit',saveCustomer);
 el('taskForm').addEventListener('submit',saveTask);
 el('taskReset').addEventListener('click',resetTask);
 el('exportCsv').addEventListener('click',exportCsv);
 document.querySelectorAll('[data-tasks]').forEach(button=>button.addEventListener('click',()=>{
  taskFilter=button.dataset.tasks;
  document.querySelectorAll('[data-tasks]').forEach(el=>el.classList.toggle('active',el===button));
  renderTasks();
 }));
 el('contractForm').addEventListener('submit',saveContract);
 el('customerReset').addEventListener('click',resetCustomer);
 el('contractReset').addEventListener('click',resetContract);
 el('recordList').addEventListener('click',handleRecords);
 el('catalogFilters').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;category=b.dataset.category;renderCatalog();});
 el('contractProduct').addEventListener('change',()=>{
  const p=product(el('contractProduct').value);
  el('policyNote').hidden=!p.requiresPolicyReview;
  if(p.id==='website-renewal'&&!el('contractForm').includedEdits.value)el('contractForm').includedEdits.value='2';
 });
 el('addProduct').addEventListener('click',()=>{
  const name=clean(el('newProductName').value,70);
  if(name.length<2){message('상품명을 2자 이상 입력하세요.');return;}
  if(getProducts().some(x=>x.name===name)){message('이미 있는 상품입니다.');return;}
  db.customProducts.push({id:'custom-'+id(),name,category:'추가 상품',cycle:'campaign',requiresPolicyReview:false});
  el('newProductName').value='';persist();render();message('추가 상품이 저장되었습니다.');
 });
 el('searchRecords').addEventListener('input',e=>{filterText=e.target.value;renderRecords();});
 el('exportData').addEventListener('click',backup);
 el('importData').addEventListener('click',()=>el('importFile').click());
 el('importFile').addEventListener('change',e=>{restore(e.target.files?.[0]);e.target.value='';});
 el('exportCalendar').addEventListener('click',calendar);
 window.addEventListener('momentum-commerce-updated',renderStats);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();