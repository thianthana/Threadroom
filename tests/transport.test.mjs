import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveAPI,SetupRequiredAPI,validEndpoint} from '../dist/api.mjs';
const endpoint='https://script.google.com/macros/s/test-deployment/exec';
test('unconfigured website cannot save orders or authenticate an admin locally',async()=>{
  const api=new SetupRequiredAPI();assert.equal((await api.bootstrap()).connected,false);assert.equal((await api.bootstrap()).settings.open,false);await assert.rejects(api.save({items:{}}),{code:'SETUP'});await assert.rejects(api.adminLogin('246813'),{code:'SETUP'});assert.equal(api.user,null);
  assert.equal(validEndpoint('https://example.com/exec'),false);assert.throws(()=>new LiveAPI(''));
});
test('admin authentication sends PIN once to the server and stores only the returned session token',async t=>{
  const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},calls=[];
  const actor={email:'admin',name:'ผู้ดูแลระบบ',role:'admin',authMethod:'pin'};
  t.mock.method(globalThis,'fetch',async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});return {ok:true,json:async()=>({ok:true,data:body.action==='adminLogin'?{token:'test-token',user:actor}:{user:actor,order:{items:{polo:null,tee:null},revision:0},settings:{open:true},logs:[]}})}});
  const api=new LiveAPI(endpoint,storage);const d=await api.adminLogin('246813');assert.equal(d.user.role,'admin');assert.equal(calls[0].body.action,'adminLogin');assert.equal(calls[0].body.pin,'246813');assert.equal(calls[1].body.action,'load');assert.equal(calls[1].body.pin,undefined);assert.equal(saved.get('threadroom-token'),'test-token');assert.equal(JSON.stringify([...saved]).includes('246813'),false);
});
test('server refusal clears an expired session and never falls back to local orders',async t=>{
  const saved=new Map([['threadroom-token','expired']]),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({ok:false,code:'AUTH',error:'Session expired'})}));
  const api=new LiveAPI(endpoint,storage);await assert.rejects(api.load(),{code:'AUTH'});assert.equal(api.token,'');assert.equal(saved.size,0);assert.equal(api.user,null);
});
