import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import { buildApp } from '../src/app.js';

const ENV_KEYS = [
  'NODE_ENV',
  'SERVER_CORS_ORIGINS',
  'SERVER_AUTH_RATE_LIMIT_PER_MINUTE',
  'SERVER_RPC_URL',
  'SERVER_SESSION_STORE',
  'SERVER_SESSION_FILE',
  'SERVER_COOKIE_SAMESITE',
  'SERVER_COOKIE_SECURE',
  'SESSION_SECRET',
  'SERVER_TRUST_PROXY'
] as const;

const ADDRESS = '0x0000000000000000000000000000000000000001';
const ALLOWED_ORIGIN = 'http://allowed.example';
const DISALLOWED_ORIGIN = 'http://evil.example';

function readSessionCookie(
  setCookie: string | string[] | undefined
): string | null {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!header) {
    return null;
  }
  const match = /(?:^|;\s*)wallet_session=([^;]+)/.exec(header);
  return match?.[1] ? `wallet_session=${match[1]}` : null;
}

let app: FastifyInstance;
let savedEnv: Record<string, string | undefined> = {};

before(async () => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env.SERVER_CORS_ORIGINS = ALLOWED_ORIGIN;
  process.env.SERVER_AUTH_RATE_LIMIT_PER_MINUTE = '20';
  process.env.NODE_ENV = 'test';
  delete process.env.SERVER_TRUST_PROXY;
  delete process.env.SERVER_RPC_URL;
  delete process.env.SERVER_SESSION_STORE;
  delete process.env.SERVER_SESSION_FILE;
  delete process.env.SERVER_COOKIE_SAMESITE;
  delete process.env.SERVER_COOKIE_SECURE;
  delete process.env.SESSION_SECRET;

  app = await buildApp({ logger: false, enableSwagger: false });
});

after(async () => {
  await app.close();
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test('所有响应补基础安全头', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
});

test('CORS 只放行白名单 Origin', async () => {
  const allowed = await app.inject({
    method: 'OPTIONS',
    url: '/api/v1/auth/challenge',
    headers: {
      origin: ALLOWED_ORIGIN,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,x-csrf-token'
    }
  });
  assert.equal(allowed.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
  assert.equal(allowed.headers['access-control-allow-credentials'], 'true');
  assert.match(
    String(allowed.headers['access-control-allow-headers']),
    /x-csrf-token/i
  );

  const denied = await app.inject({
    method: 'OPTIONS',
    url: '/api/v1/auth/challenge',
    headers: {
      origin: DISALLOWED_ORIGIN,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type'
    }
  });
  assert.equal(denied.headers['access-control-allow-origin'], undefined);
});

test('非白名单 Origin 不能创建登录 challenge', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/challenge',
    headers: { origin: DISALLOWED_ORIGIN },
    payload: { address: ADDRESS, chainId: 1 }
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, 'origin_not_allowed');
});

test('白名单 Origin 的 challenge 不缓存且带 CORS 头', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/challenge',
    headers: { origin: ALLOWED_ORIGIN },
    payload: { address: ADDRESS, chainId: 1 }
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
  assert.equal(typeof res.json().challengeId, 'string');
});

test('浏览器登录写 HttpOnly Cookie，写操作校验 CSRF', async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const challengeRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/challenge',
    headers: { origin: ALLOWED_ORIGIN },
    payload: { address: account.address, chainId: 1 }
  });
  assert.equal(challengeRes.statusCode, 200);
  const challenge = challengeRes.json() as {
    challengeId: string;
    message: string;
  };

  const signature = await account.signMessage({ message: challenge.message });
  const verifyRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify',
    headers: { origin: ALLOWED_ORIGIN },
    payload: {
      challengeId: challenge.challengeId,
      address: account.address,
      signature
    }
  });
  assert.equal(verifyRes.statusCode, 200);
  const verifyBody = verifyRes.json() as {
    address: string;
    csrfToken?: string;
    sessionToken?: string;
  };
  assert.equal(verifyBody.address, account.address);
  assert.equal(verifyBody.sessionToken, undefined);
  assert.equal(typeof verifyBody.csrfToken, 'string');

  const setCookie = verifyRes.headers['set-cookie'];
  const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.match(String(rawCookie), /wallet_session=/);
  assert.match(String(rawCookie).toLowerCase(), /httponly/);
  assert.match(String(rawCookie).toLowerCase(), /samesite=lax/);
  assert.match(String(rawCookie).toLowerCase(), /path=\//);
  assert.equal(verifyRes.headers['access-control-allow-credentials'], 'true');

  const cookie = readSessionCookie(setCookie);
  assert.ok(cookie);

  const meRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { cookie }
  });
  assert.equal(meRes.statusCode, 200);
  assert.equal(meRes.json().address, account.address);
  assert.equal(meRes.json().csrfToken, verifyBody.csrfToken);

  const txWithoutCsrf = await app.inject({
    method: 'POST',
    url: '/api/v1/tx/broadcast',
    headers: { cookie, origin: ALLOWED_ORIGIN },
    payload: { chainId: 1, signedTransaction: '0x00' }
  });
  assert.equal(txWithoutCsrf.statusCode, 403);
  assert.equal(txWithoutCsrf.json().error, 'csrf_invalid');

  const logoutWithoutCsrf = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    headers: { cookie, origin: ALLOWED_ORIGIN }
  });
  assert.equal(logoutWithoutCsrf.statusCode, 403);
  assert.equal(logoutWithoutCsrf.json().error, 'csrf_invalid');

  const logout = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    headers: {
      cookie,
      origin: ALLOWED_ORIGIN,
      'x-csrf-token': String(verifyBody.csrfToken)
    }
  });
  assert.equal(logout.statusCode, 200);
  assert.match(String(logout.headers['set-cookie']), /wallet_session=;/);

  const meAfterLogout = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { cookie }
  });
  assert.equal(meAfterLogout.statusCode, 401);
});

test('无 Origin 的 API 客户端仍拿 Bearer token，写操作不需要 CSRF', async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const challengeRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/challenge',
    payload: { address: account.address, chainId: 1 }
  });
  assert.equal(challengeRes.statusCode, 200);
  const challenge = challengeRes.json() as {
    challengeId: string;
    message: string;
  };

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
  const verifyBody = verifyRes.json() as {
    sessionToken?: string;
    csrfToken?: string;
  };
  assert.equal(typeof verifyBody.sessionToken, 'string');
  assert.equal(verifyBody.csrfToken, undefined);
  assert.equal(verifyRes.headers['set-cookie'], undefined);

  const authorization = `Bearer ${String(verifyBody.sessionToken)}`;
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { authorization }
  });
  assert.equal(meRes.statusCode, 200);
  assert.equal(meRes.json().address, account.address);
  assert.equal(meRes.json().csrfToken, undefined);

  // 未配置 RPC 时返回 503，说明已通过鉴权与 CSRF 检查，而不是 401 / 403。
  const txRes = await app.inject({
    method: 'POST',
    url: '/api/v1/tx/broadcast',
    headers: { authorization },
    payload: { chainId: 1, signedTransaction: '0x00' }
  });
  assert.equal(txRes.statusCode, 503);
  assert.equal(txRes.json().error, 'rpc_not_configured');

  const logoutRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    headers: { authorization }
  });
  assert.equal(logoutRes.statusCode, 200);

  const meAfterLogout = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { authorization }
  });
  assert.equal(meAfterLogout.statusCode, 401);
});

test('auth challenge 按 IP 限流', async () => {
  process.env.SERVER_AUTH_RATE_LIMIT_PER_MINUTE = '2';

  const request = () =>
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/challenge',
      remoteAddress: '203.0.113.10',
      payload: { address: ADDRESS, chainId: 1 }
    });

  const first = await request();
  const second = await request();
  const third = await request();

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 429);
  assert.equal(third.json().error, 'rate_limited');
  assert.equal(third.headers['x-ratelimit-limit'], '2');
  const retryAfter = Number(third.headers['retry-after']);
  assert.ok(retryAfter >= 1 && retryAfter <= 60);
});
