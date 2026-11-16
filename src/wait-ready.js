#!/usr/bin/env node
// Espera a que Chrome exponga una pestaña y esta marque window.__streamReady.
const { chromium } = require('playwright-core');

const cdp = 'http://127.0.0.1:' + (process.env.CDP_PORT || '9222');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const timeoutMs = Math.max(1000, Number(process.env.READY_TIMEOUT_MS || 90000));

(async () => {
  let browser;
  try {
    // Chrome puede tardar unos segundos en abrir el puerto CDP.
    for (let attempt = 0; attempt < 20 && !browser; attempt += 1) {
      try {
        browser = await chromium.connectOverCDP(cdp, { timeout: 5000 });
      } catch {
        await sleep(1000);
      }
    }
    if (!browser) throw new Error('Chrome no abrió el puerto CDP');

    const context = browser.contexts()[0];
    const page = context && context.pages()[0];
    if (!page) throw new Error('Chrome no tiene una pestaña disponible');

    await page.waitForFunction(() => window.__streamReady === true, null, {
      timeout: timeoutMs,
      polling: 500,
    });
    console.log('streamReady OK');
  } catch (error) {
    console.error('streamReady ERROR: ' + error.message);
    process.exitCode = 1;
  } finally {
    // connectOverCDP: close() desconecta Playwright del Chrome existente.
    if (browser) await browser.close().catch(() => {});
  }
})();
