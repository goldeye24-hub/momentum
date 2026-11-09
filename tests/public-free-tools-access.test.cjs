'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
test('anonymous rank page and its dedicated Chromium function do not deploy anymore',()=>{
 for(const p of ['api/place-rank-live.js','api/_public-rank-quota.js','lab/rank/public-rank.js'])
  assert.equal(fs.existsSync(path.join(root,p)),false,p);
 assert.equal(config.functions['api/place-rank-live.js'],undefined);
 assert.ok(fs.existsSync(path.join(root,'api/_place-observe.js')));
});
test('old free tool browser URLs are redirected to the current homepage',()=>{
 for(const p of ['/lab/','/lab/rank/'])
  assert.equal(config.redirects.find(x=>x.source===p)?.destination,'/');
});
