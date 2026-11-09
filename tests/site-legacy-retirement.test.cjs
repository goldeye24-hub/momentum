'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const cfg=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const retired=["services/ad-planning/index.html","services/creative/index.html","services/education/index.html","services/open-package/index.html","services/photography/index.html","services/place-seo/index.html","services/press/index.html","services/reviews/index.html","services/search-ads/index.html","services/sns/index.html","services/viral/index.html","services/websites/index.html","services/websites/franchise/index.html","industries/index.html","industries/restaurant/index.html","industries/hairshop/index.html","industries/hospital/index.html","industries/academy/index.html","about/index.html","lab/index.html","lab/rank/index.html"];
test('all 21 retired standalone pages are absent and have exact permanent redirects',()=>{
 assert.equal(retired.length,21);
 for(const file of retired){
  assert.equal(fs.existsSync(path.join(root,file)),false,file);
  const dir='/'+file.slice(0,-'index.html'.length);
  for(const url of [dir,dir.slice(0,-1),'/'+file]){
   const matches=cfg.redirects.filter(r=>r.source===url);
   assert.equal(matches.length,1,'duplicate/missing redirect '+url);
   assert.equal(matches[0].destination,'/',url);
   assert.equal(matches[0].permanent,true,url);
  }
 }
});
test('homepage, portfolio, editorial guides and inquiries stay; old SEO sitemap URLs removed',()=>{
 const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
 assert.ok(sitemap.includes('momentum-orcin-delta.vercel.app/'));
 assert.ok(sitemap.includes('/insights/'));
 for(const file of retired){
  const oldUrl='https://momentum-orcin-delta.vercel.app/'+file.slice(0,-'index.html'.length);
  assert.ok(!sitemap.includes('<loc>'+oldUrl+'</loc>'),oldUrl);
 }
 for(const file of ['index.html','api/inquiries.js','portfolio/index.html','insights/index.html','site-builder/research-index.html'])
  assert.equal(fs.existsSync(path.join(root,file)),true,file);
});
test('protected research dashboard no longer links to removed public ranking tool',()=>{
 for(const file of ['site-builder/research-index.html','site-builder/rank-watch-index.html','site-builder/keyword-matrix-index.html'])
  assert.ok(!fs.readFileSync(path.join(root,file),'utf8').includes('href="/lab/rank/"'),file);
});


const retiredStandaloneCss=[
  "industries/site.css",
  "services/creative-premium.css",
  "services/design-collection.css",
  "services/distinct-visuals.css",
  "services/education-agency.css",
  "services/landing-v2.css",
  "services/menu-extensions.css",
  "services/press-products.css",
  "services/service-visuals.css",
  "services/site.css",
  "services/sns-products.css",
  "services/utility-visuals.css",
  "services/websites/websites.css"
];
test('retired standalone styles are absent from active source files',()=>{
 const skip=new Set(['.git','.github','.vercel','.next','node_modules','tests','docs','db','coverage']);
 const files=[];
 function visit(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const full=path.join(dir,entry.name);
   if(entry.isDirectory()){if(!skip.has(entry.name))visit(full);continue;}
   if(entry.isFile()&&/\.(?:html|css|js|json|cjs|mjs)$/.test(entry.name))files.push(full);
  }
 }
 visit(root);
 const active=files.map(file=>({file:path.relative(root,file),content:fs.readFileSync(file,'utf8')}));
 for(const css of retiredStandaloneCss){
  assert.equal(fs.existsSync(path.join(root,css)),false,'retired stylesheet still exists: '+css);
  for(const source of active)assert.equal(source.content.includes(css),false,source.file+' still references '+css);
 }
});
