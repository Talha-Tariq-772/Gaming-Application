/**
 * AUDIT SECTION 1 — Console errors on /, /games, /dev/nova-hero
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';

mkdirSync('./audit/results', { recursive: true });

const BASE = 'http://localhost:3000';
const pages = ['/', '/games', '/dev/nova-hero'];
const report = {};

const browser = await chromium.launch({ headless: true });

for (const path of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const messages = [];
  const errors = [];
  const requests = [];

  page.on('console', msg => messages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => errors.push(err.message));
  page.on('request', req => requests.push({ url: req.url(), method: req.method() }));

  let status = null;
  try {
    const res = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 20000 });
    status = res?.status();
  } catch (e) {
    errors.push('Navigation timeout/error: ' + e.message);
  }

  // Wait a bit more for any deferred console output
  await page.waitForTimeout(3000);

  await page.screenshot({ path: `./audit/results/section1${path.replace(/\//g, '_') || '_root'}.png`, fullPage: false });

  report[path] = {
    httpStatus: status,
    consoleMessages: messages,
    pageErrors: errors,
    requestCount: requests.length,
  };

  await ctx.close();
}

await browser.close();
writeFileSync('./audit/results/section1.json', JSON.stringify(report, null, 2));
console.log('Section 1 done.');
console.log(JSON.stringify(report, null, 2));
