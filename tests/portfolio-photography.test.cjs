'use strict';
/* Portfolio preflight: current 19-site gallery, actual route files, and approved legal-page rebuild.
 * A passing preflight is NOT visual design approval; desktop/mobile browser screenshots are separate. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const slugs=['restaurant','beauty','enterprise','b2b','shop','stay','interior','academy','pet','legal','clinic','auto','fitness','estate','hrd','tax','moving','cleaning','pilates'];
const read=(pathName)=>fs.readFileSync(path.join(root,pathName),'utf8');

test('current portfolio gallery links all 19 distinct industry pages',()=>{
 const html=read('portfolio/conversion/index.html');
 const ids=[...html.matchAll(/<a class="site-case" id="([^"]+)" href="([^"]+)"/g)];
 assert.equal(ids.length,21,'19 catalog cases plus two featured cases');
 for(const slug of slugs){
  assert.equal(ids.filter(x=>x[1]===slug).length,1,'one catalog card for '+slug);
  assert.ok(ids.some(x=>x[1]===slug&&x[2]==='/portfolio/conversion/'+slug+'/'),slug+' routes to actual site');
 }
 assert.equal(new Set(slugs).size,19);
 assert.match(html,/gallery-2026\.css/);
 assert.doesNotMatch(html,/<iframe\b/i,'synthetic gallery must not rely on blank embedded iframes');
});

for(const slug of slugs){
 test(slug+' route has real standalone HTML, readable content, at least three photos',()=>{
  const h=read('portfolio/conversion/'+slug+'/index.html');
  assert.match(h,/^<!doctype html>/i);
  assert.match(h,/<meta[^>]+name="viewport"/i);
  assert.equal((h.match(/<h1\b/g)||[]).length,1,'single semantic heading');
  assert.ok((h.match(/<img\b/g)||[]).length>=3,'use photographs instead of CSS-only cards');
  assert.match(h,/<title>[^<]+<\/title>/i);
  assert.match(h,/<main\b/i);
  const anchors=[...h.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]);
  const ids=new Set([...h.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  for(const anchor of anchors)assert.ok(ids.has(anchor),slug+' missing anchor '+anchor);
 });
}

test('law practice independently matches approved page SECTION ORDER — pending visual comparison',()=>{
 const h=read('portfolio/conversion/legal/index.html');
 assert.doesNotMatch(h,/reference-collection\.css|photography-upgrade\.css|live-design\.js/,'no old shared template');
 assert.match(h,/<meta name="robots" content="noindex,follow">/);
 assert.match(h,/id="top"/);
 for(const id of ['about','practice','approach','process','contact']){
  assert.match(h,new RegExp('id="'+id+'"'),'missing approved section '+id);
 }
 assert.match(h,/class="practice-mini"/);
 assert.match(h,/class="case-cards"/);
 assert.match(h,/class="step-grid"/);
 assert.equal((h.match(/class="step-number"/g)||[]).length,4,'exactly 4 case phases');
 assert.equal((h.match(/class="case-card"/g)||[]).length,3,'three legal practice stories');
 assert.match(h,/data-slide="0"/);
 assert.match(h,/data-slide="1"/);
 assert.match(h,/data-slide="2"/);
 assert.match(h,/@media\(max-width:760px\)/);
 assert.match(h,/prefers-reduced-motion/);
 assert.doesNotMatch(h,/<form\b/i,'fictional law practice must not collect real client data');
 assert.doesNotMatch(h,/(?:\.png|\.jpg).*screenshot|\/mnt\/data|screenshot-crop/i,'no screenshot pasted as design photo');
 const imgIds=[...h.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
 assert.equal(imgIds.length,5,'one hero + three services + office image');
 assert.equal(new Set(imgIds).size,imgIds.length,'do not reuse image as another section photo');
});

test('preview changes do not require production credentials or form submission',()=>{
 const h=read('portfolio/conversion/legal/index.html');
 assert.match(h,/모멘텀마케팅/);
 assert.match(h,/가상 브랜드/);
 assert.match(h,/\/?service=법률사무소/);
 assert.doesNotMatch(h,/fetch\(|XMLHttpRequest|localStorage|sessionStorage/,'static page has no hidden data action');
});
