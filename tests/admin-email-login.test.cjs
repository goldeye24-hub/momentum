'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const helper=require('../api/_admin-email-login');
const auth=require('../api/_member-session');

test('email login is opt-in and requires configured authentication',()=>{
 const prior={...process.env},original=auth.configured;
 try{
  process.env.MOMENTUM_ADMIN_EMAIL='owner@example.com';
  process.env.MOMENTUM_ADMIN_EMAIL_LOGIN_ENABLED='false';
  auth.configured=()=>({base:'https://example.supabase.co',anon:'test'});
  assert.equal(helper.enabled(),false);
  process.env.MOMENTUM_ADMIN_EMAIL_LOGIN_ENABLED='true';
  assert.equal(helper.enabled(),true);
  auth.configured=()=>null;
  assert.equal(helper.enabled(),false);
 }finally{auth.configured=original;process.env.MOMENTUM_ADMIN_EMAIL=prior.MOMENTUM_ADMIN_EMAIL;process.env.MOMENTUM_ADMIN_EMAIL_LOGIN_ENABLED=prior.MOMENTUM_ADMIN_EMAIL_LOGIN_ENABLED;}
});

test('only allowlisted administrator receives an OTP and can verify',async()=>{
 const old={email:process.env.MOMENTUM_ADMIN_EMAIL,enabled:process.env.MOMENTUM_ADMIN_EMAIL_LOGIN_ENABLED,configured:auth.configured,call:auth.authCall};
 let calls=[];
 try{
  process.env.MOMENTUM_ADMIN_EMAIL='owner@example.com';
  process.env.MOMENTUM_ADMIN_EMAIL_LOGIN_ENABLED='true';
  auth.configured=()=>({base:'https://example.supabase.co',anon:'test'});
  auth.authCall=async(path,{body})=>{
   calls.push({path,body});
   if(path==='otp')return {};
   return {access_token:'mock-session',user:{id:'example-id',email:'owner@example.com',email_confirmed_at:'2026-10-27T00:00:00Z'}};
  };
  assert.equal(await helper.send('intruder@example.com'),false);
  assert.equal(calls.length,0);
  assert.equal(await helper.send('owner@example.com'),true);
  assert.equal(calls[0].path,'otp');
  assert.equal(calls[0].body.create_user,true);
  assert.equal(await helper.verify('intruder@example.com','123456'),false);
  assert.equal(await helper.verify('owner@example.com','wrong'),false);
  assert.equal(calls.length,1);
  assert.equal(await helper.verify('owner@example.com','123456'),true);
  assert.equal(calls[1].path,'verify');
  auth.authCall=async()=>({access_token:'mock-session',user:{id:'example-id',email:'intruder@example.com',email_confirmed_at:'2026-10-27T00:00:00Z'}});
  assert.equal(await helper.verify('owner@example.com','123456'),false);
 }finally{
  auth.configured=old.configured;auth.authCall=old.call;
  if(old.email===undefined)delete process.env.MOMENTUM_ADMIN_EMAIL;else process.env.MOMENTUM_ADMIN_EMAIL=old.email;
  if(old.enabled===undefined)delete process.env.MOMENTUM_ADMIN_EMAIL_LOGIN_ENABLED;else process.env.MOMENTUM_ADMIN_EMAIL_LOGIN_ENABLED=old.enabled;
 }
});
