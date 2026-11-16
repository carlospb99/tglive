#!/usr/bin/env node
// Espera a que la página marque window.__streamReady === true (vía CDP).
// Sale 0 si llegó, 1 si no llegó a tiempo.
// Fase 3 del plan: se sustituye por src/watchdog.js.
const { chromium } = require('playwright-core');

const CDP = `http://127.0.0.1:${process.env.CDP_PORT || 9222}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  for (let i = 0; i < 20; i++) {
    try {
      const browser = await chromium.connectOverCDP(CDP);
      const page = browser.contexts()[0].pages()[0];
      await page.waitForFunction(() => window.__streamReady === true, null, { timeout: 30000 });
      console.log('streamReady OK');
      process.exit(0);
    } catch {
      await sleep(1000);
    }
  }
  console.error('streamReady NO llegó');
  process.exit(1);
})();
