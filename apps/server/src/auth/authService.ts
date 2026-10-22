import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getAddress, isAddress, verifyMessage } from 'viem';

import { getDefaultWebOrigin } from '../config/cors.js';
import {
  deleteStoredSession,
  getStoredSession,
  pruneStoredSessions,
  setStoredSession,
  type StoredSession
} from './sessionStore.js';

/**
 * 登录 challenge / 会话签发。
 *
 * 调用链：`routes/auth.ts` → 本模块；`routes/tx.ts` / `routes/balances.ts` 通过
 * `sessionAuth.ts` 复用会话。challenge 仍为进程内存（5 分钟一次性），会话委托
 * `sessionStore.ts`（生产默认文件持久化）。
 * 安全边界：只保存地址、链 ID、消息与过期时间；**不保存私钥 / 助记词 / 签名**。
 */

const CHALLENGE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 24 * 60 * 60_000;
const MAX_CHALLENGES = 10_000;

type ChallengeRecord = {
  address: `0x${string}`;
  chainId: number;
  message: string;
  expiresAt: number;
};

export type AuthSession = StoredSession;

const challenges = new Map<string, ChallengeRecord>();

export class AuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function pruneExpired(now: number): void {
  for (const [id, challenge] of challenges) {
    if (challenge.expiresAt <= now) {
      challenges.delete(id);
    }
  }
  pruneStoredSessions(now);
}

function normalizeAddress(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new AuthError('invalid_address', 400);
  }
  return getAddress(address);
}

function resolveOrigin(origin: string | undefined): {
  domain: string;
  uri: string;
} {
  const fallback = getDefaultWebOrigin();
  const raw = origin?.trim() || fallback;
  try {
    const url = new URL(raw);
    return { domain: url.host, uri: url.origin };
  } catch {
    const url = new URL(fallback);
    return { domain: url.host, uri: url.origin };
  }
}

function buildMessage(params: {
  domain: string;
  uri: string;
  address: `0x${string}`;
  chainId: number;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}): string {
  return `${params.domain} wants you to sign in with your Ethereum account:
${params.address}

Sign in to Plugin Web.

URI: ${params.uri}
Version: 1
Chain ID: ${params.chainId}
Nonce: ${params.nonce}
Issued At: ${params.issuedAt.toISOString()}
Expiration Time: ${params.expiresAt.toISOString()}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * 创建一次性登录消息。challenge 5 分钟过期，验证时立即删除，防止重放。
 */
export function createAuthChallenge(params: {
  address: string;
  chainId: number;
  origin?: string;
}): { challengeId: string; message: string; expiresAt: string } {
  const now = Date.now();
  pruneExpired(now);

  if (challenges.size >= MAX_CHALLENGES) {
    const oldest = challenges.keys().next().value;
    if (typeof oldest === 'string') {
      challenges.delete(oldest);
    }
  }

  const address = normalizeAddress(params.address);
  const challengeId = randomUUID();
  const nonce = randomBytes(16).toString('hex');
  const issuedAt = new Date(now);
  const expiresAt = new Date(now + CHALLENGE_TTL_MS);
  const { domain, uri } = resolveOrigin(params.origin);
  const message = buildMessage({
    domain,
    uri,
    address,
    chainId: params.chainId,
    nonce,
    issuedAt,
    expiresAt
  });

  challenges.set(challengeId, {
    address,
    chainId: params.chainId,
    message,
    expiresAt: expiresAt.getTime()
  });

  return {
    challengeId,
    message,
    expiresAt: expiresAt.toISOString()
  };
}

/**
 * 校验 EIP-191 `personal_sign` 签名并签发会话 token。
 * challenge 无论成功与否都会删除；失败后需重新获取 challenge。
 * token 只在这里返回一次；浏览器路径由 `routes/auth.ts` 写入 HttpOnly Cookie。
 */
export async function verifyAuthChallenge(params: {
  challengeId: string;
  address: string;
  signature: string;
}): Promise<{
  address: `0x${string}`;
  sessionToken: string;
  expiresAt: string;
}> {
  const now = Date.now();
  pruneExpired(now);

  const challenge = challenges.get(params.challengeId);
  if (!challenge) {
    throw new AuthError('challenge_not_found', 400);
  }
  challenges.delete(params.challengeId);

  const address = normalizeAddress(params.address);
  if (address !== challenge.address) {
    throw new AuthError('address_mismatch', 400);
  }

  let valid = false;
  try {
    valid = await verifyMessage({
      address,
      message: challenge.message,
      signature: params.signature as `0x${string}`
    });
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new AuthError('invalid_signature', 401);
  }

  const sessionToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(now + SESSION_TTL_MS);
  setStoredSession(hashToken(sessionToken), {
    address,
    chainId: challenge.chainId,
    expiresAt: expiresAt.getTime()
  });

  return {
    address,
    sessionToken,
    expiresAt: expiresAt.toISOString()
  };
}

/** 从 `Authorization: Bearer <token>` 中提取 token；格式不符时返回 undefined。 */
export function getBearerToken(
  authorization: string | undefined
): string | undefined {
  if (!authorization) {
    return undefined;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || undefined;
}

/** 读取并校验会话；过期或不存在时返回 null。 */
export function getSessionFromToken(token: string): AuthSession | null {
  return getStoredSession(hashToken(token));
}

/** 注销会话；token 不存在时保持幂等。 */
export function revokeSession(token: string): void {
  deleteStoredSession(hashToken(token));
}
