# THREADROOM / 07

A Thai clothing order app for two required shirt designs, with a 360° fitting room, size-dependent mannequin meshes, order revisions, an admin workspace, Google Sheets storage and queued email notifications.

**Start here: [คู่มือติดตั้งภาษาไทย](README-TH.md)**

The checked-in configuration is a clearly labelled browser-local demo. Deploy the included Apps Script backend and configure `dist/config.js` before accepting real orders.

Frontend: static ES modules, native WebGL, Canvas fallback. No package installation or build required. GitHub Pages workflow publishes `dist/` after tests pass. Node.js 22+ is required for tests.

```bash
npm test
```
