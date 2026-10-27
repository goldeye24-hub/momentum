'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=name=>fs.readFileSync(path.join(__dirname,'../site-builder',name),'utf8');
function section(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+1);
 assert.ok(a>=0&&b>=0,'Missing source boundaries: '+start);
 return source.slice(a,b);
}
const crm=load('crm.js'),commerce=load('crm-commerce.js'),html=load('crm-index.html');
function createManager(){
 const productSource=section(crm,'function getProducts(){','function customer(')+
  section(crm,'function selectedProducts(){','function renderCatalog(){')+
  section(crm,'function addCustomProduct(','function renderClientDropdown(){');
 const db={customers:[],contracts:[],tasks:[],customProducts:[],archivedProductIds:[]};
 const catalog=[{id:'default-product',name:'기본 상품',category:'기본',cycle:'campaign'}];
 let sequence=0;const notices=[];
 const api=new Function('catalog','db','clean','id','message','persist','render','renderCatalog','confirm','category',
  productSource+'return {getProducts,activeProducts,product,addCustomProduct,toggleProduct};')(
  catalog,db,(v,n)=>String(v==null?'':v).trim().slice(0,n),
  ()=>'test'+(++sequence),s=>notices.push(s),()=>true,()=>{},()=>{},()=>true,'전체'
 );
 return {api,db,catalog,notices};
}
test('ad hoc contract products are reusable and duplicate names use existing identity',()=>{
 const {api,db}=createManager();
 const id=api.addCustomProduct('신규 클립 광고');
 assert.equal(api.addCustomProduct('신규 클립 광고'),id);
 assert.equal(db.customProducts.length,1);
 assert.equal(api.getProducts().find(x=>x.id===id).name,'신규 클립 광고');
});
test('end sale and resume sale preserve custom product identity and built-in product history',()=>{
 const {api,db}=createManager();
 const id=api.addCustomProduct('신규 상품');
 api.toggleProduct(id);
 assert.equal(api.product(id).archived,true);
 assert.equal(api.activeProducts().some(p=>p.id===id),false);
 api.toggleProduct(id);
 assert.equal(api.product(id).archived,false);
 api.toggleProduct('default-product');
 assert.deepEqual(db.archivedProductIds,['default-product']);
 assert.ok(api.product('default-product'));
});
test('bundled contract dropdown hides retired products from new sales but retains old selection',()=>{
 const src=section(commerce,'function catalogs(){','function supplierInfo(')+section(commerce,'function productOptions(','function supplierOptions(');
 const {db,catalog}=createManager();db.archivedProductIds=['default-product'];
 const combo=new Function('readBase','products','options',src+'return {catalogs,productOptions};')(
  ()=>db,catalog,(list)=>list.map(x=>x.id)
 );
 assert.equal(combo.productOptions('').includes('default-product'),false);
 assert.equal(combo.productOptions('default-product').includes('default-product'),true);
});
test('inline product fields and archive controls are wired in both contract forms',()=>{
 assert.match(html,/id="quickSingleProduct"/);
 assert.match(html,/id="quickBundleProduct"/);
 assert.match(crm,/id="saveQuickSingleProduct"|el\('saveQuickSingleProduct'\)/);
 assert.match(commerce,/saveQuickBundleProduct/);
 assert.match(crm,/archivedProductIds/);
 assert.match(crm,/data-toggle-product/);
 assert.match(crm,/판매 종료 처리했습니다/);
});
