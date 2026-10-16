'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const diag=require('../api/_db-failure');
test('secretless Supabase diagnoses distinguish rejected API keys, missing permissions and schemas',()=>{
 assert.deepEqual(diag.analyze({status:401,code:'database_error',upstreamCode:'PGRST301'}),
  {category:'api_key_rejected',httpStatus:401,upstreamCode:'PGRST301'});
 assert.deepEqual(diag.analyze({status:403,code:'database_error',upstreamCode:'42501'}),
  {category:'permission_denied',httpStatus:403,upstreamCode:'42501'});
 assert.deepEqual(diag.analyze({status:404,code:'database_error',upstreamCode:'PGRST205'}),
  {category:'table_or_schema_missing',httpStatus:404,upstreamCode:'PGRST205'});
 assert.equal(diag.analyze({name:'AbortError'}).category,'timeout');
 assert.equal(diag.analyze({code:'not_configured'}).category,'configuration_missing');
 assert.equal(diag.analyze({status:502}).category,'supabase_service_error');
});
test('Supabase diagnostics do not include unsafe raw upstream error messages, URLs, keys or tokens',()=>{
 const error={status:401,code:'database_error',upstreamCode:'Injected secret: sb_secret_123',
  message:'service token https://private.supabase.co/admin?apikey=secret123',apiKey:'never-expose'};
 const output=JSON.stringify(diag.analyze(error))+diag.message(error);
 assert.match(output,/HTTP 401/);
 assert.doesNotMatch(output,/sb_secret|secret123|private\.supabase|never-expose/);
 const src=fs.readFileSync('api/_rank-store.js','utf8');
 assert.match(src,/upstreamCode/);
 assert.doesNotMatch(src,/message:detail\.message/);
 const connection=fs.readFileSync('server-handlers/admin-connection.js','utf8');
 assert.match(connection,/diagnosis\.analyze\(error\)/);
 const watches=fs.readFileSync('server-handlers/admin-rank-watches.js','utf8');
 assert.match(watches,/diagnosis\.message\(err\)/);
 assert.match(fs.readFileSync('site-builder/rank-watch-index.html','utf8'),/admin\/connection\//);
});
