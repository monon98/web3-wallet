import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * P4-1 Web E2E 配置。
 *
 * 启动三条本地进程：
 * - `support/fakeUpstream.mjs`：EVM RPC / Etherscan / TronGrid / Esplora 假上游；
 * - Fastify（`@plugin/server`）：真实 API、Cookie 会话、CSRF、广播与余额编排；
 * - Next dev（`@plugin/web`）：真实页面。
 *
 * 测试只使用 127.0.0.1 与固定测试密钥；不访问真实链、扩展商店或第三方 API。
 */

const packageDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const WEB_PORT = 3100;
const SERVER_PORT = 8788;
const UPSTREAM_PORT = 8799;

const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;
const SERVER_ORIGIN = `http://127.0.0.1:${SERVER_PORT}`;
const UPSTREAM_ORIGIN = `http://127.0.0.1:${UPSTREAM_PORT}`;

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: WEB_ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command: 'node support/fakeUpstream.mjs',
      cwd: packageDir,
      url: `${UPSTREAM_ORIGIN}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        E2E_UPSTREAM_PORT: String(UPSTREAM_PORT)
      }
    },
    {
      command: 'pnpm --filter @plugin/server exec tsx src/index.ts',
      cwd: repoRoot,
      url: `${SERVER_ORIGIN}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        SERVER_PORT: String(SERVER_PORT),
        SERVER_HOST: '127.0.0.1',
        SERVER_CORS_ORIGINS: WEB_ORIGIN,
        SERVER_RPC_URL: `${UPSTREAM_ORIGIN}/rpc`,
        ETHERSCAN_API_KEY: 'e2e-test-key',
        ETHERSCAN_API_URL: `${UPSTREAM_ORIGIN}/etherscan`,
        ETHERSCAN_PRO_MIN_INTERVAL_MS: '0',
        ETHERSCAN_TOKEN_CACHE_TTL_MS: '0',
        ETHERSCAN_TOKEN_STALE_TTL_MS: '0',
        SERVER_TRON_API_URL: `${UPSTREAM_ORIGIN}/tron`,
        SERVER_TRON_MIN_INTERVAL_MS: '0',
        SERVER_BTC_API_URL: `${UPSTREAM_ORIGIN}/btc`,
        SERVER_BTC_MIN_INTERVAL_MS: '0',
        SERVER_BALANCE_CACHE_TTL_MS: '0',
        SERVER_BALANCE_STALE_TTL_MS: '0',
        SERVER_BALANCE_RATE_LIMIT_PER_MINUTE: '1000',
        SERVER_BALANCE_AUTH_RATE_LIMIT_PER_MINUTE: '1000',
        SERVER_AUTH_RATE_LIMIT_PER_MINUTE: '100',
        SESSION_SECRET: 'e2e-test-session-secret-not-for-production',
        SERVER_SESSION_STORE: 'memory',
        LOG_LEVEL: 'warn',
        LOG_PRETTY: '0',
        LOG_TO_FILE: '0'
      }
    },
    {
      command: `pnpm --filter @plugin/web exec next dev -H 127.0.0.1 -p ${WEB_PORT}`,
      cwd: repoRoot,
      url: WEB_ORIGIN,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_API_URL: SERVER_ORIGIN,
        NEXT_TELEMETRY_DISABLED: '1'
      }
    }
  ]
});
