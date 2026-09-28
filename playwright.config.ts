import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://localhost:3101', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node tests/mock-supabase.mjs', url: 'http://127.0.0.1:54329/health', reuseExistingServer: !process.env.CI, timeout: 30000 },
    { command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101', url: 'http://127.0.0.1:3101/login', reuseExistingServer: !process.env.CI, timeout: 120000,
      env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-only-publishable-key', DATABASE_URL: '', VEDIORA_TEST_BUILD: '1', NEXT_TELEMETRY_DISABLED: '1' } },
  ],
});
