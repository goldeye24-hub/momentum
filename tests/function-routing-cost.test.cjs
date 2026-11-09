'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const heavy=['admin-keyword-matrix','admin-competitor-compare','admin-place-keyword-insights','admin-rank-watches'];
function target(path){return config.rewrites.find(x=>x.source===path)?.destination;}
function response(){
 return {statusCode:200,payload:null,setHeader(){},status(code){this.statusCode=code;return this},json(data){this.payload=data;return data}};
}
function loadMocked(path){
 const calls=[];
 const source=fs.readFileSync(path,'utf8'),module={exports:{}};
 const mockRequire=name=>{
  if(name==='./_research-admin')return(req,res)=>{calls.push('research');return res.status(202).json({source:'research'})};
  if(name.startsWith('../server-handlers/')){
   const op=name.split('/').at(-1);
   return(req,res)=>{calls.push(op);return res.status(200).json({source:op})};
  }
  throw Error('Unexpected module: '+name);
 };
 vm.runInNewContext(source,{module,require:mockRequire});
 return {handler:module.exports,calls};
}
test('original admin URLs route to the appropriate heavy or lightweight function',()=>{
 for(const op of heavy){
  for(const source of ['/api/'+op,({
   'admin-keyword-matrix':'/admin/keyword-matrix/api',
   'admin-competitor-compare':'/admin/competitors/api',
   'admin-place-keyword-insights':'/admin/place-insights/api',
   'admin-rank-watches':'/admin/watches/api'
  })[op]]){
   assert.equal(target(source),'/api/research-admin?op='+op,source);
  }
 }
 for(const op of ['admin-members','admin-connection']){
  assert.equal(target('/api/'+op),op==='admin-members'?'/api/compact?op=admin-members':undefined);
  assert.equal(target('/admin/'+(op==='admin-members'?'members':'connection')+'/api'),'/api/compact?op='+op);
 }
 assert.equal(target('/admin/research/api'),'/api/research-admin');
});
test('lightweight admin function no longer bundles the Chromium binary',()=>{
 assert.equal(config.functions['api/compact.js'].includeFiles,undefined);
 assert.match(config.functions['api/research-admin.js'].includeFiles,/chromium/);
 const source=fs.readFileSync('api/compact.js','utf8');
 for(const op of heavy)assert.doesNotMatch(source,new RegExp('server-handlers/'+op));
 assert.match(fs.readFileSync('api/research-admin.js','utf8'),/require\('\.\/_research-admin'\)/);
});
test('both route dispatchers preserve known routes and reject unknown operations',async()=>{
 const light=loadMocked('api/compact.js');
 const research=loadMocked('api/research-admin.js');
 for(const op of ['admin-members','admin-connection']){
  const res=response();await light.handler({query:{op}},res);
  assert.equal(res.statusCode,200);assert.equal(res.payload.source,op);
 }
 for(const op of heavy){
  const res=response();await research.handler({query:{op}},res);
  assert.equal(res.statusCode,200);assert.equal(res.payload.source,op);
 }
 const legacy=response();await research.handler({query:{}},legacy);
 assert.equal(legacy.statusCode,202);assert.equal(legacy.payload.source,'research');
 const unknownLight=response();await light.handler({query:{op:'invalid-smoke-check'}},unknownLight);
 assert.equal(unknownLight.statusCode,404);
 const unknownHeavy=response();await research.handler({query:{op:'invalid-smoke-check'}},unknownHeavy);
 assert.equal(unknownHeavy.statusCode,404);
});
