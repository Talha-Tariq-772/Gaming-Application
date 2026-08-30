/**
 * AUDIT SECTION 6 — LCP, CLS, total bytes on / and /games, desktop + 390px
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });

const configs = [
  { label: '/ desktop', path: '/', viewport: { width: 1440, height: 900 } },
  { label: '/games desktop', path: '/games', viewport: { width: 1440, height: 900 } },
  { label: '/ mobile', path: '/', viewport: { width: 390, height: 844 } },
  { label: '/games mobile', path: '/games', viewport: { width: 390, height: 844 } },
];

for (const cfg of configs) {
  const ctx = await browser.newContext({ viewport: cfg.viewport });
  const page = await ctx.newPage();

  // Inject PerformanceObserver before navigation
  await page.addInitScript(() => {
    window.__lcpValue = 0;
    window.__clsValue = 0;
    window.__lcpEl = '';

    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__lcpValue = entry.startTime;
        window.__lcpEl = entry.element?.tagName + (entry.element?.src ? ' src=' + entry.element.src.substring(0, 80) : '');
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__clsValue += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.goto(BASE + cfg.path, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(3000); // let LCP settle

  const metrics = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource');
    const totalTransferred = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const totalDecoded = resources.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0);
    const navEntry = performance.getEntriesByType('navigation')[0];
    return {
      lcp: Math.round(window.__lcpValue),
      lcpEl: window.__lcpEl,
      cls: parseFloat(window.__clsValue.toFixed(4)),
      totalTransferredKB: (totalTransferred / 1024).toFixed(1),
      totalDecodedKB: (totalDecoded / 1024).toFixed(1),
      resourceCount: resources.length,
      domInteractive: navEntry ? Math.round(navEntry.domInteractive) : null,
      domComplete: navEntry ? Math.round(navEntry.domComplete) : null,
    };
  });

  console.log(`\n=== ${cfg.label} ===`);
  console.log(`  LCP: ${metrics.lcp}ms  (element: ${metrics.lcpEl})`);
  console.log(`  CLS: ${metrics.cls}`);
  console.log(`  Transferred: ${metrics.totalTransferredKB} KB (decoded: ${metrics.totalDecodedKB} KB)`);
  console.log(`  Resources: ${metrics.resourceCount}`);
  console.log(`  DOM Interactive: ${metrics.domInteractive}ms`);
  console.log(`  DOM Complete: ${metrics.domComplete}ms`);

  await ctx.close();
}

await browser.close();
console.log('\nSection 6 done.');
