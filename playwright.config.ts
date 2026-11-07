import { defineConfig } from '@playwright/test';

const PORT = 4173;
// Served below the root, as GitHub Pages does, to prove the relative base works.
const PATH = '/the-new-frontier/';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: true,
  use: {
    baseURL: `http://localhost:${PORT}${PATH}`,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      // CI has no graphics card, so WebGL runs in software.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: `pnpm preview --port ${PORT} --strictPort --base ${PATH}`,
    url: `http://localhost:${PORT}${PATH}`,
    reuseExistingServer: false,
  },
});
