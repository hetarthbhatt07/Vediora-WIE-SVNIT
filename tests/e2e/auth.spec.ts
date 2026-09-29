import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email = 'alice@example.test') {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel(/^Password/).fill('test-only-password');
  await Promise.all([
    page.waitForURL(/\/patient\/dashboard$/, { waitUntil: 'domcontentloaded', timeout: 15000 }),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);
  await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible({ timeout: 10000 });
}

test('anonymous users and forged legacy roles cannot access patient or doctor pages', async ({ page, request }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('medsafe_current_user', JSON.stringify({ role: 'admin', patient_id: 101 })));
  await page.goto('/patient/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/doctor/patients');
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get('/api/patient/profile')).status()).toBe(401);
  expect((await request.post('/api/patient/medicine-chat', { headers: { Origin: 'http://localhost:3101' }, data: { message: 'warfarin and argatroban' } })).status()).toBe(401);
});

test('wrong passwords fail; no prefilled credentials or demo bypass', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email address')).toHaveValue('');
  await page.getByLabel('Email address').fill('alice@example.test');
  await page.getByLabel(/^Password/).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Invalid login credentials', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('profile persists across reload; patient IDs and origins cannot be overridden; sign-out protects routes', async ({ page }) => {
  await login(page);
  await expect(page.getByText('Warfarin', { exact: false })).toHaveCount(0);
  await Promise.all([
    page.waitForURL(/\/patient\/chat$/, { timeout: 15000 }),
    page.getByRole('link', { name: 'Medicine safety chat' }).click(),
  ]);
  await expect(page.getByRole('heading', { name: 'Medical and medicine chat', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Ask a medical or medicine question')).toBeVisible();
  await page.goto('/patient/dashboard');
  await page.getByRole('link', { name: 'Edit health profile' }).click();
  await page.getByLabel('Weight (kg)').fill('65.5');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toHaveText('Your profile has been saved.');
  await page.reload();
  await expect(page.getByLabel('Weight (kg)')).toHaveValue('65.5');
  const tamper = await page.request.patch('/api/patient/profile', { headers: { Origin: 'http://localhost:3101' }, data: { id: '22222222-2222-4222-8222-222222222222', full_name: 'Unauthorized edit' } });
  expect(tamper.status()).toBe(400);
  expect((await page.request.patch('/api/patient/profile', { headers: { Origin: 'https://other.example' }, data: { full_name: 'Unauthorized edit' } })).status()).toBe(403);
  await page.goto('/doctor/patients');
  await expect(page).toHaveURL(/\/access-pending$/);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/patient/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'bob@example.test');
  await expect(page.getByRole('heading', { name: 'Welcome, Bob Patient' })).toBeVisible();
  await expect(page.getByText('65.5 kg', { exact: true })).toHaveCount(0);
});

test('signup requires email confirmation and recovery reports its actual result', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Full name').fill('Synthetic Patient');
  await page.getByLabel('Email address').fill('synthetic@example.test');
  await page.getByLabel(/^Password/).fill('test-only-password');
  await page.getByLabel('Confirm password').fill('test-only-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await page.goto('/forgot-password');
  await page.getByLabel('Email address').fill('synthetic@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If this email has an account');
});

test('missing table shows an error, never seeded patient data', async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/test/missing-table', { data: { enabled: true } });
  try {
    await page.goto('/login');
    await page.getByLabel('Email address').fill('alice@example.test');
    await page.getByLabel(/^Password/).fill('test-only-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(/Profile storage has not been set up/)).toBeVisible();
    await expect(page.getByText('Ananya Sharma', { exact: false })).toHaveCount(0);
  } finally { await request.post('http://127.0.0.1:54329/test/missing-table', { data: { enabled: false } }); }
});
