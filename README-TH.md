# THREADROOM / 07

เว็บสั่งเสื้อ 2 แบบสำหรับกลุ่มหรือรุ่น ออกแบบให้วางหน้าเว็บบน GitHub Pages และใช้ Google Apps Script อ่านเขียน Google Sheets

เวอร์ชันนี้มีเว็บทดลองที่กดใช้งานได้ และโค้ดระบบจริงครบชุด การเชื่อมบัญชี GitHub และการอนุญาต/Deploy Apps Script ในบัญชีเจ้าของยังต้องดำเนินการก่อนเปิดรับรายการจริง

## ทดลองใช้งาน

เปิดเว็บ กด **เข้าสู่ระบบ → ผู้สั่งเสื้อ** เลือกแบบ ทรง และไซซ์ แล้วกดยืนยันตัวเดียวหรือทั้งสองตัว

กดบัญชีมุมขวาบน → เปลี่ยนตัวตน → แอดมิน เพื่อแก้รายการที่เพิ่งสร้าง ล้างรายการให้เลือกใหม่ และลองปิดระบบ สามารถเพิ่มสมาชิกตัวอย่างได้จากหน้าแอดมิน

โหมดทดลองบันทึกเฉพาะ localStorage ของเบราว์เซอร์ ไม่มีการส่งอีเมลหรือเขียนลงชีตจริง ใช้คนละ adapter กับโหมดจริง และไม่เปลี่ยนกลับเป็นโหมดทดลองเองเมื่อ API มีปัญหา

## กติกาที่ทำไว้

- คนละ 1 ตัวต่อแบบ รวม 2 แบบต่อคน แบบแรกและแบบที่สองเลือกไซซ์หรือทรงต่างกันได้
- ทุกคนเลือกทรงตรงหรือทรงเว้าได้ หุ่นชาย/หญิงเป็นเพียงตัวช่วยดู ไม่กำหนดสิทธิ์การเลือก
- มีไซซ์ SS, S, M, L, XL, 2XL, 3XL, 4XL และเปลี่ยนสัดส่วน mesh ของเสื้อและหุ่นตามไซซ์
- ยืนยันเพียงแบบเดียวได้ สถานะจะยังไม่ครบเซ็ตจนกว่าจะยืนยันอีกแบบ
- แก้ได้ขณะเปิดระบบ การปิดตรวจที่ฝั่งเซิร์ฟเวอร์ด้วย ทั้งผู้สั่งและแอดมินต้องรอเปิดรอบใหม่จึงแก้ต่อได้
- บันทึกตัวเลือกก่อนและหลัง เวลา อีเมลผู้แก้ เหตุผล และเวอร์ชันรายการใน AuditLog
- แอดมินแก้/ล้างตัวเลือกให้คนอื่นได้ การล้างไม่ลบประวัติ และส่งรายการแจ้งเตือนไป Outbox
- อีเมลแจ้งการเปลี่ยนแปลงส่งโดย trigger ทุก 5 นาที พร้อมลองใหม่เมื่อส่งไม่สำเร็จ
- ก่อนเข้าระบบจริง ผู้สั่งยืนยันอีเมลด้วย OTP ส่วนสิทธิ์แอดมินตรวจจาก Script Properties ฝั่งเซิร์ฟเวอร์

## ฐานข้อมูลที่เตรียมแล้ว

[เปิด Google Sheets](https://docs.google.com/spreadsheets/d/1S4waTYrvCnnWEjIgObwnwoGG_ynNyAGIEEanP25L_lY/edit)

มีแท็บ Orders, AuditLog, Users, Settings, AuthCodes, Sessions, Outbox และ Requests หัวตารางตรงกับโค้ดแล้ว และตั้งเขตเวลา Asia/Bangkok

ชีตเริ่มต้นเป็น `open = false` และ `sizesConfirmed = false` เก็บสิทธิ์เข้าชีตไว้เฉพาะผู้ดูแล ผู้สั่งทั่วไปเข้าผ่านเว็บ ไม่ต้องได้รับสิทธิ์อ่านชีต

## 1. ติดตั้ง Google Apps Script

1. เปิดชีตด้านบน → **ส่วนขยาย → Apps Script**
2. วางเนื้อหาจาก `apps-script/Code.gs` ลงไฟล์ Code.gs
3. ใน Project Settings เปิดการแสดงไฟล์ manifest แล้วนำ `apps-script/appsscript.json` ไปใส่
4. ตรวจเมนู Services ว่ามี **Google Sheets API (Sheets v4)** ถ้ายังไม่มีให้เพิ่มบริการนี้ หากใช้ Google Cloud project ที่ตั้งเอง ต้องเปิด Sheets API ใน project นั้นด้วย
5. ใน Project Settings → Script Properties เพิ่มค่าต่อไปนี้

| Property | ค่าที่ใส่ |
| --- | --- |
| ADMIN_EMAILS | อีเมลแอดมินจริง คั่นด้วย comma ถ้ามีหลายคน |
| SPREADSHEET_ID | `1S4waTYrvCnnWEjIgObwnwoGG_ynNyAGIEEanP25L_lY` |
| PUBLIC_SITE_URL | URL เว็บ GitHub Pages ที่ได้หลังเผยแพร่ ใช้เป็นลิงก์ในอีเมล |

6. เลือกฟังก์ชัน `setup` แล้ว Run และอนุญาตสิทธิ์ที่ Google ขอ การรันจะตรวจ schema สร้าง secret และติดตั้ง trigger ส่งอีเมลให้เอง
7. **Deploy → New deployment → Web app** เลือก Execute as **Me** และ Who has access **Anyone** แล้ว Deploy ใช้ URL ที่ลงท้าย `/exec` บัญชีองค์กรอาจจำกัดการ Deploy แบบนี้ ต้องให้ผู้ดูแลโดเมนอนุญาตก่อน

OTP ส่งโดยบัญชีเจ้าของสคริปต์ ผู้สั่งไม่ต้องอนุญาตสิทธิ์อ่านชีตให้ตัวเอง ข้อมูลส่วนตัวและคำสั่งแอดมินยังต้องผ่าน session ที่เซิร์ฟเวอร์ตรวจสอบ

## 2. ตั้งค่าเว็บจริง

แก้ `dist/config.js`

```js
window.THREADROOM_CONFIG = {
  mode: 'live',
  apiUrl: 'https://script.google.com/macros/s/รหัส_DEPLOYMENT_จริง/exec',
  title: 'THREADROOM / 07',
  collection: 'เสื้อรุ่นของเรา',
  artwork: {
    polo: { front: './assets/style-01-front.png', back: './assets/style-01-back.png' },
    tee: { front: './assets/style-02-front.png', back: './assets/style-02-back.png' }
  }
};
```

โค้ดตัวอย่างชื่อไฟล์ artwork ต้องเปลี่ยนให้ตรงกับไฟล์ที่มีจริง เก็บภาพใน `dist/assets/` และใช้ path แบบ relative เพื่อรองรับ GitHub Pages ที่มีชื่อ repository ใน URL

## 3. นำขึ้น GitHub

1. สร้าง repository ในบัญชีของคุณ และอัปโหลดไฟล์ทั้งชุดรวมโฟลเดอร์ `.github` ใช้ branch `main`
2. เลือก **Settings → Pages → Source → GitHub Actions**
3. Workflow `.github/workflows/pages.yml` จะรันชุดทดสอบและเผยแพร่เฉพาะ `dist/` โค้ด Apps Script และฐานข้อมูลไม่รวมในไฟล์หน้าเว็บที่เผยแพร่
4. ดู URL จริงจาก workflow ที่สำเร็จ แล้วใส่ URL นี้ใน `PUBLIC_SITE_URL` ของ Apps Script
5. ทุกครั้งที่แก้ frontend และ push ไป `main` ระบบจะเผยแพร่เวอร์ชันใหม่

ก่อนมีการเชื่อม GitHub ไม่ถือว่าเว็บทดลองที่ส่งให้เป็นเว็บบน GitHub Pages

## 4. ใส่แบบเสื้อและไซซ์จริง

ตอนนี้เสื้อโปโลกรมท่าและเสื้อยืดครีมเป็น **ตัวอย่างสองแบบ** ยังไม่ได้ใช้แบบเสื้อจริงของรุ่น

- เปลี่ยนชื่อ สี ข้อความ และคำอธิบายใน `dist/domain.mjs` ที่ `PRODUCTS`
- แทนตารางใน `measurements()` ด้วยตารางจากผู้ผลิต และปรับรายชื่อ SIZES ให้ตรงกันทั้งหน้าเว็บและ `ALLOWED_SIZES` ใน Code.gs หากจำนวนไซซ์เปลี่ยน
- ใส่ artwork หน้า/หลังที่เตรียมไว้ใน `config.js`
- ถ้าทั้งสองแบบเป็นเสื้อโปโลหรือเป็นแพตเทิร์นอื่น ให้ปรับ mesh ใน `dist/mannequin.mjs` ให้ตรงแพตเทิร์นก่อนใช้งาน
- เมื่อตรวจแล้ว เปลี่ยน Settings แถว `sizesConfirmed` เป็น `true` และเปิดรับผ่านหน้าแอดมิน

หุ่นเป็น mannequin แบบ 3 มิติ ใช้ WebGL และมี Canvas fallback ภาพช่วยเปรียบเทียบสัดส่วน ไม่ใช่ digital twin ของผู้สวม ไม่มีข้อมูลสแกนร่างกาย การจำลองการยืด/ทิ้งตัวของผ้า หรือแพตเทิร์นจากโรงงาน หากต้องการความสมจริงระดับงานขายจริง ต้องนำโมเดลจากแพตเทิร์นหรือสแกนเสื้อจริงมาแทน mesh ตัวอย่าง

## 5. ทดสอบเชื่อมต่อก่อนเปิดรับ

1. ให้แอดมินใช้ **อีเมลของตัวเอง** ขอ OTP ตรวจว่ารหัสถึงกล่องอีเมลและเข้าสู่ระบบได้
2. เปิดรับจากหน้าตั้งค่า ยืนยันหนึ่งแบบ ตรวจ Orders ว่ายังเป็นรายการไม่ครบ จากนั้นยืนยันอีกแบบ
3. เปลี่ยนไซซ์ ตรวจ AuditLog ว่ามี before/after และ revision เพิ่ม
4. ทดสอบหน้าแอดมินแก้รายการของอีเมลทดสอบที่คุณควบคุม ใส่เหตุผล ตรวจ Outbox ว่าเป็น pending แล้วเปลี่ยนเป็น sent หลัง trigger ทำงาน
5. ทดสอบล้างเพียงแบบเดียว อีกแบบต้องยังอยู่ และเจ้าของต้องเข้ามาเลือกแบบที่ล้างใหม่ได้
6. ปิดระบบและทดสอบส่งคำขอแก้ไขอีกครั้ง ต้องถูกเซิร์ฟเวอร์ปฏิเสธ
7. เปิดสองแท็บ แก้รายการเดียวกันพร้อมกัน รายการเก่าต้องเกิด CONFLICT และต้องโหลดล่าสุดก่อนยืนยันใหม่
8. ทดสอบบนมือถือจริง การลากแนวนอนต้องหมุนหุ่น และการเลื่อนแนวตั้งต้องเลื่อนหน้าได้

## การดูแลอีเมลและข้อมูล

Outbox ใช้สถานะ `pending`, `sent`, `failed` หากส่งไม่สำเร็จ 3 ครั้งจะหยุดที่ failed แก้ต้นเหตุแล้วรัน `retryFailedEmails()` ใน Script editor เพื่อเข้าคิวใหม่

การส่งขึ้นอยู่กับโควตา MailApp ของบัญชีและโดเมน ระบบเผื่อโควตาและไม่แสดงผลสำเร็จว่าส่งอีเมลถึงแล้วตั้งแต่บันทึกคำสั่งซื้อ กรณีส่งสำเร็จแต่การบันทึกสถานะส่งล้มเหลว อีเมลอาจถูกส่งซ้ำได้ ใช้เลขอ้างอิง AuditLog ในอีเมลเพื่อตรวจสอบ

Orders, AuditLog และ Outbox ของการแก้หนึ่งครั้งบันทึกผ่าน Sheets API batchUpdate เดียว ใช้ LockService และ revision เพื่อควบคุมการแก้พร้อมกัน Requests ใช้ request ID ป้องกันการบันทึกคำขอเดิมซ้ำ Session token และ OTP ในฐานข้อมูลเก็บเป็น hash โค้ด OTP มีอายุ 10 นาที กรอกได้ 5 ครั้ง Session มีอายุ 12 ชั่วโมง

ควรแก้รายการผ่านหน้าเว็บเพื่อให้มีประวัติครบ การแก้โดยตรงในชีตโดยเจ้าของหรือ editor จะอยู่นอก log ของแอป ระบบนี้ไม่ได้ป้องกัน editor ของชีตจากการแก้ประวัติด้วยตนเอง

## ตรวจโค้ดในเครื่อง

ใช้ Node.js 22 ขึ้นไป โดยไม่ต้องติดตั้ง dependencies

```bash
node --test tests/*.test.mjs
```

ชุดทดสอบครอบคลุมกติกาการเลือก การปิดระบบ สิทธิ์ผู้สั่ง/แอดมิน OTP การล้างและประวัติ การกันคำขอซ้ำ และการบันทึกแบบ atomic โดยจำลอง Google Services ไม่ได้ยืนยันการอนุญาต Google หรือการส่งเมลในบัญชีจริง

การตรวจครั้งนี้ตรวจ syntax, กติกา 16 กรณี, mesh ทุกไซซ์/ทรง/หุ่น และ schema/ค่าตั้งต้นใน Google Sheets แล้ว ยังไม่ได้ทดสอบ UI บนเบราว์เซอร์จริงหรือเชื่อม Apps Script จริง เพราะยังไม่มี browser QA ที่รองรับและยังไม่มีการ Deploy Apps Script

## เอกสารอ้างอิงสำหรับการติดตั้ง

- [GitHub Pages custom workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Apps Script Web apps](https://developers.google.com/apps-script/guides/web)
- [Apps Script Content service](https://developers.google.com/apps-script/guides/content)
- [Advanced Sheets service](https://developers.google.com/apps-script/advanced/sheets)
- [Atomic batchUpdate](https://developers.google.com/workspace/sheets/api/guides/batchupdate)
- [Google Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
