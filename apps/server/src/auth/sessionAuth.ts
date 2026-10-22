import type { FastifyRequest } from 'fastify';

import {
  getBearerToken,
  getSessionFromToken,
  type AuthSession
} from './authService.js';
import { createCsrfToken, isValidCsrfToken } from './csrf.js';
import { CSRF_HEADER_NAME, getSessionCookieToken } from './sessionCookie.js';

/**
 * 统一解析请求会话（P4-5）。
 *
 * 调用链：`routes/auth.ts`、`routes/tx.ts`、`routes/balances.ts`。
 * 优先级：HttpOnly Cookie（浏览器）→ `Authorization: Bearer`（API 客户端 / 兼容旧调用）。
 * 安全边界：只返回公开地址、链 ID 与过期时间；CSRF 只对 Cookie 会话生效。
 */

export type SessionSource = 'cookie' | 'bearer';

export type RequestAuth = {
  session: AuthSession;
  token: string;
  source: SessionSource;
};

/** 读取并校验当前请求的会话；Cookie 无效时回退到 Bearer。 */
export function getRequestAuth(request: FastifyRequest): RequestAuth | null {
  const cookieToken = getSessionCookieToken(request);
  if (cookieToken) {
    const session = getSessionFromToken(cookieToken);
    if (session) {
      return { session, token: cookieToken, source: 'cookie' };
    }
  }

  const bearerToken = getBearerToken(request.headers.authorization);
  if (bearerToken) {
    const session = getSessionFromToken(bearerToken);
    if (session) {
      return { session, token: bearerToken, source: 'bearer' };
    }
  }

  return null;
}

/** Cookie 会话必须携带与 token 绑定的 CSRF 头；Bearer 会话不走 CSRF。 */
export function hasValidCsrf(
  request: FastifyRequest,
  auth: RequestAuth
): boolean {
  if (auth.source === 'bearer') {
    return true;
  }
  const header = request.headers[CSRF_HEADER_NAME];
  if (typeof header !== 'string') {
    return false;
  }
  return isValidCsrfToken(auth.token, header.trim());
}

/** 为 Cookie 会话返回可下发给前端的 CSRF token；Bearer 客户端无需。 */
export function csrfTokenFor(auth: RequestAuth): string | undefined {
  return auth.source === 'cookie' ? createCsrfToken(auth.token) : undefined;
}
