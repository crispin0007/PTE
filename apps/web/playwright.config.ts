import { defineConfig, devices } from '@playwright/test';

// PW_CHROMIUM_PATH lets environments with a preinstalled Chromium skip `playwright install`.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
// A fake microphone that is always allowed, for the speaking recorder.
const launchOptions = {
  executablePath,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], launchOptions, permissions: ['microphone'] },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], launchOptions, permissions: ['microphone'] },
    },
  ],
  webServer: {
    // Tests run against a production build that includes in-review seed questions.
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    env: { OPENPTE_INCLUDE_UNREVIEWED: '1' },
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
