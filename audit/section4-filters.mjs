/**
 * AUDIT SECTION 4 — Filters: URL sync, back button, reload preservation, empty state
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + '/games', { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForTimeout(1000);

const url0 = page.url();
console.log('Initial URL:', url0);

// Find filter buttons/chips
const filterElements = await page.evaluate(() => {
  const candidates = Array.from(document.querySelectorAll('button, [role="checkbox"], [role="option"], input[type="checkbox"]'));
  return candidates
    .filter(el => {
      const text = el.textContent?.trim();
      const parent = el.closest('form, nav, [role="listbox"], aside, [class*="filter"]');
      return text && text.length < 30 && parent;
    })
    .slice(0, 10)
    .map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim(),
      ariaLabel: el.getAttribute('aria-label'),
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
    }));
});
console.log('\n=== FILTER ELEMENTS FOUND ===');
console.log(JSON.stringify(filterElements, null, 2));

// Try clicking a filter (look for genre/category filter)
const filterBtn = page.locator('button, [role="checkbox"]').filter({ hasText: /action|rpg|strategy|fps|sport|puzzle|adventure/i }).first();
const hasFilter = await filterBtn.isVisible({ timeout: 3000 }).catch(() => false);

if (hasFilter) {
  const filterText = await filterBtn.textContent();
  await filterBtn.click();
  await page.waitForTimeout(1000);
  const url1 = page.url();
  console.log(`\nAfter clicking "${filterText?.trim()}": ${url1}`);

  // Click a second filter
  const filterBtn2 = page.locator('button, [role="checkbox"]').filter({ hasText: /action|rpg|strategy|fps|sport|puzzle|adventure/i }).nth(1);
  const hasFilter2 = await filterBtn2.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasFilter2) {
    await filterBtn2.click();
    await page.waitForTimeout(1000);
    const url2 = page.url();
    console.log(`After 2nd filter: ${url2}`);
  }

  await page.screenshot({ path: './audit/results/games_filtered.png' });

  // Back button
  await page.goBack();
  await page.waitForTimeout(800);
  const urlBack = page.url();
  console.log(`After back: ${urlBack}`);
  await page.screenshot({ path: './audit/results/games_after_back.png' });

  // Reload with filter in URL
  await page.goto(url1, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(800);
  const urlReload = page.url();
  console.log(`After direct nav to filtered URL: ${urlReload}`);
  await page.screenshot({ path: './audit/results/games_reloaded_filter.png' });
} else {
  console.log('\nNo genre filters found — page may be in error state');
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Page body text:', bodyText);
  await page.screenshot({ path: './audit/results/games_no_filters.png' });
}

// Try to trigger empty state (search for something that won't match)
try {
  const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
  const hasSearch = await searchInput.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasSearch) {
    await searchInput.fill('xyzxyzxyz_no_results_expected');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: './audit/results/games_empty_state.png' });
    console.log('\nEmpty state screenshot taken');
  } else {
    console.log('\nNo search input found');
  }
} catch {}

await browser.close();
console.log('\nSection 4 done.');
