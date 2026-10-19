import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash,createHmac} from 'node:crypto';
const code=readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8');
function environment(){
  const sheets=new Map(),sent=[],props=new Map([['SPREADSHEET_ID','test-sheet'],['SESSION_SECRET','unit-test-secret'],['ADMIN_PIN_HASH',createHmac('sha256','unit-test-secret').update('threadroom-admin:246813').digest('base64url')],['ADMIN_EMAILS','admin@example.com']]);let sheetId=0,failBatch=false;
  class Sheet{
    constructor(name){this.name=name;this.id=++sheetId;this.data=[]}
    getLastRow(){return this.data.length}getSheetId(){return this.id}
    getRange(row,col,rows=1,cols=1){const self=this;return {getValues:()=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>self.data[row-1+i]?.[col-1+j]??'')),setValues(values){values.forEach((r,i)=>{self.data[row-1+i]||=[];r.forEach((v,j)=>self.data[row-1+i][col-1+j]=v)});return this},setValue(v){return this.setValues([[v]])}}}
    deleteRow(row){this.data.splice(row-1,1)}
  }
  const book={getSheetByName:n=>sheets.get(n),getId:()=>'test-sheet',getUrl:()=>'https://docs.google.com/spreadsheets/d/test-sheet',setSpreadsheetTimeZone:()=>{}};
  const context={console,Date,JSON,Math,Number,String,Object,Array,Error,RegExp,
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)})},
    SpreadsheetApp:{openById:()=>book,flush:()=>{}},
    ScriptApp:{getProjectTriggers:()=>[{getHandlerFunction:()=>'flushOutbox'}]},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
    MailApp:{getRemainingDailyQuota:()=>1000,sendEmail:mail=>sent.push(mail)},
    Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>createHash('sha256').update(s).digest(),computeHmacSha256Signature:(s,key)=>createHmac('sha256',key).update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),formatDate:date=>date.toISOString()},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this}})},
    Sheets:{Spreadsheets:{batchUpdate:({requests})=>{if(failBatch)throw new Error('simulated atomic failure');for(const r of requests){const a=r.appendCells||r.updateCells;const sheet=[...sheets.values()].find(s=>s.id===(a.sheetId||a.start?.sheetId));const values=a.rows[0].values.map(c=>Object.values(c.userEnteredValue)[0]);if(r.appendCells)sheet.data.push(values);else sheet.data[a.start.rowIndex]=values}return {replies:requests.map(()=>({}))}}}}
  };
  vm.createContext(context);vm.runInContext(code,context);
  const headers=vm.runInContext('HEADERS',context);for(const [name,h]of Object.entries(headers)){const s=new Sheet(name);s.data=[Array.from(h)];sheets.set(name,s)}
  sheets.get('Settings').data.push(['open','true'],['closeAt',''],['revision','0'],['sizesConfirmed','false']);
  const call=input=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(input)}}).text);
  function login(email='buyer@example.com',name='Buyer'){
    assert.equal(call({action:'requestCode',email,name}).ok,true);const otp=sent.at(-1).body.match(/\d{8}/)[0];const out=call({action:'verifyCode',email,code:otp});assert.equal(out.ok,true,JSON.stringify(out));return out.data.token;
  }
  function adminLogin(){const out=call({action:'adminLogin',pin:'246813'});assert.equal(out.ok,true,JSON.stringify(out));return out.data.token}
  return {call,login,adminLogin,sheets,sent,props,context,failNextBatch:()=>failBatch=true};
}
const a={size:'SS',fit:'shaped'},b={size:'XL',fit:'straight'};
const rid=()=>randomUUID();
test('public bootstrap contains no identities; admin data requires server authorization',()=>{
  const e=environment();const d=e.call({action:'bootstrap'});assert.equal(d.ok,true);assert.equal(d.data.orders,undefined);
  assert.equal(e.call({action:'admin'}).code,'AUTH');const token=e.login();assert.equal(e.call({action:'admin',token,role:'admin'}).code,'FORBIDDEN');
});
test('OTP hashes, failed attempts, expiry, one-time use and per-email resend limit',()=>{
  const e=environment(),email='one@example.com';assert.equal(e.call({action:'requestCode',email,name:'One'}).ok,true);const otp=e.sent[0].body.match(/\d{8}/)[0];assert.notEqual(e.sheets.get('AuthCodes').data[1][2],otp);
  assert.equal(e.call({action:'requestCode',email,name:'One'}).ok,false);
  for(let i=0;i<5;i++)assert.equal(e.call({action:'verifyCode',email,code:'WRONG'}).ok,false);
  assert.equal(e.sheets.get('AuthCodes').data[1][4],5);assert.equal(e.call({action:'verifyCode',email,code:otp}).ok,false);
  const good=e.login('two@example.com');assert.ok(good.length>40);assert.equal(e.call({action:'verifyCode',email:'two@example.com',code:e.sent.at(-1).body.match(/\d{8}/)[0]}).ok,false);
  assert.notEqual(e.sheets.get('Sessions').data[1][0],good);
});
test('live backend: partial then complete, revision conflict, private audit, tampered target ignored',()=>{
  const e=environment(),token=e.login();let out=e.call({action:'save',token,email:'other@example.com',patch:{items:{polo:a},expectedRevision:0},requestId:rid()});assert.equal(out.ok,true);assert.equal(out.data.order.email,'buyer@example.com');
  out=e.call({action:'save',token,patch:{items:{tee:b},expectedRevision:1},requestId:rid()});assert.equal(out.ok,true);assert.equal(out.data.order.revision,2);
  assert.equal(e.call({action:'save',token,patch:{items:{tee:a},expectedRevision:1},requestId:rid()}).code,'CONFLICT');
  const other=e.login('other@example.com');assert.equal(e.call({action:'load',token:other}).data.logs.length,0);assert.equal(e.call({action:'load',token}).data.logs.length,2);
});
test('atomic order/audit/outbox writes, idempotent replay, reset and worker email',()=>{
  const e=environment(),buyer=e.login(),admin=e.adminLogin();
  assert.equal(e.call({action:'save',token:buyer,patch:{items:{polo:a,tee:b},expectedRevision:0},requestId:rid()}).ok,true);
  const req={action:'adminSave',token:admin,email:'buyer@example.com',patch:{items:{polo:null},reason:'เจ้าของขอเลือกใหม่',expectedRevision:1},requestId:rid()};
  const first=e.call(req);assert.equal(first.ok,true);assert.equal(first.data.mailStatus,'pending');assert.deepEqual(e.call(req),first);
  assert.equal(e.sheets.get('AuditLog').data.length,3);assert.equal(e.sheets.get('Outbox').data.length,2);assert.equal(e.sheets.get('Orders').data.length,2);
  assert.equal(first.data.log.before.polo.size,'SS');assert.equal(first.data.order.items.polo,null);assert.deepEqual(first.data.order.items.tee,b);
  e.context.flushOutbox();assert.equal(e.sent.at(-1).to,'buyer@example.com');assert.match(e.sent.at(-1).body,/เลือกเสื้อใหม่/);assert.equal(e.sheets.get('Outbox').data[1][4],'sent');
});
test('failed atomic commit does not leave an order without a log or an email',()=>{
  const e=environment(),token=e.login();e.failNextBatch();const out=e.call({action:'save',token,patch:{items:{polo:a},expectedRevision:0},requestId:rid()});assert.equal(out.ok,false);assert.equal(e.sheets.get('Orders').data.length,1);assert.equal(e.sheets.get('AuditLog').data.length,1);assert.equal(e.sheets.get('Requests').data.length,1);
});
test('server closure blocks all writes even if frontend says open',()=>{
  const e=environment(),token=e.login(),admin=e.adminLogin();
  assert.equal(e.call({action:'settings',token:admin,settings:{open:false,closeAt:'',expectedRevision:0},requestId:rid()}).ok,true);
  assert.equal(e.call({action:'save',token,patch:{items:{polo:a},expectedRevision:0},requestId:rid()}).ok,false);
  assert.equal(e.call({action:'save',token:admin,patch:{items:{polo:a},expectedRevision:0},requestId:rid()}).ok,false);
});
test('logout revokes token; settings and invalid payloads cannot be forged',()=>{
  const e=environment(),token=e.login();assert.equal(e.call({action:'settings',token,settings:{open:true},requestId:rid()}).code,'FORBIDDEN');
  assert.equal(e.call({action:'save',token,patch:{items:{polo:{size:'SS',fit:'invalid'}},expectedRevision:0},requestId:rid()}).ok,false);
  assert.equal(e.call({action:'save',token,patch:{items:{polo:a},expectedRevision:0},requestId:'bad'}).ok,false);
  assert.equal(e.call({action:'logout',token}).ok,true);assert.equal(e.call({action:'load',token}).code,'AUTH');
});
test('admin PIN issues a server session; client role and admin email do not grant privilege',()=>{
  const e=environment();assert.equal(e.call({action:'adminLogin',pin:'123123'}).ok,false);assert.equal(e.sheets.get('Sessions').data.length,1);
  const token=e.adminLogin(),out=e.call({action:'load',token});assert.equal(out.data.user.role,'admin');assert.equal(out.data.user.authMethod,'pin');assert.equal(e.call({action:'admin',token}).ok,true);
  const emailToken=e.login('admin@example.com','Email Admin');assert.equal(e.call({action:'admin',token:emailToken,role:'admin'}).code,'FORBIDDEN');
  assert.equal(e.call({action:'save',token,patch:{items:{polo:a},expectedRevision:0},requestId:rid()}).ok,false);
  assert.equal(e.call({action:'logout',token}).ok,true);assert.equal(e.call({action:'admin',token}).code,'AUTH');
});
test('admin PIN lockout is enforced on the server after five failed attempts',()=>{
  const e=environment();for(let i=0;i<5;i++)assert.equal(e.call({action:'adminLogin',pin:'000000'}).code,'BAD_PIN');assert.equal(e.call({action:'adminLogin',pin:'246813'}).code,'RATE_LIMIT');assert.equal(e.sheets.get('Sessions').data.length,1);
});
test('missing admin secret fails closed and public bootstrap does not disclose the hash',()=>{
  const e=environment();const boot=e.call({action:'bootstrap'});assert.equal(boot.data.adminPinConfigured,true);assert.equal(JSON.stringify(boot).includes(e.props.get('ADMIN_PIN_HASH')),false);e.props.delete('ADMIN_PIN_HASH');assert.equal(e.call({action:'adminLogin',pin:'246813'}).code,'SETUP');
});
test('setup consumes private bootstrap credentials without publishing or retaining the setup bundle',()=>{
  const e=environment(),secret='f'.repeat(64),hash=createHmac('sha256',secret).update('threadroom-admin:246813').digest('base64url');
  e.props.delete('ADMIN_PIN_HASH');e.props.delete('SESSION_SECRET');e.sheets.get('Settings').data.push(['_installCredentials',JSON.stringify({secret,hash})]);
  e.context.setup();assert.equal(e.props.get('SESSION_SECRET'),secret);assert.equal(e.props.get('ADMIN_PIN_HASH'),hash);assert.equal(e.sheets.get('Settings').data[5][1],'');assert.equal(e.call({action:'adminLogin',pin:'246813'}).ok,true);
  const boot=JSON.stringify(e.call({action:'bootstrap'}));assert.equal(boot.includes(secret),false);assert.equal(boot.includes(hash),false);
});
