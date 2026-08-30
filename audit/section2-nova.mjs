/**
 * AUDIT SECTION 2 — Point cloud / nova-hero visual
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleLogs = [];
page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));

await page.goto(BASE + '/dev/nova-hero', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(4000); // let WebGL render

// Screenshot 1: initial state
await page.screenshot({ path: './audit/results/nova_initial.png', fullPage: false });

// Screenshot 2: pointer in middle of canvas (parallax)
await page.mouse.move(720, 450);
await page.waitForTimeout(500);
await page.screenshot({ path: './audit/results/nova_hover_center.png', fullPage: false });

// Screenshot 3: pointer at edge
await page.mouse.move(100, 200);
await page.waitForTimeout(500);
await page.screenshot({ path: './audit/results/nova_hover_topleft.png', fullPage: false });

// Screenshot 4: scroll mid-dissolve
await page.evaluate(() => window.scrollTo(0, 300));
await page.waitForTimeout(500);
await page.screenshot({ path: './audit/results/nova_scroll_300.png', fullPage: false });

// Check for any shader/texture 404 errors
const shaderLogs = consoleLogs.filter(m =>
  m.text.includes('shader') || m.text.includes('ERROR') || m.text.includes('404') ||
  m.text.includes('uPointScale') || m.text.includes('WebGL') || m.text.includes('texture')
);

console.log('=== NOVA CONSOLE LOGS ===');
consoleLogs.forEach(m => console.log(`[${m.type}] ${m.text.substring(0, 200)}`));
console.log('\n=== SHADER/TEXTURE RELEVANT ===');
shaderLogs.forEach(m => console.log(`[${m.type}] ${m.text.substring(0, 300)}`));

await browser.close();
console.log('\nSection 2 done. Screenshots: nova_initial.png, nova_hover_*.png, nova_scroll_300.png');
