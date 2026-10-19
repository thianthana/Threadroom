import {clone,EMPTY_ITEMS,changeOrder,isClosed} from './domain.mjs';
const KEY='threadroom-demo-v1';
const now=()=>new Date().toISOString();
function fresh(){return {settings:{open:true,closeAt:'',revision:0},orders:[],logs:[],outbox:[]}}
export class DemoAPI {
  constructor(storage=globalThis.localStorage){this.storage=storage;this.demo=true;try{this.db=JSON.parse(storage.getItem(KEY))||fresh()}catch{this.db=fresh()}this.user=null}
  persist(){this.storage.setItem(KEY,JSON.stringify(this.db))}
  async loginDemo(role='user'){this.user={name:role==='admin'?'แอดมินทดลอง':'ผู้สั่งทดลอง',email:role==='admin'?'admin@example.com':'visitor@example.com',role};return {user:clone(this.user),...await this.load()}}
  async logout(){this.user=null}
  ensure(){if(!this.user)throw new Error('กรุณาเข้าสู่ระบบก่อน')}
  ownOrder(){return this.db.orders.find(x=>x.email===this.user.email)||{id:this.user.email,email:this.user.email,name:this.user.name,items:clone(EMPTY_ITEMS),revision:0,updatedAt:''}}
  async bootstrap(){return {settings:clone(this.db.settings),sampleSizes:true}}
  async load(){this.ensure();return {user:clone(this.user),order:clone(this.ownOrder()),logs:clone(this.db.logs.filter(x=>x.email===this.user.email)),settings:clone(this.db.settings),sampleSizes:true}}
  async save(patch,email){this.ensure();const target=email||this.user.email;let current=this.db.orders.find(x=>x.email===target);if(!current){if(target!==this.user.email)throw new Error('ไม่พบผู้สั่ง');current=this.ownOrder()}const actor=email?this.user:{...this.user,role:'user'};const out=changeOrder(current,patch,actor,this.db.settings);const i=this.db.orders.findIndex(x=>x.email===target);if(i<0)this.db.orders.push(out.order);else this.db.orders[i]=out.order;this.db.logs.push(out.log);if(email&&this.user.role==='admin')this.db.outbox.push({id:out.log.id,to:target,at:now(),status:'demo',subject:'มีการแก้ไข/เปลี่ยนแปลงข้อมูลการสั่งเสื้อของท่าน',reason:patch.reason});this.persist();return {...out,mailStatus:email&&this.user.role==='admin'?'demo':null}}
  async admin(){this.ensure();if(this.user.role!=='admin')throw new Error('ไม่มีสิทธิ์แอดมิน');return {orders:clone(this.db.orders),logs:clone(this.db.logs),outbox:clone(this.db.outbox),settings:clone(this.db.settings)}}
  async updateSettings(settings){this.ensure();if(this.user.role!=='admin')throw new Error('ไม่มีสิทธิ์แอดมิน');if(settings.expectedRevision!==this.db.settings.revision)throw new Error('การตั้งค่าเปลี่ยนแล้ว กรุณาโหลดใหม่');const before=clone(this.db.settings);this.db.settings={open:!!settings.open,closeAt:settings.closeAt||'',revision:this.db.settings.revision+1};this.db.logs.push({id:crypto.randomUUID(),email:'',actor:this.user.email,role:'admin',action:'settings',before,after:clone(this.db.settings),reason:'เปลี่ยนการเปิดรับ/เวลาปิด',at:now()});this.persist();return {settings:clone(this.db.settings)}}
  async seed(){this.ensure();if(this.user.role!=='admin')throw new Error('ไม่มีสิทธิ์');for(const [i,name] of ['สมาชิกตัวอย่าง A','สมาชิกตัวอย่าง B','สมาชิกตัวอย่าง C'].entries()){const email=`sample${i+1}@example.com`;if(!this.db.orders.some(o=>o.email===email))this.db.orders.push({id:email,name,email,items:{polo:{size:['M','L','S'][i],fit:i===1?'straight':'shaped'},tee:i===2?null:{size:['L','XL'][i],fit:'straight'}},revision:1,updatedAt:now()})}this.persist();return this.admin()}
  async clearDemo(){this.db=fresh();this.persist();return this.load()}
}
export class LiveAPI {
  constructor(url){if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))throw new Error('กรุณาตั้งค่า URL ของ Apps Script ให้ถูกต้อง');this.url=url;this.demo=false;this.token=sessionStorage.getItem('threadroom-token')||'';this.user=null}
  async call(action,data={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);try{const r=await fetch(this.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},redirect:'follow',credentials:'omit',body:JSON.stringify({action,token:this.token,...data}),signal:controller.signal});if(!r.ok)throw new Error('เชื่อมต่อระบบไม่สำเร็จ');let out;try{out=await r.json()}catch{throw new Error('ระบบไม่ตอบกลับเป็น JSON กรุณาตรวจการ Deploy Apps Script')}if(!out.ok){if(out.code==='AUTH'){this.token='';sessionStorage.removeItem('threadroom-token')}const error=new Error(out.error||'ทำรายการไม่สำเร็จ');error.code=out.code;throw error}return out.data} catch(e){if(e.name==='AbortError')throw new Error('ระบบตอบช้า กรุณาโหลดรายการล่าสุดก่อนลองบันทึกอีกครั้ง');throw e}finally{clearTimeout(timer)}}
  bootstrap(){return this.call('bootstrap')}
  requestCode(email,name){return this.call('requestCode',{email,name})}
  async verifyCode(email,code){const result=await this.call('verifyCode',{email,code});this.token=result.token;sessionStorage.setItem('threadroom-token',this.token);this.user=result.user;return this.load()}
  async load(){const d=await this.call('load');this.user=d.user;return d}
  async logout(){try{await this.call('logout')}finally{this.token='';this.user=null;sessionStorage.removeItem('threadroom-token')}}
  save(patch,email){return this.call(email?'adminSave':'save',{patch,requestId:crypto.randomUUID(),...(email?{email}:{})})}
  admin(){return this.call('admin')}
  updateSettings(settings){return this.call('settings',{settings,requestId:crypto.randomUUID()})}
}
