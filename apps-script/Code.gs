/** THREADROOM / 07 — Google Apps Script V8. See README-TH.md before deployment. */
const DEFAULT_SPREADSHEET_ID = '1S4waTYrvCnnWEjIgObwnwoGG_ynNyAGIEEanP25L_lY';
const HEADERS = {
  Orders:['id','email','name','items_json','revision','updated_at'],
  AuditLog:['id','at','email','actor','role','action','reason','before_json','after_json','revision','request_id'],
  Users:['email','name','created_at'],
  Settings:['key','value'],
  AuthCodes:['email','name','code_hash','expires_at','attempts','last_sent_at','request_count','window_start_at'],
  Sessions:['token_hash','email','expires_at','created_at'],
  Outbox:['id','to','subject','body','status','attempts','updated_at','last_error'],
  Requests:['id','email','result_json','at']
};
const ALLOWED_SIZES = ['SS','S','M','L','XL','2XL','3XL','4XL'];
const PRODUCT_IDS = ['polo','tee'];
const ADMIN_SESSION_EMAIL = '__threadroom_admin_pin__';

/** Set ADMIN_PIN in private Script Properties, then run setup() once. */
function setup() {
  const p=PropertiesService.getScriptProperties();
  const rawPin=p.getProperty('ADMIN_PIN');
  if(rawPin&&!/^\d{6}$/.test(rawPin))throw new Error('ADMIN_PIN ต้องเป็นตัวเลข 6 หลัก');
  let id=p.getProperty('SPREADSHEET_ID')||DEFAULT_SPREADSHEET_ID;
  const ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.create('THREADROOM 07 — Orders');
  const installRow=rows_(ss,'Settings').find(r=>r.key==='_installCredentials');
  let install=null;
  if(!rawPin&&!p.getProperty('ADMIN_PIN_HASH')&&installRow&&installRow.value){
    try{install=JSON.parse(installRow.value)}catch(e){throw new Error('ข้อมูลตั้งต้นรหัสแอดมินไม่ถูกต้อง')}
    if(!install||!/^\w{64}$/.test(install.secret)||!/^[A-Za-z0-9_-]{43}$/.test(install.hash))throw new Error('ข้อมูลตั้งต้นรหัสแอดมินไม่ครบ');
  }
  if(!rawPin&&!p.getProperty('ADMIN_PIN_HASH')&&!install)throw new Error('ตั้ง ADMIN_PIN ใน Script Properties เป็นรหัสแอดมิน 6 หลักก่อนรัน setup()');
  p.setProperty('SPREADSHEET_ID',ss.getId());
  if(install){p.setProperty('SESSION_SECRET',install.secret);p.setProperty('ADMIN_PIN_HASH',install.hash)}
  if(!p.getProperty('SESSION_SECRET'))p.setProperty('SESSION_SECRET',Utilities.getUuid()+Utilities.getUuid());
  if(rawPin){p.setProperty('ADMIN_PIN_HASH',hashCode_('threadroom-admin',rawPin));p.deleteProperty('ADMIN_PIN');p.deleteProperty('ADMIN_AUTH_FAILED');p.deleteProperty('ADMIN_AUTH_WINDOW');p.deleteProperty('ADMIN_AUTH_LOCK_UNTIL')}
  if(!p.getProperty('PUBLIC_SITE_URL'))p.setProperty('PUBLIC_SITE_URL','https://thianthana.github.io/Threadroom/');
  Object.keys(HEADERS).forEach(name=>{
    const s=ss.getSheetByName(name)||ss.insertSheet(name);
    if(s.getLastRow()===0){s.getRange(1,1,1,HEADERS[name].length).setValues([HEADERS[name]]);s.setFrozenRows(1);s.getRange(1,1,1,HEADERS[name].length).setBackground('#30493a').setFontColor('#ffffff').setFontWeight('bold');s.setColumnWidths(1,HEADERS[name].length,170)}
    const actual=s.getRange(1,1,1,HEADERS[name].length).getValues()[0];
    if(JSON.stringify(actual)!==JSON.stringify(HEADERS[name]))throw new Error('หัวตาราง '+name+' ไม่ตรงกับ schema กรุณาใช้ไฟล์ฐานข้อมูลที่ถูกต้อง');
  });
  if(rows_(ss,'Settings').length===0){ss.getSheetByName('Settings').getRange(2,1,4,2).setValues([['open','false'],['closeAt',''],['revision','0'],['sizesConfirmed','false']])}
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='flushOutbox'))ScriptApp.newTrigger('flushOutbox').timeBased().everyMinutes(5).create();
  ss.setSpreadsheetTimeZone('Asia/Bangkok');SpreadsheetApp.flush();
  if(installRow&&installRow.value&&p.getProperty('ADMIN_PIN_HASH'))ss.getSheetByName('Settings').getRange(installRow._row,2).setValue('');
  console.log('Setup complete. Sheet: '+ss.getUrl());
  return ss.getUrl();
}
function doGet(){return json_({ok:true,data:{service:'THREADROOM / 07',message:'Use POST for app actions.'}})}
function doPost(e){
  try{
    const body=e&&e.postData&&e.postData.contents||'';
    if(body.length>24000)fail_('คำขอมีขนาดใหญ่เกินไป');
    let r;try{r=JSON.parse(body)}catch(_){fail_('รูปแบบคำขอไม่ถูกต้อง')}
    if(!r||typeof r!=='object'||Array.isArray(r))fail_('รูปแบบคำขอไม่ถูกต้อง');
    const data=withLock_(function(){return dispatch_(r)});
    return json_({ok:true,data:data});
  }catch(err){
    if(err.publicError)return json_({ok:false,error:err.message,code:err.code||'VALIDATION'});
    console.error('THREADROOM server error: '+String(err.message).slice(0,500));
    return json_({ok:false,error:'ระบบยังไม่พร้อม กรุณาตรวจการติดตั้งหรือติดต่อแอดมิน',code:'SERVER'});
  }
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)}
function fail_(message,code){const e=new Error(message);e.publicError=true;e.code=code||'VALIDATION';throw e}
function withLock_(fn){const l=LockService.getScriptLock();if(!l.tryLock(12000))fail_('มีผู้ทำรายการพร้อมกัน กรุณาลองอีกครั้ง','BUSY');try{return fn()}finally{l.releaseLock()}}
function book_(){const p=PropertiesService.getScriptProperties(),id=p.getProperty('SPREADSHEET_ID');if(!id||!p.getProperty('SESSION_SECRET'))fail_('ระบบยังไม่ได้ติดตั้ง กรุณาให้แอดมินรัน setup()');return SpreadsheetApp.openById(id)}
function rows_(ss,name){const s=ss.getSheetByName(name);if(!s||s.getLastRow()<2)return [];return s.getRange(2,1,s.getLastRow()-1,HEADERS[name].length).getValues().map((r,i)=>{const o={_row:i+2};HEADERS[name].forEach((h,j)=>o[h]=r[j]);return o})}
function writeRow_(ss,name,row,values){atomic_(ss,[updateRequest_(ss,name,row,values)])}
function append_(ss,name,values){writeRow_(ss,name,ss.getSheetByName(name).getLastRow()+1,values)}
function digest_(s){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8))}
function hashCode_(email,code){const secret=PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(email+':'+code,secret)).replace(/=+$/,'')}
function equal_(a,b){a=String(a);b=String(b);let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
function email_(email){const v=String(email||'').trim().toLowerCase();if(v.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(v)||/[\r\n]/.test(v))fail_('อีเมลไม่ถูกต้อง');return v}
function name_(name){const n=String(name||'').trim().replace(/[\x00-\x1f]/g,'');if(!n||n.length>100)fail_('กรุณาระบุชื่อไม่เกิน 100 ตัวอักษร');return n}
function adminEmails_(){return (PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)}
function settings_(ss){const map={};rows_(ss,'Settings').forEach(r=>map[r.key]=r.value);return {open:String(map.open)==='true',closeAt:String(map.closeAt||''),revision:Number(map.revision||0),sizesConfirmed:String(map.sizesConfirmed)==='true'}}
function closed_(s,now){return s.open===false||!!s.closeAt&&(now||Date.now())>=Date.parse(s.closeAt)}
function actor_(ss,token){
  if(typeof token!=='string'||token.length<40||token.length>200)fail_('กรุณาเข้าสู่ระบบ','AUTH');
  const hash=digest_(token),session=rows_(ss,'Sessions').find(s=>equal_(s.token_hash,hash));
  if(!session||Date.parse(session.expires_at)<=Date.now())fail_('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่','AUTH');
  if(session.email===ADMIN_SESSION_EMAIL)return {email:'admin',name:'ผู้ดูแลระบบ',role:'admin',authMethod:'pin'};
  const user=rows_(ss,'Users').find(u=>u.email===session.email);if(!user)fail_('กรุณาเข้าสู่ระบบใหม่','AUTH');
  return {email:user.email,name:user.name,role:'user',authMethod:'email'};
}
function requireAdmin_(actor){if(actor.role!=='admin')fail_('ไม่มีสิทธิ์ผู้ดูแลระบบ','FORBIDDEN')}
function readOrder_(r){if(!r)return null;return {id:r.id,email:r.email,name:r.name,items:JSON.parse(r.items_json),revision:Number(r.revision),updatedAt:r.updated_at}}
function blankOrder_(actor){return {id:Utilities.getUuid(),email:actor.email,name:actor.name,items:{polo:null,tee:null},revision:0,updatedAt:''}}
function readLog_(r){return {id:r.id,at:r.at,email:r.email,actor:r.actor,role:r.role,action:r.action,reason:r.reason,before:JSON.parse(r.before_json),after:JSON.parse(r.after_json),revision:Number(r.revision)}}
function dispatch_(r){
  const ss=book_(),s=settings_(ss);
  if(r.action==='bootstrap')return {settings:s,sampleSizes:!s.sizesConfirmed,connected:true,adminPinConfigured:!!PropertiesService.getScriptProperties().getProperty('ADMIN_PIN_HASH')};
  if(r.action==='adminLogin')return adminLogin_(ss,r);
  if(r.action==='requestCode')return requestCode_(ss,r);
  if(r.action==='verifyCode')return verifyCode_(ss,r);
  const actor=actor_(ss,r.token);
  if(r.action==='logout'){const session=rows_(ss,'Sessions').find(x=>equal_(x.token_hash,digest_(r.token)));if(session)ss.getSheetByName('Sessions').deleteRow(session._row);return {loggedOut:true}}
  if(r.action==='load')return {user:actor,order:readOrder_(rows_(ss,'Orders').find(o=>o.email===actor.email))||blankOrder_(actor),logs:rows_(ss,'AuditLog').filter(l=>l.email===actor.email).map(readLog_),settings:s,sampleSizes:!s.sizesConfirmed};
  if(r.action==='save'){if(actor.authMethod==='pin')fail_('กรุณาเข้าสู่ระบบผู้สั่งด้วยอีเมล เพื่อยืนยันเสื้อของตนเอง');return mutate_(ss,Object.assign({},actor,{role:'user'}),actor.email,r.patch,r.requestId)}
  if(r.action==='adminSave'){requireAdmin_(actor);return mutate_(ss,actor,email_(r.email),r.patch,r.requestId)}
  if(r.action==='admin'){requireAdmin_(actor);return {orders:rows_(ss,'Orders').map(readOrder_),logs:rows_(ss,'AuditLog').map(readLog_),outbox:rows_(ss,'Outbox').map(o=>({id:o.id,to:o.to,status:o.status,attempts:Number(o.attempts),updatedAt:o.updated_at})),settings:s}}
  if(r.action==='settings'){requireAdmin_(actor);return updateSettings_(ss,actor,r.settings,r.requestId)}
  fail_('ไม่พบคำสั่งที่ร้องขอ');
}
function requestCode_(ss,r){
  const email=email_(r.email),name=name_(r.name),now=Date.now();const codes=rows_(ss,'AuthCodes'),old=codes.find(c=>c.email===email);
  if(old&&now-Date.parse(old.last_sent_at)<60000)fail_('กรุณารอ 1 นาทีก่อนขอรหัสใหม่');
  const recent=codes.filter(c=>now-Date.parse(c.window_start_at)<3600000);
  if(recent.reduce((n,c)=>n+Number(c.request_count),0)>=40||MailApp.getRemainingDailyQuota()<10)fail_('ระบบส่งรหัสถึงขีดจำกัดชั่วคราว กรุณาลองภายหลัง');
  let count=1,start=new Date(now).toISOString();if(old&&now-Date.parse(old.window_start_at)<3600000){count=Number(old.request_count)+1;start=old.window_start_at;if(count>6)fail_('ขอรหัสหลายครั้งเกินไป กรุณาลองอีกครั้งใน 1 ชั่วโมง')}
  const code=String(parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,12),16)%100000000).padStart(8,'0');
  const row=old?old._row:ss.getSheetByName('AuthCodes').getLastRow()+1;
  writeRow_(ss,'AuthCodes',row,[email,name,hashCode_(email,code),new Date(now+600000).toISOString(),0,new Date(now).toISOString(),count,start]);
  try{MailApp.sendEmail({to:email,subject:'รหัสเข้าสู่ระบบสั่งเสื้อ THREADROOM / 07',body:'รหัสยืนยันของคุณ: '+code+'\n\nรหัสมีอายุ 10 นาที ใช้เข้าสู่ระบบสั่งเสื้อเท่านั้น\nหากคุณไม่ได้ขอรหัส ให้ข้ามอีเมลนี้ และอย่าส่งต่อรหัสให้ผู้อื่น',name:'THREADROOM / 07'})}catch(e){ss.getSheetByName('AuthCodes').getRange(row,3).setValue('');fail_('ส่งอีเมลไม่สำเร็จ กรุณาติดต่อแอดมินหรือลองใหม่ภายหลัง')}
  return {sent:true,expiresIn:600};
}
function verifyCode_(ss,r){
  const email=email_(r.email),code=String(r.code||'').trim(),c=rows_(ss,'AuthCodes').find(x=>x.email===email);
  if(!c||Number(c.attempts)>=5||Date.parse(c.expires_at)<=Date.now()||!c.code_hash)fail_('รหัสไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่');
  // Persist failed attempts before returning an error; do not roll this write back.
  ss.getSheetByName('AuthCodes').getRange(c._row,5).setValue(Number(c.attempts)+1);SpreadsheetApp.flush();
  if(!/^\d{8}$/.test(code)||!equal_(hashCode_(email,code),c.code_hash))fail_('รหัสไม่ถูกต้องหรือหมดอายุ กรุณาตรวจอีกครั้ง');
  ss.getSheetByName('AuthCodes').getRange(c._row,3).setValue('');SpreadsheetApp.flush();
  let user=rows_(ss,'Users').find(u=>u.email===email);const now=new Date().toISOString();
  if(!user){append_(ss,'Users',[email,c.name,now]);user={email:email,name:c.name}}
  const token=Utilities.getUuid()+Utilities.getUuid();append_(ss,'Sessions',[digest_(token),email,new Date(Date.now()+43200000).toISOString(),now]);
  return {token:token,user:{email:email,name:user.name,role:'user',authMethod:'email'}};
}
function adminLogin_(ss,r){
  const p=PropertiesService.getScriptProperties(),expected=p.getProperty('ADMIN_PIN_HASH');
  if(!expected)fail_('ยังไม่ได้ตั้งรหัสแอดมิน กรุณารัน setup() ให้เรียบร้อย','SETUP');
  const now=Date.now(),locked=Number(p.getProperty('ADMIN_AUTH_LOCK_UNTIL')||0);
  if(locked>now)fail_('กรอกรหัสผิดหลายครั้ง กรุณารอ '+Math.ceil((locked-now)/60000)+' นาที','RATE_LIMIT');
  const pin=typeof r.pin==='string'?r.pin:'';
  if(!/^\d{6}$/.test(pin)||!equal_(hashCode_('threadroom-admin',pin),expected)){
    const start=Number(p.getProperty('ADMIN_AUTH_WINDOW')||0),fresh=now-start>900000;
    const count=fresh?1:Number(p.getProperty('ADMIN_AUTH_FAILED')||0)+1;
    p.setProperty('ADMIN_AUTH_WINDOW',String(fresh?now:start));p.setProperty('ADMIN_AUTH_FAILED',String(count));
    if(count>=5)p.setProperty('ADMIN_AUTH_LOCK_UNTIL',String(now+900000));
    fail_('รหัสแอดมินไม่ถูกต้อง','BAD_PIN');
  }
  p.deleteProperty('ADMIN_AUTH_FAILED');p.deleteProperty('ADMIN_AUTH_WINDOW');p.deleteProperty('ADMIN_AUTH_LOCK_UNTIL');
  const token=Utilities.getUuid()+Utilities.getUuid(),at=new Date(now).toISOString();
  append_(ss,'Sessions',[digest_(token),ADMIN_SESSION_EMAIL,new Date(now+7200000).toISOString(),at]);
  return {token:token,user:{email:'admin',name:'ผู้ดูแลระบบ',role:'admin',authMethod:'pin'}};
}
function nextOrder_(current,patch,actor,settings,now){
  if(closed_(settings,now))fail_('ระบบปิดรับการแก้ไขแล้ว');
  if(actor.role!=='admin'&&current.email!==actor.email)fail_('ไม่มีสิทธิ์แก้ไขรายการนี้','FORBIDDEN');
  if(!patch||patch.expectedRevision!==current.revision)fail_('รายการเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุด','CONFLICT');
  const reason=String(patch.reason||'').trim();if(reason.length>500)fail_('เหตุผลต้องไม่เกิน 500 ตัวอักษร');if(actor.role==='admin'&&!reason)fail_('กรุณาระบุเหตุผลในการแก้ไข');
  const before=JSON.parse(JSON.stringify(current.items)),items=JSON.parse(JSON.stringify(current.items)),updates=patch.items;
  if(!updates||Array.isArray(updates)||typeof updates!=='object'||Object.keys(updates).some(id=>!PRODUCT_IDS.includes(id)))fail_('แบบเสื้อไม่ถูกต้อง');
  Object.keys(updates).forEach(id=>{const item=updates[id];if(item===null){if(actor.role!=='admin')fail_('เฉพาะแอดมินที่ล้างรายการได้');items[id]=null}else{if(!item||!ALLOWED_SIZES.includes(item.size)||!['straight','shaped'].includes(item.fit))fail_('กรุณาเลือกไซซ์และทรงให้ถูกต้อง');items[id]={size:item.size,fit:item.fit}}});
  if(JSON.stringify(items)===JSON.stringify(before))fail_('ข้อมูลเหมือนเดิม ยังไม่มีรายการเปลี่ยนแปลง');
  const updated=Object.assign({},current,{items:items,revision:current.revision+1,updatedAt:new Date(now).toISOString()});
  return {order:updated,log:{id:Utilities.getUuid(),email:current.email,actor:actor.email,role:actor.role,action:Object.keys(updates).some(id=>updates[id]===null)?'reset':'update',reason:reason,before:before,after:items,revision:updated.revision,at:updated.updatedAt}};
}
function requestId_(id){if(typeof id!=='string'||!/^[a-zA-Z0-9-]{16,100}$/.test(id))fail_('รหัสคำขอไม่ถูกต้อง');return id}
function priorRequest_(ss,id,email){const previous=rows_(ss,'Requests').find(x=>x.id===id);if(!previous)return null;if(previous.email!==email)fail_('รหัสคำขอซ้ำ','CONFLICT');return JSON.parse(previous.result_json)}
function cell_(v){if(typeof v==='number')return {userEnteredValue:{numberValue:v}};if(typeof v==='boolean')return {userEnteredValue:{boolValue:v}};return {userEnteredValue:{stringValue:String(v==null?'':v)}}}
function appendRequest_(ss,name,values){return {appendCells:{sheetId:ss.getSheetByName(name).getSheetId(),rows:[{values:values.map(cell_)}],fields:'userEnteredValue'}}}
function updateRequest_(ss,name,row,values){return {updateCells:{start:{sheetId:ss.getSheetByName(name).getSheetId(),rowIndex:row-1,columnIndex:0},rows:[{values:values.map(cell_)}],fields:'userEnteredValue'}}}
function atomic_(ss,requests){SpreadsheetApp.flush();Sheets.Spreadsheets.batchUpdate({requests:requests},ss.getId())}
function mutate_(ss,actor,email,patch,requestId){
  const rid=requestId_(requestId),prior=priorRequest_(ss,rid,actor.email);if(prior)return prior;
  const row=rows_(ss,'Orders').find(o=>o.email===email);
  if(!row&&email!==actor.email)fail_('ไม่พบรายการของผู้สั่งนี้');
  const current=readOrder_(row)||blankOrder_(actor),out=nextOrder_(current,patch,actor,settings_(ss),Date.now());
  const o=out.order,l=out.log,requests=[];
  const values=[o.id,o.email,o.name,JSON.stringify(o.items),o.revision,o.updatedAt];requests.push(row?updateRequest_(ss,'Orders',row._row,values):appendRequest_(ss,'Orders',values));
  requests.push(appendRequest_(ss,'AuditLog',[l.id,l.at,l.email,l.actor,l.role,l.action,l.reason,JSON.stringify(l.before),JSON.stringify(l.after),l.revision,rid]));
  out.mailStatus=null;
  if(actor.role==='admin'){
    out.mailStatus='pending';
    const label=id=>id==='polo'?'เสื้อโปโล':'เสื้อยืด',describe=item=>item?(item.fit==='shaped'?'ทรงเว้า':'ทรงตรง')+' / '+item.size:'ยังไม่ได้เลือก';
    const changes=PRODUCT_IDS.filter(id=>JSON.stringify(l.before[id])!==JSON.stringify(l.after[id])).map(id=>label(id)+': '+describe(l.before[id])+' → '+describe(l.after[id])).join('\n');
    const url=PropertiesService.getScriptProperties().getProperty('PUBLIC_SITE_URL')||'';
    const body='เรียน '+o.name+'\n\nมีการแก้ไข/เปลี่ยนแปลงข้อมูลการสั่งเสื้อของท่านโดยผู้ดูแลระบบ\n\n'+changes+'\n\nเหตุผล: '+l.reason+'\nผู้แก้ไข: '+actor.email+'\nเวลา: '+Utilities.formatDate(new Date(l.at),'Asia/Bangkok','dd/MM/yyyy HH:mm')+' น.\n\n'+(l.action==='reset'?'กรุณาเข้าสู่ระบบเพื่อเลือกเสื้อใหม่ให้ครบทั้ง 2 แบบก่อนปิดระบบ\n':'ท่านสามารถตรวจสอบและปรับเปลี่ยนได้จนกว่าระบบจะปิด\n')+(url?'เข้าสู่ระบบ: '+url+'\n':'')+'\nอ้างอิง: '+l.id;
    requests.push(appendRequest_(ss,'Outbox',[l.id,email,'มีการแก้ไข/เปลี่ยนแปลงข้อมูลการสั่งเสื้อของท่าน',body,'pending',0,l.at,'']));
  }
  requests.push(appendRequest_(ss,'Requests',[rid,actor.email,JSON.stringify(out),l.at]));
  // One atomic Google Sheets API operation: order + audit + email queue + idempotency.
  atomic_(ss,requests);return out;
}
function updateSettings_(ss,actor,input,requestId){
  const rid=requestId_(requestId),prior=priorRequest_(ss,rid,actor.email);if(prior)return prior;
  const before=settings_(ss);if(!input||input.expectedRevision!==before.revision)fail_('การตั้งค่าเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด','CONFLICT');
  if(typeof input.open!=='boolean')fail_('สถานะเปิดรับไม่ถูกต้อง');
  let closeAt='';if(input.closeAt){const n=Date.parse(input.closeAt);if(!Number.isFinite(n))fail_('วันเวลาปิดไม่ถูกต้อง');closeAt=new Date(n).toISOString()}
  const after={open:input.open,closeAt:closeAt,revision:before.revision+1,sizesConfirmed:before.sizesConfirmed};
  const requestRows=rows_(ss,'Settings'),req=[];
  ['open','closeAt','revision'].forEach(key=>{const row=requestRows.find(x=>x.key===key);req.push(row?updateRequest_(ss,'Settings',row._row,[key,String(after[key])]):appendRequest_(ss,'Settings',[key,String(after[key])]))});
  const id=Utilities.getUuid(),at=new Date().toISOString();req.push(appendRequest_(ss,'AuditLog',[id,at,'',actor.email,actor.role,'settings','เปลี่ยนการเปิดรับ/เวลาปิด',JSON.stringify(before),JSON.stringify(after),after.revision,rid]));
  const out={settings:after};req.push(appendRequest_(ss,'Requests',[rid,actor.email,JSON.stringify(out),at]));atomic_(ss,req);return out;
}
/** Time trigger every five minutes. Queued notifications are never sent by the browser. */
function flushOutbox(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try{
    const ss=book_(),quota=MailApp.getRemainingDailyQuota();
    const pending=rows_(ss,'Outbox').filter(x=>x.status==='pending'&&Number(x.attempts)<3).slice(0,Math.min(10,Math.max(0,quota-5)));
    pending.forEach(mail=>{
      let status='sent',error='';const attempts=Number(mail.attempts)+1;
      try{MailApp.sendEmail({to:email_(mail.to),subject:mail.subject,body:mail.body,name:'THREADROOM / 07'})}
      catch(e){status=attempts>=3?'failed':'pending';error='Mail delivery failed; inspect Apps Script executions.'}
      writeRow_(ss,'Outbox',mail._row,[mail.id,mail.to,mail.subject,mail.body,status,attempts,new Date().toISOString(),error]);
    });
    // Remove expired credentials to limit retained sensitive records.
    ['Sessions','AuthCodes'].forEach(name=>{rows_(ss,name).filter(r=>Date.parse(r.expires_at)<Date.now()-86400000).reverse().forEach(r=>ss.getSheetByName(name).deleteRow(r._row))});
  }finally{lock.releaseLock()}
}
/** Manual maintenance, Script editor only. Does not resend already-sent messages. */
function retryFailedEmails(){return withLock_(function(){const ss=book_();rows_(ss,'Outbox').filter(m=>m.status==='failed').forEach(m=>writeRow_(ss,'Outbox',m._row,[m.id,m.to,m.subject,m.body,'pending',0,new Date().toISOString(),'' ]));return 'Queued failed emails for retry'})}
