import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type {
  AuthChallengeResponse,
  AuthVerifyResponse,
  BalanceQueryResponse
} from '@plugin/shared';
import type { FastifyInstance } from 'fastify';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import { buildApp } from '../src/app.js';
import {
  esploraAddressResponse,
  etherscanTokenResponse,
  evmRpcResponse,
  installFetchMock,
  jsonResponse,
  restoreFetchMock,
  setFetchHandler,
  tronAccountResponse
} from './mockUpstreams.js';

const EVM_ADDRESS = '0x0000000000000000000000000000000000000001';
const TOKEN_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const TRON_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRON_ADDRESS_2 = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7';
const BTC_ADDRESS = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT';
const BTC_ADDRESS_2 = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

const ENV_KEYS = [
  'SERVER_RPC_URL',
  'ETHERSCAN_API_KEY',
  'ETHERSCAN_API_URL',
  'ETHERSCAN_PRO_MIN_INTERVAL_MS',
  'ETHERSCAN_TOKEN_CACHE_TTL_MS',
  'ETHERSCAN_TOKEN_STALE_TTL_MS',
  'SERVER_TRON_API_URL',
  'SERVER_TRON_API_KEY',
  'SERVER_TRON_MIN_INTERVAL_MS',
  'SERVER_BTC_API_URL',
  'SERVER_BTC_MIN_INTERVAL_MS',
  'SERVER_BALANCE_CACHE_TTL_MS',
  'SERVER_BALANCE_STALE_TTL_MS',
  'SERVER_BALANCE_RATE_LIMIT_PER_MINUTE',
  'SERVER_BALANCE_AUTH_RATE_LIMIT_PER_MINUTE'
] as const;

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env.SERVER_RPC_URL = 'https://rpc.test';
  process.env.ETHERSCAN_API_KEY = 'test-key';
  process.env.ETHERSCAN_API_URL = 'https://etherscan.test/v2/api';
  process.env.ETHERSCAN_PRO_MIN_INTERVAL_MS = '0';
  process.env.ETHERSCAN_TOKEN_CACHE_TTL_MS = '0';
  process.env.ETHERSCAN_TOKEN_STALE_TTL_MS = '0';
  process.env.SERVER_TRON_API_URL = 'https://tron.test';
  process.env.SERVER_TRON_MIN_INTERVAL_MS = '0';
  process.env.SERVER_BTC_API_URL = 'https://btc.test';
  process.env.SERVER_BTC_MIN_INTERVAL_MS = '0';
  process.env.SERVER_BALANCE_CACHE_TTL_MS = '0';
  process.env.SERVER_BALANCE_STALE_TTL_MS = '0';
  process.env.SERVER_BALANCE_RATE_LIMIT_PER_MINUTE = '1000';
  process.env.SERVER_BALANCE_AUTH_RATE_LIMIT_PER_MINUTE = '1000';
  delete process.env.SERVER_TRON_API_KEY;
  installFetchMock(() => {
    throw new Error('fetch_not_mocked');
  });
});

afterEach(() => {
  restoreFetchMock();
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

function postBalances(
  app: FastifyInstance,
  payload: unknown,
  options: { token?: string; remoteAddress?: string } = {}
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/balances/query',
    payload,
    headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
    remoteAddress: options.remoteAddress ?? '127.0.0.1'
  });
}

test('统一查询：EVM 原生 + ERC-20、Tron、BTC 一次返回', async () => {
  installFetchMock((url, init) => {
    if (url.startsWith('https://rpc.test')) {
      return evmRpcResponse(init, {
        chainId: 1,
        balanceWei: '0xde0b6b3a7640000'
      });
    }
    if (url.startsWith('https://etherscan.test')) {
      return etherscanTokenResponse([
        {
          tokenAddress: TOKEN_ADDRESS,
          tokenName: 'Tether USD',
          tokenSymbol: 'USDT',
          tokenQuantity: '2500000',
          tokenDivisor: '6'
        }
      ]);
    }
    if (url.startsWith('https://tron.test')) {
      return tronAccountResponse({
        balanceSun: 2_000_000,
        trc20: [
          {
            contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            balanceRaw: '1500000'
          }
        ]
      });
    }
    if (url.startsWith('https://btc.test')) {
      return esploraAddressResponse({
        balanceSat: 100_000_000,
        txCount: 3
      });
    }
    throw new Error(`unexpected_url:${url}`);
  });

  await withApp(async (app) => {
    const res = await postBalances(app, {
      evm: { chainId: 1, addresses: [EVM_ADDRESS], includeTokens: true },
      tron: { addresses: [TRON_ADDRESS], includeTokens: true },
      btc: { addresses: [BTC_ADDRESS] }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as BalanceQueryResponse;
    assert.equal(body.auth, 'anonymous');
    assert.equal(body.partial, false);
    assert.equal(body.evm?.source, 'rpc');
    assert.equal(body.evm?.rows[0]?.balanceWei, '1000000000000000000');
    assert.equal(body.evm?.rows[0]?.tokens?.[0]?.tokenSymbol, 'USDT');
    assert.equal(body.tron?.accounts[0]?.balanceSun, '2000000');
    assert.equal(body.tron?.accounts[0]?.trc20[0]?.balanceRaw, '1500000');
    assert.equal(body.btc?.addresses[0]?.balanceSat, '100000000');
  });
});

test('部分失败：Tron 429 与 BTC 不可达保留其它地址结果', async () => {
  installFetchMock((url) => {
    if (url.includes('tron.test')) {
      return url.includes(TRON_ADDRESS)
        ? tronAccountResponse({ balanceSun: 1_000_000 })
        : jsonResponse({ error: 'rate' }, 429);
    }
    if (url.includes('btc.test')) {
      if (url.includes(BTC_ADDRESS)) {
        return esploraAddressResponse({ balanceSat: 42 });
      }
      throw new TypeError('fetch failed');
    }
    throw new Error(`unexpected_url:${url}`);
  });

  await withApp(async (app) => {
    const res = await postBalances(app, {
      tron: { addresses: [TRON_ADDRESS, TRON_ADDRESS_2] },
      btc: { addresses: [BTC_ADDRESS, BTC_ADDRESS_2] }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as BalanceQueryResponse;
    assert.equal(body.partial, true);
    assert.equal(body.errors.length, 0);
    assert.equal(body.tron?.accounts[0]?.balanceSun, '1000000');
    assert.match(body.tron?.accounts[1]?.error ?? '', /tron_grid_http_429/);
    assert.equal(body.btc?.addresses[0]?.balanceSat, '42');
    assert.equal(body.btc?.addresses[1]?.error, 'esplora_unreachable');
  });
});

test('地址校验：非法 EVM 地址返回 400', async () => {
  await withApp(async (app) => {
    const res = await postBalances(app, {
      evm: { chainId: 1, addresses: ['0x1234'] }
    });
    assert.equal(res.statusCode, 400);
    const body = res.json() as { error: string };
    assert.equal(body.error, 'invalid_evm_address');
  });
});

test('鉴权：非法 Bearer 返回 401，不触发上游', async () => {
  await withApp(async (app) => {
    const res = await postBalances(
      app,
      { btc: { addresses: [BTC_ADDRESS] } },
      { token: 'invalid-token' }
    );
    assert.equal(res.statusCode, 401);
    const body = res.json() as { error: string };
    assert.equal(body.error, 'unauthorized');
  });
});

test('鉴权：有效会话按登录限额查询并标记 auth=session', async () => {
  installFetchMock((url) => {
    if (url.startsWith('https://btc.test')) {
      return esploraAddressResponse({ balanceSat: 7 });
    }
    throw new Error(`unexpected_url:${url}`);
  });

  await withApp(async (app) => {
    const account = privateKeyToAccount(generatePrivateKey());
    const challengeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/challenge',
      headers: { origin: 'http://localhost:3000' },
      payload: { address: account.address, chainId: 1 }
    });
    assert.equal(challengeRes.statusCode, 200);
    const challenge = challengeRes.json() as AuthChallengeResponse;
    const signature = await account.signMessage({ message: challenge.message });
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify',
      payload: {
        challengeId: challenge.challengeId,
        address: account.address,
        signature
      }
    });
    assert.equal(verifyRes.statusCode, 200);
    const session = verifyRes.json() as AuthVerifyResponse;

    const res = await postBalances(
      app,
      { btc: { addresses: [BTC_ADDRESS] } },
      { token: session.sessionToken, remoteAddress: '10.0.0.5' }
    );
    assert.equal(res.statusCode, 200);
    const body = res.json() as BalanceQueryResponse;
    assert.equal(body.auth, 'session');
    assert.equal(body.btc?.addresses[0]?.balanceSat, '7');
  });
});

test('限流：匿名超过每分钟上限返回 429', async () => {
  process.env.SERVER_BALANCE_RATE_LIMIT_PER_MINUTE = '1';
  installFetchMock((url) => {
    if (url.startsWith('https://btc.test')) {
      return esploraAddressResponse({ balanceSat: 1 });
    }
    throw new Error(`unexpected_url:${url}`);
  });

  await withApp(async (app) => {
    const payload = { btc: { addresses: [BTC_ADDRESS] } };
    const first = await postBalances(app, payload, {
      remoteAddress: '10.0.0.6'
    });
    assert.equal(first.statusCode, 200);

    const second = await postBalances(app, payload, {
      remoteAddress: '10.0.0.6'
    });
    assert.equal(second.statusCode, 429);
    const body = second.json() as { error: string; retryAfterMs: number };
    assert.equal(body.error, 'rate_limited');
    assert.ok(body.retryAfterMs > 0);
  });
});

test('ERC-20 降级：Etherscan 不可达时回退 stale 缓存', async () => {
  process.env.ETHERSCAN_TOKEN_STALE_TTL_MS = '60000';
  const address = '0x0000000000000000000000000000000000000003';

  installFetchMock((url, init) => {
    if (url.startsWith('https://rpc.test')) {
      return evmRpcResponse(init, {
        chainId: 1,
        balanceWei: '0x1'
      });
    }
    if (url.startsWith('https://etherscan.test')) {
      return etherscanTokenResponse([
        {
          tokenAddress: TOKEN_ADDRESS,
          tokenName: 'Tether USD',
          tokenSymbol: 'USDT',
          tokenQuantity: '1000000',
          tokenDivisor: '6'
        }
      ]);
    }
    throw new Error(`unexpected_url:${url}`);
  });

  await withApp(async (app) => {
    const payload = {
      evm: { chainId: 1, addresses: [address], includeTokens: true }
    };
    const first = await postBalances(app, payload);
    assert.equal(first.statusCode, 200);
    const firstBody = first.json() as BalanceQueryResponse;
    assert.equal(firstBody.evm?.rows[0]?.tokens?.[0]?.tokenSymbol, 'USDT');

    setFetchHandler((url, init) => {
      if (url.startsWith('https://rpc.test')) {
        return evmRpcResponse(init, {
          chainId: 1,
          balanceWei: '0x1'
        });
      }
      if (url.startsWith('https://etherscan.test')) {
        throw new TypeError('fetch failed');
      }
      throw new Error(`unexpected_url:${url}`);
    });

    const second = await postBalances(app, payload);
    assert.equal(second.statusCode, 200);
    const secondBody = second.json() as BalanceQueryResponse;
    assert.equal(secondBody.partial, true);
    assert.equal(secondBody.evm?.rows[0]?.tokens?.[0]?.tokenSymbol, 'USDT');
    assert.equal(secondBody.evm?.rows[0]?.tokenStale, true);
    assert.equal(secondBody.evm?.rows[0]?.tokenError, 'etherscan_unreachable');
    assert.ok(secondBody.evm?.rows[0]?.tokenCachedAt);
  });
});

test('全链不可达：返回按链错误且不抛 5xx', async () => {
  installFetchMock(() => {
    throw new TypeError('fetch failed');
  });

  await withApp(async (app) => {
    const res = await postBalances(
      app,
      {
        evm: { chainId: 1, addresses: [EVM_ADDRESS], includeTokens: false },
        tron: { addresses: [TRON_ADDRESS] },
        btc: { addresses: [BTC_ADDRESS] }
      },
      { remoteAddress: '10.0.0.8' }
    );
    assert.equal(res.statusCode, 200);
    const body = res.json() as BalanceQueryResponse;
    assert.equal(body.partial, true);
    // EVM 原生余额是整组失败；Tron / BTC 批量接口按地址保留错误条目。
    assert.equal(body.errors.length, 1);
    assert.equal(body.errors[0]?.family, 'evm');
    assert.equal(body.tron?.accounts[0]?.error, 'tron_grid_unreachable');
    assert.equal(body.btc?.addresses[0]?.error, 'esplora_unreachable');
  });
});

test('状态接口：返回限额、缓存与上游配置', async () => {
  await withApp(async (app) => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/balances/status'
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      maxAddressesPerChain: number;
      rateLimit: { anonymousPerMinute: number };
      upstream: { etherscanConfigured: boolean };
    };
    assert.equal(body.maxAddressesPerChain, 20);
    assert.equal(body.rateLimit.anonymousPerMinute, 1000);
    assert.equal(body.upstream.etherscanConfigured, true);
  });
});
