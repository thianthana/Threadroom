export const PRODUCTS = [
  { id: 'polo', name: 'เสื้อโปโล', label: 'THE EVERYDAY POLO', short: '01', color: '#26364b', accent: '#d9e5ce', subtitle: 'เรียบ เท่ พร้อมไปด้วยกัน', material: 'ตัวอย่างแบบเสื้อ · รอใส่ลายจริง' },
  { id: 'tee', name: 'เสื้อยืด', label: 'THE WEEKEND TEE', short: '02', color: '#e8e4d9', accent: '#374b44', subtitle: 'สบาย เป็นตัวเรา ในทุกวัน', material: 'ตัวอย่างแบบเสื้อ · รอใส่ลายจริง' }
];
export const SIZES = ['SS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
export const FITS = [{id:'straight',name:'ทรงตรง'},{id:'shaped',name:'ทรงเว้า'}];
export const EMPTY_ITEMS = {polo:null,tee:null};
export const clone = x => JSON.parse(JSON.stringify(x));
export function measurements(size,fit='straight') {
  const i=SIZES.indexOf(size); if(i<0) throw new Error('ไซซ์ไม่ถูกต้อง');
  const chest=34+i*2;
  return {chest, waist:chest-(fit==='shaped'?4:0), length:25+i*.5, shoulder:14.5+i*.5};
}
export function validateItem(item) {
  if(!item || !SIZES.includes(item.size) || !FITS.some(f=>f.id===item.fit)) throw new Error('กรุณาเลือกไซซ์และทรงให้ถูกต้อง');
  return {size:item.size,fit:item.fit};
}
export function isClosed(settings,now=Date.now()) {
  return settings.open === false || (!!settings.closeAt && now>=Date.parse(settings.closeAt));
}
export function orderStatus(items) {
  const count=PRODUCTS.filter(p=>items?.[p.id]).length;
  return {count, complete:count===2, label:count===2?'ยืนยันครบแล้ว':count===1?'ยืนยันแล้ว 1 จาก 2 แบบ':'ยังไม่ได้เลือก'};
}
export function changeOrder(current,patch,actor,settings,now=Date.now()) {
  if(isClosed(settings,now)) throw new Error('ระบบปิดรับการแก้ไขแล้ว');
  if(!actor?.email) throw new Error('กรุณาเข้าสู่ระบบ');
  if(actor.role!=='admin' && current.email!==actor.email) throw new Error('ไม่มีสิทธิ์แก้ไขรายการนี้');
  if(patch.expectedRevision!==current.revision) throw new Error('รายการเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุด');
  if(actor.role==='admin' && !String(patch.reason||'').trim()) throw new Error('กรุณาระบุเหตุผลในการแก้ไข');
  const items=clone(current.items||EMPTY_ITEMS), before=clone(items);
  const updates=patch.items||{};
  if(Object.keys(updates).some(id=>!PRODUCTS.some(p=>p.id===id))) throw new Error('แบบเสื้อไม่ถูกต้อง');
  for(const [id,item] of Object.entries(updates)) {
    if(item===null) {if(actor.role!=='admin') throw new Error('เฉพาะแอดมินที่ล้างรายการได้');items[id]=null;}
    else items[id]=validateItem(item);
  }
  if(JSON.stringify(items)===JSON.stringify(before)) throw new Error('ข้อมูลเหมือนเดิม ยังไม่มีรายการเปลี่ยนแปลง');
  const updated={...current,items,revision:current.revision+1,updatedAt:new Date(now).toISOString()};
  return {order:updated,log:{id:globalThis.crypto?.randomUUID?.()||String(now),email:current.email,actor:actor.email,role:actor.role,action:Object.values(updates).some(x=>x===null)?'reset':'update',reason:String(patch.reason||''),before,after:clone(items),revision:updated.revision,at:updated.updatedAt}};
}
