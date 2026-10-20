import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getAddress, isAddress, verifyMessage } from 'viem';

/**
 * 登录 challenge / 会话存储（MVP，进程内存）。
 *
 * 调用链：`routes/auth.ts` → 本模块；`routes/tx.ts` 通过 `getSessionFromToken` 复用会话。
 * 安全边界：只保存地址、链 ID、消息与过期时间；**不保存私钥 / 助记词 / 签名**。
 * 生产化：内存 Map 在重启后失效，且多实例不共享；后续应替换为 Redis / DB，并加限流。
 */

const CHALLENGE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 24 * 60 * 60_000;
const MAX_CHALLENGES = 10_000;
const MAX_SESSIONS = 10_000;

type ChallengeRecord = {
  address: `0x${string}`;
  chainId: number;
  message: string;
  expiresAt: number;
};

export type AuthSession = {
  address: `0x${string}`;
  chainId: number;
  expiresAt: number;
};

const challenges = new Map<string, ChallengeRecord>();
const sessions = new Map<string, AuthSession>();

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
  for (const [tokenHash, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(tokenHash);
    }
  }
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
  if (origin) {
    try {
      const url = new URL(origin);
      return { domain: url.host, uri: origin };
    } catch {
      // 非法 Origin 不应影响 challenge 生成；回退到本地默认值。
    }
  }
  return { domain: 'localhost:3000', uri: 'http://localhost:3000' };
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
 * 校验 EIP-191 `personal_sign` 签名并签发 Bearer 会话 token。
 * challenge 无论成功与否都会删除；失败后需重新获取 challenge。
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

  if (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (typeof oldest === 'string') {
      sessions.delete(oldest);
    }
  }

  const sessionToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(now + SESSION_TTL_MS);
  sessions.set(hashToken(sessionToken), {
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
  const now = Date.now();
  pruneExpired(now);
  const session = sessions.get(hashToken(token));
  if (!session) {
    return null;
  }
  if (session.expiresAt <= now) {
    sessions.delete(hashToken(token));
    return null;
  }
  return session;
}

/** 注销会话；token 不存在时保持幂等。 */
export function revokeSession(token: string): void {
  sessions.delete(hashToken(token));
}
