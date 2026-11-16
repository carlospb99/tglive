#!/usr/bin/env node
// Supervisa CDP y la capacidad de respuesta de la página que alimenta el stream.
// Tres fallos consecutivos provocan la salida; run.sh termina FFmpeg y systemd reinicia el servicio.
const { chromium } = require('playwright-core');

const cdp = 'http://127.0.0.1:' + (process.env.CDP_PORT || '9222');
const intervalMs = Math.max(1000, Number(process.env.WATCHDOG_INTERVAL || 15) * 1000);
const timeoutMs = Math.max(1000, Number(process.env.WATCHDOG_TIMEOUT || 10) * 1000);
const maxFailures = Math.max(1, Number(process.env.WATCHDOG_FAILURES || 3));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Chrome no respondió a tiempo')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  let browser;
  let failures = 0;
  try {
    browser = await chromium.connectOverCDP(cdp, { timeout: timeoutMs });
    console.log('watchdog: conectado a Chrome por CDP');

    while (true) {
      try {
        if (!browser.isConnected()) throw new Error('conexión CDP cerrada');
        const pages = browser.contexts().flatMap((context) => context.pages());
        if (pages.length === 0) throw new Error('no hay pestañas abiertas');

        const state = await withTimeout(
          pages[0].evaluate(() => ({
            ready: document.readyState,
            streamReady: window.__streamReady === true,
          })),
          timeoutMs,
        );

        if (state.ready === 'loading' || !state.streamReady) {
          throw new Error('la página no está lista (__streamReady no es true)');
        }

        if (failures) console.log('watchdog: página recuperó respuesta');
        failures = 0;
      } catch (error) {
        failures += 1;
        console.error('watchdog: fallo ' + failures + '/' + maxFailures + ': ' + error.message);
        if (failures >= maxFailures) {
          console.error('watchdog: umbral alcanzado; solicitando reinicio del servicio');
          process.exitCode = 1;
          return;
        }
      }
      await sleep(intervalMs);
    }
  } catch (error) {
    console.error('watchdog: no se pudo supervisar Chrome: ' + error.message);
    process.exitCode = 1;
  } finally {
    // Libera el socket CDP incluso si una evaluación quedó pendiente.
    if (browser) await browser.close().catch(() => {});
  }
})();
