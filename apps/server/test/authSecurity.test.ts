import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.js';

const ENV_KEYS = [
  'SERVER_CORS_ORIGINS',
  'SERVER_AUTH_RATE_LIMIT_PER_MINUTE',
  'SERVER_TRUST_PROXY'
] as const;

const ADDRESS = '0x0000000000000000000000000000000000000001';
const ALLOWED_ORIGIN = 'http://allowed.example';
const DISALLOWED_ORIGIN = 'http://evil.example';

let app: FastifyInstance;
let savedEnv: Record<string, string | undefined> = {};

before(async () => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env.SERVER_CORS_ORIGINS = ALLOWED_ORIGIN;
  process.env.SERVER_AUTH_RATE_LIMIT_PER_MINUTE = '20';
  delete process.env.SERVER_TRUST_PROXY;

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
      'access-control-request-headers': 'content-type'
    }
  });
  assert.equal(allowed.headers['access-control-allow-origin'], ALLOWED_ORIGIN);

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
