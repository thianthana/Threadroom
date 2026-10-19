import test from 'node:test';
import assert from 'node:assert/strict';
import {PRODUCTS,SIZES,FITS,EMPTY_ITEMS,measurements,orderStatus,isClosed,changeOrder,clone} from '../dist/domain.mjs';
import {buildModel} from '../dist/mannequin.mjs';
import {DemoAPI} from '../dist/api.mjs';
const actor={email:'buyer@example.com',name:'Buyer',role:'user'};
const admin={email:'admin@example.com',name:'Admin',role:'admin'};
const base=()=>({email:actor.email,name:actor.name,items:clone(EMPTY_ITEMS),revision:0});
const open={open:true,closeAt:''};
const polo={size:'SS',fit:'shaped'},tee={size:'4XL',fit:'straight'};
test('one shirt can be confirmed first; completion requires both designs',()=>{
  const first=changeOrder(base(),{items:{polo},expectedRevision:0},actor,open);
  assert.deepEqual(orderStatus(first.order.items),{count:1,complete:false,label:'ยืนยันแล้ว 1 จาก 2 แบบ'});
  const second=changeOrder(first.order,{items:{tee},expectedRevision:1},actor,open);
  assert.equal(orderStatus(second.order.items).complete,true);
  assert.equal(second.order.revision,2);assert.deepEqual(second.order.items.polo,polo);
});
test('confirm both, modify either design, and preserve full before/after snapshots',()=>{
  const first=changeOrder(base(),{items:{polo,tee},expectedRevision:0},actor,open);
  const next=changeOrder(first.order,{items:{polo:{size:'M',fit:'straight'}},expectedRevision:1},actor,open);
  assert.equal(orderStatus(next.order.items).count,2);assert.deepEqual(next.log.before.polo,polo);assert.equal(next.log.after.polo.size,'M');assert.deepEqual(first.order.items.polo,polo);
});
test('all body choices can order either fit at every size',()=>{
  for(const size of SIZES)for(const fit of FITS){const out=changeOrder(base(),{items:{polo:{size,fit:fit.id}},expectedRevision:0},actor,open);assert.equal(out.order.items.polo.fit,fit.id)}
});
test('invalid sizes, fits, product ids, unauthorized and stale changes are rejected',()=>{
  for(const items of [{polo:{size:'XXXS',fit:'straight'}},{polo:{size:'M',fit:'male-only'}},{other:polo}])assert.throws(()=>changeOrder(base(),{items,expectedRevision:0},actor,open));
  assert.throws(()=>changeOrder(base(),{items:{polo},expectedRevision:0},{...actor,email:'other@example.com'},open),/สิทธิ์/);
  assert.throws(()=>changeOrder(base(),{items:{polo},expectedRevision:8},actor,open),/โหลด/);
  assert.throws(()=>changeOrder(base(),{items:{polo:null},expectedRevision:0},actor,open),/แอดมิน/);
});
test('closed state and exact scheduled deadline block buyer AND admin writes',()=>{
  const deadline=Date.parse('2026-10-20T18:00:00+07:00');const s={open:true,closeAt:'2026-10-20T11:00:00Z'};
  assert.equal(isClosed(s,deadline-1),false);assert.equal(isClosed(s,deadline),true);
  for(const a of [actor,admin])assert.throws(()=>changeOrder(base(),{items:{polo},reason:'test',expectedRevision:0},a,s,deadline),/ปิด/);
  assert.equal(isClosed({open:false}),true);
});
test('admin resets only selected design and logs previous selection',()=>{
  const current={...base(),items:{polo,tee},revision:3};const out=changeOrder(current,{items:{polo:null},reason:'เจ้าของขอเลือกใหม่',expectedRevision:3},admin,open);
  assert.equal(out.order.items.polo,null);assert.deepEqual(out.order.items.tee,tee);assert.deepEqual(out.log.before.polo,polo);assert.equal(out.log.action,'reset');assert.equal(out.log.actor,admin.email);
  assert.throws(()=>changeOrder(current,{items:{polo:null},expectedRevision:3},admin,open),/เหตุผล/);
});
test('each size and fit changes the actual mesh dimensions without nonfinite vertices',()=>{
  for(const product of PRODUCTS)for(const body of ['female','male'])for(const fit of FITS){let previous=0;for(const size of SIZES){const m=buildModel({product:product.id,body,fit:fit.id,size});assert.ok(m.width>previous);previous=m.width;assert.ok(m.faces.length>1000);for(const face of m.faces)for(const v of face.vertices)assert.ok(v.every(Number.isFinite));}}
  assert.notDeepEqual(buildModel({fit:'shaped'}).faces,buildModel({fit:'straight'}).faces);
});
test('demo edit, role switch, admin reset and email simulation work as one flow',async()=>{
  const cache=new Map(),storage={getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v)},api=new DemoAPI(storage);
  await api.loginDemo('user');await api.save({items:{polo,tee},expectedRevision:0});
  await api.loginDemo('admin');assert.equal((await api.admin()).orders.length,1);
  await api.save({items:{polo:null},reason:'test reset',expectedRevision:1},'visitor@example.com');
  const d=await api.admin();assert.equal(d.outbox.length,1);assert.equal(d.outbox[0].status,'demo');assert.equal(d.logs.length,2);
  await api.loginDemo('user');assert.equal((await api.load()).order.items.polo,null);assert.equal((await api.load()).logs.length,2);
  const restored=new DemoAPI(storage);await restored.loginDemo('user');assert.equal((await restored.load()).order.revision,2);
  await api.loginDemo('admin');await api.updateSettings({open:false,closeAt:'',expectedRevision:0});await api.loginDemo('user');await assert.rejects(api.save({items:{polo},expectedRevision:2}),/ปิด/);
});
test('admin can order for themselves through the personal workflow',async()=>{
  const api=new DemoAPI({getItem:()=>null,setItem:()=>{}});await api.loginDemo('admin');const result=await api.save({items:{polo,tee},expectedRevision:0});assert.equal(result.mailStatus,null);assert.equal((await api.admin()).outbox.length,0);
});
