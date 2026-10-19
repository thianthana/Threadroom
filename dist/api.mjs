export const validEndpoint=url=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(url||''));
export class SetupRequiredAPI {
  constructor(){this.demo=false;this.configured=false;this.token='';this.user=null}
  async bootstrap(){return {connected:false,needsSetup:true,sampleSizes:true,settings:{open:false,closeAt:'',revision:0}}}
  async call(){const e=new Error('ยังไม่ได้เชื่อม Google Apps Script กรุณาให้เจ้าของระบบติดตั้งก่อนเปิดรับคำสั่งซื้อ');e.code='SETUP';throw e}
  requestCode(){return this.call()}adminLogin(){return this.call()}load(){return this.call()}admin(){return this.call()}save(){return this.call()}updateSettings(){return this.call()}
  async logout(){this.user=null;this.token=''}
}
export class LiveAPI {
  constructor(url,storage=globalThis.sessionStorage){if(!validEndpoint(url))throw new Error('URL ของ Apps Script ไม่ถูกต้อง');this.url=url;this.storage=storage;this.demo=false;this.configured=true;this.token=storage?.getItem('threadroom-token')||'';this.user=null}
  async call(action,data={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(this.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},redirect:'follow',credentials:'omit',body:JSON.stringify({action,token:this.token,...data}),signal:controller.signal});
      if(!response.ok)throw new Error('เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่');
      let out;try{out=await response.json()}catch{throw new Error('ปลายทางยังไม่พร้อม กรุณาตรวจการ Deploy Apps Script')}
      if(!out.ok){if(out.code==='AUTH'){this.token='';this.user=null;this.storage?.removeItem('threadroom-token')}const error=new Error(out.error||'ทำรายการไม่สำเร็จ');error.code=out.code;throw error}
      return out.data;
    }catch(e){if(e.name==='AbortError'){const error=new Error('ระบบตอบช้า กรุณาโหลดรายการล่าสุดก่อนลองบันทึกอีกครั้ง');error.code='TIMEOUT';throw error}throw e}
    finally{clearTimeout(timer)}
  }
  bootstrap(){return this.call('bootstrap')}
  requestCode(email,name){return this.call('requestCode',{email,name})}
  async acceptSession(result){if(!result.token||!result.user)throw new Error('ข้อมูลเข้าสู่ระบบไม่ครบ');this.token=result.token;this.user=result.user;this.storage?.setItem('threadroom-token',this.token);return this.load()}
  async verifyCode(email,code){return this.acceptSession(await this.call('verifyCode',{email,code}))}
  async adminLogin(pin){return this.acceptSession(await this.call('adminLogin',{pin}))}
  async load(){const d=await this.call('load');this.user=d.user;return d}
  async logout(){try{await this.call('logout')}finally{this.token='';this.user=null;this.storage?.removeItem('threadroom-token')}}
  save(patch,email){return this.call(email?'adminSave':'save',{patch,requestId:crypto.randomUUID(),...(email?{email}:{})})}
  admin(){return this.call('admin')}
  updateSettings(settings){return this.call('settings',{settings,requestId:crypto.randomUUID()})}
}
