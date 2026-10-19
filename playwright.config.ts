import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, retries: 0,
  use: { ...devices['iPhone 13'], baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: process.env.ANCHOROS_CHROMIUM_PATH ? { executablePath: process.env.ANCHOROS_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'] } : {} } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: { command: 'pnpm preview --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
