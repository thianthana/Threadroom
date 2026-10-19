# THREADROOM / 07

Thai two-design clothing order system: GitHub Pages frontend, Google Sheets storage, Apps Script backend, email OTP for buyers and a server-verified six-digit admin PIN.

**[คู่มือติดตั้งภาษาไทย](README-TH.md)**

The app does not accept orders until a real Apps Script /exec URL has been configured. Install and authorize the included backend in the Sheet owner's Google account, then configure dist/config.js. The public repository contains no admin PIN or server secret.

```bash
node --test tests/*.test.mjs
```
