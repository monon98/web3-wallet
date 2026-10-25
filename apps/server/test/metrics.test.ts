import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.js';
import { resetMetricsForTests } from '../src/observability/metrics.js';
import {
  esploraAddressResponse,
  installFetchMock,
  restoreFetchMock
} from './mockUpstreams.js';

const METRICS_TOKEN = 'test-metrics-token-1234567890';
const BTC_ADDRESS = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT';

const ENV_KEYS = [
  'NODE_ENV',
  'SERVER_METRICS_TOKEN',
  'SERVER_RPC_URL',
  'ETHERSCAN_API_KEY',
  'SERVER_BTC_API_URL',
  'SERVER_BTC_MIN_INTERVAL_MS',
  'SERVER_BALANCE_RATE_LIMIT_PER_MINUTE',
  'SERVER_BALANCE_AUTH_RATE_LIMIT_PER_MINUTE'
] as const;

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env.NODE_ENV = 'test';
  delete process.env.SERVER_METRICS_TOKEN;
  delete process.env.SERVER_RPC_URL;
  delete process.env.ETHERSCAN_API_KEY;
  delete process.env.SERVER_BTC_API_URL;
  delete process.env.SERVER_BTC_MIN_INTERVAL_MS;
  delete process.env.SERVER_BALANCE_RATE_LIMIT_PER_MINUTE;
  delete process.env.SERVER_BALANCE_AUTH_RATE_LIMIT_PER_MINUTE;
  installFetchMock(() => {
    throw new Error('fetch_not_mocked');
  });
});

afterEach(() => {
  restoreFetchMock();
  resetMetricsForTests();
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

async function withApp(
  fn: (app: FastifyInstance) => Promise<void>
): Promise<void> {
  const app = await buildApp({ logger: false, enableSwagger: false });
  try {
    await fn(app);
  } finally {
    await app.close();
  }
}

async function fetchMetrics(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'GET',
    url: '/metrics',
    headers: { authorization: `Bearer ${METRICS_TOKEN}` }
  });
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers['content-type']), /^text\/plain/);
  return res.body;
}

test('未配置 SERVER_METRICS_TOKEN 时不暴露 /metrics', async () => {
  await withApp(async (app) => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    assert.equal(res.statusCode, 404);
  });
});

test('配置 token 后要求 Bearer 鉴权', async () => {
  process.env.SERVER_METRICS_TOKEN = METRICS_TOKEN;

  await withApp(async (app) => {
    const missing = await app.inject({ method: 'GET', url: '/metrics' });
    assert.equal(missing.statusCode, 401);
    assert.match(
      String(missing.headers['www-authenticate']),
      /Bearer realm="metrics"/
    );

    const wrong = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer wrong-token' }
    });
    assert.equal(wrong.statusCode, 401);

    const body = await fetchMetrics(app);
    assert.match(body, /# TYPE web3_wallet_http_requests_total counter/);
    assert.match(body, /web3_wallet_upstream_configured\{provider="rpc"\} 0/);
    assert.match(
      body,
      /web3_wallet_upstream_configured\{provider="etherscan"\} 0/
    );
  });
});

test('HTTP 指标使用路由模板并统计 4xx', async () => {
  process.env.SERVER_METRICS_TOKEN = METRICS_TOKEN;

  await withApp(async (app) => {
    const health = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200);

    const missing = await app.inject({
      method: 'GET',
      url: '/does-not-exist?address=0x123'
    });
    assert.equal(missing.statusCode, 404);

    const body = await fetchMetrics(app);
    assert.match(
      body,
      /web3_wallet_http_requests_total\{method="GET",route="\/health",status="200"\} 1/
    );
    assert.match(
      body,
      /web3_wallet_http_requests_total\{method="GET",route="unmatched",status="404"\} 1/
    );
    assert.match(body, /web3_wallet_http_errors_total\{status_class="4xx"\} 1/);
  });
});

test('上游成功调用记录可用性时间戳', async () => {
  process.env.SERVER_METRICS_TOKEN = METRICS_TOKEN;
  process.env.SERVER_BTC_API_URL = 'https://btc.test';
  process.env.SERVER_BTC_MIN_INTERVAL_MS = '0';
  installFetchMock((url) => {
    if (url.startsWith('https://btc.test')) {
      return esploraAddressResponse({ balanceSat: 1 });
    }
    throw new Error(`unexpected_url:${url}`);
  });

  await withApp(async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/btc/explorer/address?address=${BTC_ADDRESS}`
    });
    assert.equal(res.statusCode, 200);

    const body = await fetchMetrics(app);
    assert.match(
      body,
      /web3_wallet_upstream_requests_total\{provider="esplora",outcome="success"\} 1/
    );
    assert.match(
      body,
      /web3_wallet_upstream_last_success_timestamp_seconds\{provider="esplora"\} \d/
    );
  });
});

test('上游 429 记录限流与错误分类', async () => {
  process.env.SERVER_METRICS_TOKEN = METRICS_TOKEN;
  process.env.SERVER_BTC_API_URL = 'https://btc.test';
  process.env.SERVER_BTC_MIN_INTERVAL_MS = '0';
  installFetchMock(() => new Response('rate limited', { status: 429 }));

  await withApp(async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/btc/explorer/address?address=${BTC_ADDRESS}`
    });
    assert.equal(res.statusCode, 429);

    const body = await fetchMetrics(app);
    assert.match(
      body,
      /web3_wallet_upstream_requests_total\{provider="esplora",outcome="error"\} 1/
    );
    assert.match(
      body,
      /web3_wallet_upstream_errors_total\{provider="esplora",kind="rate_limited"\} 1/
    );
    assert.match(
      body,
      /web3_wallet_upstream_rate_limited_total\{provider="esplora"\} 1/
    );
  });
});

test('本地余额限流拒绝单独计数', async () => {
  process.env.SERVER_METRICS_TOKEN = METRICS_TOKEN;
  process.env.SERVER_BTC_API_URL = 'https://btc.test';
  process.env.SERVER_BTC_MIN_INTERVAL_MS = '0';
  process.env.SERVER_BALANCE_RATE_LIMIT_PER_MINUTE = '1';
  installFetchMock((url) => {
    if (url.startsWith('https://btc.test')) {
      return esploraAddressResponse({ balanceSat: 1 });
    }
    throw new Error(`unexpected_url:${url}`);
  });

  await withApp(async (app) => {
    const payload = { btc: { addresses: [BTC_ADDRESS] } };
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/balances/query',
      payload
    });
    assert.equal(first.statusCode, 200);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/balances/query',
      payload
    });
    assert.equal(second.statusCode, 429);

    const body = await fetchMetrics(app);
    assert.match(
      body,
      /web3_wallet_rate_limit_rejections_total\{scope="balances"\} 1/
    );
  });
});
