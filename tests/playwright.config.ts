import { defineConfig, devices } from '@playwright/test';

/**
 * Boots the REAL stack: the compiled API (against TEST_DATABASE_URL / TEST_REDIS_URL, already
 * migrated + seeded) and a production build of the web app served by apps/web/server.mjs.
 *
 * Nothing is mocked: users sign up and sign in through the real UI and API.
 */
export const E2E_JWT_SECRET = 'e2e-secret-that-is-at-least-32-characters-long!!';
const API_PORT = 3901;
const WEB_PORT = 4901;
const api = `http://localhost:${API_PORT}`;
const web = `http://localhost:${WEB_PORT}`;
const db = process.env.TEST_DATABASE_URL ?? 'postgres://fandom:fandom@localhost:5432/fandom_test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: web,
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /smoke/ },
  ],
  webServer: [
    {
      command: 'node e2e/fake-infinitepay.mjs',
      url: 'http://127.0.0.1:3902/health',
      reuseExistingServer: false,
      env: { FAKE_IP_PORT: '3902', FAKE_IP_WEB_URL: web },
    },
    {
      command: 'node ../database/src/cli.ts migrate && node ../database/src/cli.ts seed && node ../apps/api/dist/main.js',
      url: `${api}/health/ready`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL: db,
        ...(process.env.TEST_REDIS_URL ? { REDIS_URL: process.env.TEST_REDIS_URL } : {}),
        AUTH_JWT_SECRET: E2E_JWT_SECRET,
        AUTH_RATE_LIMIT_MAX: '10000',
        APP_PUBLIC_URL: web,
        API_PUBLIC_URL: api,
        INFINITEPAY_API_URL: 'http://127.0.0.1:3902',
        INFINITEPAY_HANDLE: 'fandome2e',
        INFINITEPAY_API_KEY: 'inchk_e2e_key',
        INFINITEPAY_WEBHOOK_TOKEN: 'e2e-webhook-token-0123456789abcdef',
        CHECKOUT_RATE_LIMIT_MAX: '10000',
        QUIZ_RATE_LIMIT_MAX: '10000',
        FORUM_RATE_LIMIT_MAX: '10000',
        GAME_RATE_LIMIT_MAX: '10000',
        GAME_START_RATE_LIMIT_MAX: '10000',
        WEB_ORIGINS: web,
        RATE_LIMIT_MAX: '10000',
      },
    },
    {
      command: 'pnpm --dir ../apps/web exec vite build --outDir dist-e2e --emptyOutDir && node ../apps/web/server.mjs',
      url: `${web}/healthz`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(WEB_PORT),
        WEB_ROOT: '../apps/web/dist-e2e',
        VITE_API_URL: api,
        VITE_MUSIC_DEBUG: '1',
      },
    },
  ],
});
