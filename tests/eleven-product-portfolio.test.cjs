'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const load=(f)=>fs.readFileSync(path.join(root,f),'utf8');
const products=['moringa','lumin','brew','puremild','coolrest','taily','rootvein','cleandock','airy','galbitang','crab'];
const newProducts=products.slice(3);
test('11 product detail pages are linked from the collection',()=>{
 const page=load('portfolio/product-pages/index.html');
 const count=(page.match(/class="card" id=/g)||[]).length;
 assert.equal(count,11);
 for(const slug of products){
  assert.ok(page.includes('href="/portfolio/product-pages/'+slug+'/"'),slug+' must have accessible link');
 }
 assert.match(page,/aria-pressed="true"/);
 assert.match(page,/실제 판매·인증·성능/);
});
test('8 long image-led pages exist and do not offer actual payment',()=>{
 const overview=load('portfolio/index.html');
 for(const slug of newProducts){
  const html=load('portfolio/product-pages/'+slug+'/index.html');
  assert.ok(overview.includes('href="/portfolio/product-pages/'+slug+'/"'),slug+' overview link missing');
  assert.match(html,/data:image\/webp;base64,UklG/,slug+' embedded artwork missing');
  assert.ok(html.length>150000,slug+' expected long image content');
  assert.ok(html.includes('실제 판매·결제는 진행되지 않'),slug+' must disclose demo only');
  assert.ok(!/<form\b/i.test(html),slug+' should not present a fake checkout');
  assert.ok(!/잔단통|장단통/.test(html),'misspelled 장단콩 must not return');
 }
});
test('legacy food beauty and coffee routes remain intact',()=>{
 for(const slug of products.slice(0,3)){
  const html=load('portfolio/product-pages/'+slug+'/index.html');
  assert.match(html,/PRODUCT INFORMATION/);
 }
});
