'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const cases=['moringa','lumin','brew'];

test('product portfolio index offers three full-page sales examples',()=>{
 const listing=read('portfolio/product-pages/index.html');
 const gallery=read('portfolio/index.html');
 for(const name of cases){
  const dest='/portfolio/product-pages/'+name+'/';
  assert.ok(listing.includes('href="'+dest+'"'),name+' listing link missing');
  assert.ok(gallery.includes('href="'+dest+'"'),name+' gallery link missing');
 }
 for(const anchor of ['ferment','lumin','brew'])assert.ok(listing.includes('id="'+anchor+'"'),anchor+' legacy hash missing');
});

test('all category samples are long content-rich product sales pages with real photo elements',()=>{
 const styles=read('portfolio/product-pages/sales.css');
 assert.ok(styles.includes('@media(max-width:690px)'),'responsive design is required');
 for(const name of cases){
  const doc=read('portfolio/product-pages/'+name+'/index.html');
  assert.ok(doc.length>7000,name+' sales page is unexpectedly short');
  assert.ok((doc.match(/<img\b/g)||[]).length>=9,name+' missing realistic image elements');
  for(const section of ['WHY THIS PRODUCT','THE BRAND STORY','PRODUCT INFORMATION','BEFORE YOU CHOOSE','mock-buy','demo-dialog']){
   assert.ok(doc.includes(section),name+' missing '+section);
  }
  assert.ok(doc.includes('실제 판매')||doc.includes('가상'),name+' must identify the sample');
  assert.ok(!doc.includes('잔단통'),'typo must not appear');
  assert.ok(!doc.includes('장단통'),'typo must not appear');
 }
 assert.ok(read('portfolio/product-pages/moringa/index.html').includes('장단콩'),'moringa content must mention 장단콩');
});
