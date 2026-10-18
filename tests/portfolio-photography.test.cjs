'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ids=['restaurant','beauty','b2b','shop','stay','interior','academy','pet',
'legal','clinic','auto','fitness','estate','hrd','tax','moving','cleaning','pilates'];
const photoFirst=['b2b','legal','clinic','auto','fitness','estate','hrd','tax','moving','cleaning','pilates'];
test('Portfolio hub links all 18 standalone industry concepts',()=>{
 const hub=fs.readFileSync(path.join(root,'portfolio/conversion/index.html'),'utf8');
 assert.equal((hub.match(/<section\s+class="showcase\s/g)||[]).length,18);
});
for(const id of ids){
 test(id+' showcase uses real photo URLs and preserves demo disclosure',()=>{
  const html=fs.readFileSync(path.join(root,'portfolio/conversion',id,'index.html'),'utf8');
  const imgs=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);
  assert.ok(imgs.length>=3,id+' must include at least three reference photographs');
  const urls=imgs.map(img=>{
   const m=img.match(/\bsrc="([^"]+)"/);
   assert.ok(m,id+' image needs src');
   assert.ok(/\balt="[^"]+"/.test(img),id+' image needs descriptive alt');
   return m[1].split('?')[0];
  });
  assert.equal(new Set(urls).size,urls.length,id+' must not repeat the same photo');
  assert.match(html,/photography-upgrade\.css/,id+' photography CSS must be linked');
  assert.match(html,new RegExp('data-mood="'+id+'"'),id+' needs industry-specific art direction');
  assert.match(html,/(가상|시안|데모|샘플|콘셉트|실제 업체)/,id+' cannot present sample photography as real work');
  if(photoFirst.includes(id))assert.match(html,/(mood-cover|mood-hero-big)/,id+' leading graphic must include photography');
 });
}
