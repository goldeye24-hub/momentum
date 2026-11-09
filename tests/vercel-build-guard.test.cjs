'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {affectsDeployment,needsBuild,chooseAction}=require('../scripts/should-vercel-build.cjs');
const sha='a'.repeat(40);
test('documentation, checks and CI-only changes do not rebuild the production site',()=>{
 assert.equal(needsBuild(['docs/guide.md','tests/test.cjs','.github/workflows/x.yml','scripts/research.py']),false);
 assert.equal(affectsDeployment('README.md'),false);
 assert.equal(chooseAction({branch:'main',previousSha:sha,changedFiles:['tests/test.cjs']}).build,false);
});
test('site and function changes are always deployed, including published research',()=>{
 for(const path of ['api/compact.js','vercel.json','index.html','insights/index.html','server-handlers/admin-members.js','site-builder/index.html','package.json']){
  assert.equal(needsBuild([path]),true,path);
 }
});
test('new or unverified production baselines fail open to preserve availability',()=>{
 assert.equal(chooseAction({branch:'main',previousSha:'',changedFiles:[]}).build,true);
 assert.equal(chooseAction({branch:'main',previousSha:sha,changedFiles:undefined}).build,true);
});
test('development branches are never built by the Ignored Build Step',()=>{
 assert.equal(chooseAction({branch:'ops/cost-fix',previousSha:sha,changedFiles:['api/compact.js']}).build,false);
});
