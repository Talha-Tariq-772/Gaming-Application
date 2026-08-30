/**
 * AUDIT SECTION 5 — Mobile 390x844
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });

const pages = ['/', '/games'];

// Also try a game detail page
for (const path of [...pages, '/games']) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await ctx.newPage();
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));

  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  const safeName = path.replace(/\//g, '_') || '_root';
  await page.screenshot({ path: `./audit/results/mobile${safeName}.png`, fullPage: false });

  // Check for horizontal overflow
  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    return { docWidth, winWidth, overflows: docWidth > winWidth };
  });
  console.log(`${path} overflow:`, overflow);

  // Check tap target sizes for interactive elements
  const smallTargets = await page.evaluate(() => {
    const interactive = Array.from(document.querySelectorAll('a, button, [role="button"], input, select'));
    return interactive
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          text: el.textContent?.trim()?.substring(0, 30),
          ariaLabel: el.getAttribute('aria-label'),
          width: Math.round(r.width),
          height: Math.round(r.height),
          tooSmall: r.width < 44 || r.height < 44,
        };
      })
      .filter(t => t.tooSmall && (t.width > 0 || t.height > 0));
  });

  if (smallTargets.length) {
    console.log(`${path} — ${smallTargets.length} tap targets under 44px:`);
    smallTargets.slice(0, 10).forEach(t => console.log(`  ${t.tag} "${t.text || t.ariaLabel}" ${t.width}x${t.height}`));
  } else {
    console.log(`${path} — No tap targets under 44px found`);
  }

  const errors = consoleLogs.filter(m => m.type === 'error');
  if (errors.length) {
    console.log(`${path} — Console errors:`);
    errors.slice(0, 3).forEach(e => console.log('  ' + e.text.substring(0, 150)));
  }

  await ctx.close();
}

// Game detail page — find a slug first
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/games', { waitUntil: 'domcontentloaded', timeout: 15000 });
  const gameLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="/games/"]')).map(a => a.href).slice(0, 3)
  );
  console.log('\nGame links found:', gameLinks);
  await ctx.close();

  if (gameLinks.length > 0) {
    const slug = new URL(gameLinks[0]).pathname;
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(BASE + slug, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await mobilePage.waitForTimeout(1500);
    await mobilePage.screenshot({ path: './audit/results/mobile_game_detail.png', fullPage: false });
    const ov = await mobilePage.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
      overflows: document.documentElement.scrollWidth > window.innerWidth,
    }));
    console.log(`Game detail ${slug} overflow:`, ov);
    await mobileCtx.close();
  }
}

await browser.close();
console.log('\nSection 5 done.');
