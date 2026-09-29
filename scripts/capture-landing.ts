import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: '.landing-review.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: '.landing-mobile-review.png', fullPage: true });
await browser.close();
