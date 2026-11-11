import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// Served below the root, as GitHub Pages does, to prove the relative base works.
const PATH = '/the-new-frontier/';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  // Each test's time in the log, so CI shows where the time goes (S3k).
  reporter: 'list',
  // WebGL runs in software, so tests sharing the machine slow each other to timeouts.
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}${PATH}`,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          // CI has no graphics card, so WebGL runs in software.
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
        },
      },
    },
    // Firefox and WebKit wait for a later brief; the code stays free of engine-only features.
  ],
  webServer: {
    command: `pnpm preview --port ${PORT} --strictPort --base ${PATH}`,
    url: `http://localhost:${PORT}${PATH}`,
    reuseExistingServer: false,
  },
});
