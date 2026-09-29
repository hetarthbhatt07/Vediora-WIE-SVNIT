import { test, expect } from '@playwright/test';

test('desktop patient chat fits inside one viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/login');
  await page.getByLabel('Email address').fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('test-only-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/patient\/dashboard/);
  await page.goto('/patient/chat');
  await expect(page.getByRole('heading', { name: 'Medical and medicine chat' })).toBeVisible();
  await expect(page.getByLabel('Ask a medical or medicine question')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Previous chats' })).toBeVisible();
  const size = await page.evaluate(() => ({ viewport: window.innerHeight, page: document.documentElement.scrollHeight }));
  expect(size.page).toBeLessThanOrEqual(size.viewport + 2);
});
