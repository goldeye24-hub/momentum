'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

test('failed email delivery never displays the verification-code form',async()=>{
 const auth=require('../api/_admin-email-login');
 const oldEnabled=auth.enabled,oldSend=auth.send;
 const oldPassword=process.env.MOMENTUM_ADMIN_PASSWORD,oldSecret=process.env.MOMENTUM_SESSION_SECRET;
 try{
  process.env.MOMENTUM_ADMIN_PASSWORD='test-not-production-password-123';
  process.env.MOMENTUM_SESSION_SECRET='test-session-secret-not-production-1234567890';
  auth.enabled=()=>true;
  auth.send=async()=>false;
  const handler=require('../api/admin-site-builder');
  const request={
   method:'POST',query:{action:'login'},
   headers:{origin:'https://example.test',host:'example.test'},
   body:{intent:'email-send',email:'owner@example.com'}
  };
  const response={
   statusCode:200,
   headers:{},
   setHeader(key,value){this.headers[key.toLowerCase()]=value},
   end(body){this.body=String(body);return this}
  };
  await handler(request,response);
  assert.equal(response.statusCode,503);
  assert.match(response.body,/인증번호를 발송하지 못했습니다/);
  assert.match(response.body,/기존 비밀번호로 로그인/);
  assert.doesNotMatch(response.body,/name="code"/);
 }finally{
  auth.enabled=oldEnabled;auth.send=oldSend;
  if(oldPassword===undefined)delete process.env.MOMENTUM_ADMIN_PASSWORD;else process.env.MOMENTUM_ADMIN_PASSWORD=oldPassword;
  if(oldSecret===undefined)delete process.env.MOMENTUM_SESSION_SECRET;else process.env.MOMENTUM_SESSION_SECRET=oldSecret;
 }
});
