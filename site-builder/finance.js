(function(){'use strict';
const KEY='momentum-internal-finance-ledger-v1';
const CRM='momentum-internal-crm-mvp-v1';
const COMMERCE='momentum-internal-crm-commerce-v1';
const $=id=>document.getElementById(id);
const won=n=>Math.round(Number(n)||0).toLocaleString('ko-KR')+'원';
const amount=v=>Math.max(0,Math.min(1e10,Math.round(Number(v)||0)));
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const parse=v=>{try{return JSON.parse(localStorage.getItem(v)||'{}')}catch{return {}}};
const safeArray=v=>Array.isArray(v)?v:[];
const safeText=(v,max=100)=>String(v??'').trim().slice(0,max);
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(new Date(d+'T12:00:00').valueOf());
const uuid=()=>window.crypto?.randomUUID?.()||('x'+Date.now().toString(36)+Math.random().toString(36).slice(2));
let ledger=safeArray(parse(KEY).entries).slice(-5000).filter(x=>x&&validDate(x.date)&&amount(x.amount)>0).map(x=>({
 id:safeText(x.id,95),date:x.date,amount:amount(x.amount),customerId:safeText(x.customerId,95),
 supplierId:safeText(x.supplierId,95),product:safeText(x.product,90),note:safeText(x.note,160),
 category:['외주비','광고비','제작비','운영비','기타'].includes(x.category)?x.category:'기타',
 invoice:['미수취','수취완료','해당없음'].includes(x.invoice)?x.invoice:'미수취'
}));
let latest=()=>({customers:safeArray(parse(CRM).customers),suppliers:safeArray(parse(COMMERCE).suppliers),
 contracts:safeArray(parse(CRM).contracts),bundles:safeArray(parse(COMMERCE).bundles)});
function store(){try{localStorage.setItem(KEY,JSON.stringify({version:1,entries:ledger}));return true}catch{$('notice').textContent='저장 공간에 접근할 수 없습니다. 브라우저 설정을 확인하세요.';return false}}
function inPeriod(date){if(!validDate(date))return false;const anchor=$('periodDate').value||today(),mode=$('periodType').value;return mode==='day'?date===anchor:mode==='year'?date.slice(0,4)===anchor.slice(0,4):date.slice(0,7)===anchor.slice(0,7)}
function option(select,data,empty){const prev=select.value;select.replaceChildren();const first=document.createElement('option');first.value='';first.textContent=empty;select.append(first);for(const item of data){if(!item?.id||!item?.name)continue;const o=document.createElement('option');o.value=String(item.id);o.textContent=safeText(item.name,80);select.append(o)}if([...select.options].some(o=>o.value===prev))select.value=prev}
function lookup(list,id){const x=list.find(x=>x.id===id);return x?.name?safeText(x.name,100):'—'}
function moneyField(row,key){return amount(row?.[key])}
function contractTotals(data){
 let sales=0,costs=0;
 for(const c of data.contracts){
  const status=safeText(c?.status);
  if(['문의','시안','보류'].includes(status))continue;
  const date=c?.startDate||String(c?.createdAt||'').slice(0,10);
  if(!inPeriod(date))continue;
  sales+=moneyField(c,'amount');costs+=moneyField(c,'cost');
 }
 for(const bundle of data.bundles){
  if(bundle?.status==='견적')continue;
  const date=bundle?.startDate||bundle?.signedDate||String(bundle?.createdAt||'').slice(0,10);
  if(!inPeriod(date))continue;
  let subtotal=0,lineCosts=0;
  for(const line of safeArray(bundle?.lines)){
    const qty=Math.max(0,Math.min(1e6,Number(line?.quantity)||0));
    subtotal+=moneyField(line,'unitPrice')*qty;
    lineCosts+=moneyField(line,'unitCost')*qty;
  }
  sales+=Math.max(0,subtotal-moneyField(bundle,'discount'));costs+=lineCosts;
 }
 return {sales,costs};
}
function cell(row,text,strong){const td=document.createElement('td');if(strong){const b=document.createElement('b');b.textContent=text;td.append(b)}else td.textContent=text;row.append(td);return td}
function render(){
 const data=latest();
 option($('spendCustomer'),data.customers,'미지정 / 공통');
 option($('spendSupplier'),data.suppliers,'미지정');
 const {sales,costs}=contractTotals(data),view=ledger.filter(x=>inPeriod(x.date)).slice().sort((a,b)=>b.date.localeCompare(a.date));
 $('totalSales').textContent=won(sales);$('totalCosts').textContent=won(costs);
 $('totalMargin').textContent=won(sales-costs);
 $('totalSpend').textContent=won(view.reduce((sum,x)=>sum+x.amount,0));
 $('recordsCount').textContent=view.length+'건';
 const target=$('rows');target.replaceChildren();
 if(!view.length){const tr=document.createElement('tr');const td=cell(tr,'선택한 기간에 지출 내역이 없습니다.');td.colSpan=8;target.append(tr);return}
 view.forEach(x=>{
  const tr=document.createElement('tr');
  cell(tr,x.date);cell(tr,lookup(data.customers,x.customerId));cell(tr,lookup(data.suppliers,x.supplierId));
  cell(tr,x.product,true);cell(tr,x.category);cell(tr,won(x.amount),true);
  const status=cell(tr,x.invoice);
  status.style.color=x.invoice==='미수취'?'#bb6247':'#476b88';
  const td=document.createElement('td');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='outline';toggle.textContent='계산서 변경';toggle.dataset.action='invoice';toggle.dataset.id=x.id;
  const remove=document.createElement('button');remove.type='button';remove.className='linkbtn';remove.textContent='삭제';remove.style.marginLeft='5px';remove.dataset.action='remove';remove.dataset.id=x.id;
  td.append(toggle,remove);tr.append(td);target.append(tr);
 });
}
function notify(str){$('notice').textContent=str}
function download(name,mime,body){
 const blob=new Blob([body],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function csvValue(v){
 const s=String(v??'');
 const neutral=/^[\s]*[=+@\-]/.test(s)?"'"+s:s;
 return '"'+neutral.replace(/"/g,'""')+'"';
}
function toCsv(data){
 const rows=ledger.filter(x=>inPeriod(x.date)).map(x=>[x.date,lookup(data.customers,x.customerId),lookup(data.suppliers,x.supplierId),x.category,x.product,x.amount,x.invoice,x.note]);
 return ['날짜','광고주','외주업체','유형','상품·업무','금액','계산서','비고'].map(csvValue).join(',')+'\n'+rows.map(row=>row.map(csvValue).join(',')).join('\n');
}
$('spendDate').value=today();$('periodDate').value=today();
$('spendForm').addEventListener('submit',e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);
 const date=safeText(f.get('date'),10),n=amount(f.get('amount')),product=safeText(f.get('product'),90);
 if(!validDate(date)||!n||!product){notify('일자, 상품명, 금액을 정확히 입력하세요.');return}
 if(ledger.length>=5000){notify('지출 5,000건에 도달했습니다. 내보내기로 백업한 후 관리하세요.');return}
 const invoice=safeText(f.get('invoice')),category=safeText(f.get('category'));
 ledger.push({id:uuid(),date,amount:n,product,customerId:safeText(f.get('customerId'),95),
 supplierId:safeText(f.get('supplierId'),95),invoice:['미수취','수취완료','해당없음'].includes(invoice)?invoice:'미수취',
 category:['외주비','광고비','제작비','운영비','기타'].includes(category)?category:'기타',note:safeText(f.get('note'),160)});
 if(!store()){ledger.pop();return}
 e.currentTarget.reset();$('spendDate').value=today();notify('지출 기록을 브라우저에 저장했습니다.');render();
});
$('rows').addEventListener('click',e=>{
 const btn=e.target.closest('button[data-action]');if(!btn)return;
 const row=ledger.find(x=>x.id===btn.dataset.id);if(!row)return;
 if(btn.dataset.action==='remove'){
  if(!confirm('이 지출 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.'))return;
  ledger=ledger.filter(x=>x.id!==row.id);if(store()){notify('지출 기록을 삭제했습니다.');render()}
 }else{
  const statuses=['미수취','수취완료','해당없음'];
  row.invoice=statuses[(statuses.indexOf(row.invoice)+1)%statuses.length];
  if(store()){notify('계산서 수취 상태를 '+row.invoice+'로 변경했습니다.');render()}
 }
});
$('periodType').addEventListener('change',render);$('periodDate').addEventListener('change',render);
$('exportCsv').addEventListener('click',()=>download('momentum-expenses-'+$('periodType').value+'-'+$('periodDate').value+'.csv','text/csv;charset=utf-8','\uFEFF'+toCsv(latest())));
$('exportJson').addEventListener('click',()=>download('momentum-expenses-backup-'+today()+'.json','application/json;charset=utf-8',JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries:ledger},null,2)));
render();
})();