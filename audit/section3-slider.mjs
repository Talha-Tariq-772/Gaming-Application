/**
 * AUDIT SECTION 3 — Store slider: visuals, keyboard nav, network lazy-load
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });

// ── 3A: Screenshot at 1440px ──────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const wallpaperRequests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('wallpaper') || url.includes('hero') || url.includes('membership') || url.includes('slide')) {
      wallpaperRequests.push(url);
    }
  });

  await page.goto(BASE + '/games', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: './audit/results/games_1440_initial.png', fullPage: false });

  console.log('=== WALLPAPER/HERO REQUESTS ON FIRST LOAD ===');
  wallpaperRequests.forEach(u => console.log(u));
  console.log(`Total wallpaper requests: ${wallpaperRequests.length}`);
  await ctx.close();
}

// ── 3B: Keyboard navigation on games page ────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const ariaAnnouncements = [];
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));

  await page.goto(BASE + '/games', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);

  // Tab through to find slider controls
  const focusLog = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName,
        role: el?.getAttribute('role'),
        ariaLabel: el?.getAttribute('aria-label'),
        text: el?.textContent?.trim()?.substring(0, 60),
        id: el?.id,
      };
    });
    focusLog.push(focused);
  }

  // Check for aria-live region
  const ariaLive = await page.evaluate(() => {
    const live = document.querySelectorAll('[aria-live]');
    return Array.from(live).map(el => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      live: el.getAttribute('aria-live'),
      text: el.textContent?.trim()?.substring(0, 100),
    }));
  });

  await page.screenshot({ path: './audit/results/games_keyboard_focus.png' });

  console.log('\n=== FOCUS ORDER (first 30 tabs) ===');
  focusLog.forEach((f, i) => console.log(`Tab ${i+1}: ${f.tag} role=${f.role} label="${f.ariaLabel}" text="${f.text}"`));
  console.log('\n=== ARIA-LIVE REGIONS ===');
  console.log(JSON.stringify(ariaLive, null, 2));
  await ctx.close();
}

// ── 3C: Network lazy-load verification ───────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const imgRequests = [];
  page.on('response', async res => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('image') || url.match(/\.(png|jpg|jpeg|webp|avif)/i)) {
      let size = 0;
      try { size = parseInt(res.headers()['content-length'] || '0'); } catch {}
      imgRequests.push({ url, size, time: Date.now() });
    }
  });

  const t0 = Date.now();
  await page.goto(BASE + '/games', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);
  const afterLoad = imgRequests.map(r => ({ ...r, t: r.time - t0 }));
  const loadMark = Date.now() - t0;

  // Advance slider via click if button exists, else keyboard
  const sliderImages_before = afterLoad.length;

  // Try to find next button
  const nextBtn = page.locator('[aria-label*="next" i], [aria-label*="Next" i]').first();
  const hasNext = await nextBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasNext) {
    await nextBtn.click();
    await page.waitForTimeout(1500);
    await nextBtn.click();
    await page.waitForTimeout(1500);
    console.log('Clicked next twice');
  } else {
    console.log('No next button found');
  }

  const afterAdvance = imgRequests.filter(r => r.time - t0 > loadMark);

  // Total bytes
  const totalBytes = await page.evaluate(() => {
    if (!window.performance) return 0;
    return performance.getEntriesByType('resource').reduce((sum, r) => sum + (r.transferSize || 0), 0);
  });

  console.log('\n=== IMAGE REQUESTS ON INITIAL LOAD ===');
  afterLoad.forEach(r => console.log(`  ${r.url.substring(0, 100)} (${r.size}b @ ${r.t}ms)`));
  console.log(`\nImages at initial load: ${sliderImages_before}`);
  console.log('\n=== NEW IMAGE REQUESTS AFTER ADVANCING SLIDER TWICE ===');
  afterAdvance.forEach(r => console.log(`  ${r.url.substring(0, 100)}`));
  console.log(`New images after advancing: ${afterAdvance.length}`);
  console.log(`\nTotal bytes transferred (all resources): ${(totalBytes / 1024).toFixed(1)} KB`);

  await ctx.close();
}

await browser.close();
console.log('\nSection 3 done.');
