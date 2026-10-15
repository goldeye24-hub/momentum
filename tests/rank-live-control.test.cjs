'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createController}=require('../api/_rank-live-control');
const measured=(rank=9)=>({status:'ranked',rank,scope:'naver_mobile_place_list',
 source:'browser_observed',observedAt:'2026-10-15T09:00:00.000Z'});

test('cache reuses actual observation with the original timestamp and does not consume quota',async()=>{
 let t=1000,calls=0;
 const c=createController({now:()=>t,maxRequests:1,ttlMs:10000});
 const run=()=>{calls++;return Promise.resolve(measured())};
 const first=await c.handle({key:'mobile\n포항맛집\nid',ip:'1',measure:run});
 assert.equal(first.code,200);assert.equal(first.data.cached,undefined);
 const again=await c.handle({key:'mobile\n포항맛집\nid',ip:'1',measure:run});
 assert.equal(again.code,200);assert.equal(again.data.cached,true);
 assert.equal(again.data.observedAt,first.data.observedAt);
 assert.equal(calls,1);
 const other=await c.handle({key:'mobile\n부산맛집\nid',ip:'1',measure:run});
 assert.equal(other.code,429);assert.equal(calls,1);
});
test('concurrent identical rank queries share one external observation',async()=>{
 let release,calls=0;
 const wait=new Promise(resolve=>{release=resolve});
 const c=createController();
 const measure=async()=>{calls++;await wait;return measured()};
 const a=c.handle({key:'same',ip:'1',measure});
 const b=c.handle({key:'same',ip:'2',measure});
 release();
 const [one,two]=await Promise.all([a,b]);
 assert.equal(calls,1);
 assert.equal(one.code,200);assert.equal(two.code,200);
 assert.equal(two.data.cached,true);
});
test('source HTTP 429 opens circuit, serves stale only if clearly labelled, and never retries',async()=>{
 let t=1000,calls=0;
 const c=createController({now:()=>t,ttlMs:5000,blockMs:3600000});
 const ok=await c.handle({key:'a',ip:'1',measure:async()=>{calls++;return measured(85)}});
 assert.equal(ok.data.rank,85);
 t+=6000;
 const blocked=await c.handle({key:'b',ip:'1',measure:async()=>{calls++;return {status:'blocked',providerHttpStatus:429,retryAfterSeconds:3600}}});
 assert.equal(blocked.code,503);assert.equal(blocked.data.status,'source_rate_limited');
 const previous=await c.handle({key:'a',ip:'3',measure:async()=>{calls++;return measured(80)}});
 assert.equal(previous.code,200);assert.equal(previous.data.rank,85);
 assert.equal(previous.data.stale,true);assert.equal(previous.data.cached,true);
 assert.equal(previous.data.observedAt,'2026-10-15T09:00:00.000Z');
 const newTarget=await c.handle({key:'c',ip:'4',measure:async()=>{calls++;return measured(90)}});
 assert.equal(newTarget.code,503);assert.equal(newTarget.data.rank,null);
 assert.equal(calls,2);
 t+=3601000;
 const after=await c.handle({key:'c',ip:'4',measure:async()=>{calls++;return measured(90)}});
 assert.equal(after.code,200);assert.equal(calls,3);
});
test('provider denied HTTP 403 also stops new calls without CAPTCHA or alternative routes',async()=>{
 const c=createController();
 let calls=0;
 const once=await c.handle({key:'a',ip:'1',measure:async()=>{calls++;return {status:'blocked',providerHttpStatus:403}}});
 const next=await c.handle({key:'b',ip:'1',measure:async()=>{calls++;return measured()}});
 assert.equal(once.code,503);assert.equal(next.code,503);assert.equal(calls,1);
});
test('other failures must not be cached as measured ranks',async()=>{
 let calls=0;
 const c=createController();
 const fn=()=>{calls++;return Promise.resolve({status:'no_place_block',rank:null,source:'none'})};
 await c.handle({key:'a',ip:'1',measure:fn});
 await c.handle({key:'a',ip:'1',measure:fn});
 assert.equal(calls,2);
});
