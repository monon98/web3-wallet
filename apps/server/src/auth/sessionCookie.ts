import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * 会话 Cookie 的读写与属性（P4-5）。
 *
 * 调用链：`routes/auth.ts` 登录 / 注销时写入或清除；`sessionAuth.ts` 从请求读取。
 * 安全边界：Cookie 只放随机会话 token（HttpOnly），不放地址、私钥或助记词。
 * 部署：同站默认 `SameSite=Lax`；跨站部署需 `SERVER_COOKIE_SAMESITE=none` + HTTPS（secure）。
 */

export const SESSION_COOKIE_NAME = 'wallet_session';
export const CSRF_HEADER_NAME = 'x-csrf-token';

function resolveSameSite(): 'lax' | 'strict' | 'none' {
  const raw = process.env.SERVER_COOKIE_SAMESITE?.trim().toLowerCase();
  if (!raw) {
    return 'lax';
  }
  if (raw === 'lax' || raw === 'strict' || raw === 'none') {
    return raw;
  }
  throw new Error(
    `SERVER_COOKIE_SAMESITE 仅支持 lax / strict / none，当前为 ${raw}`
  );
}

function resolveSecure(): boolean {
  const raw = process.env.SERVER_COOKIE_SECURE?.trim().toLowerCase();
  if (raw) {
    if (raw === '1' || raw === 'true') {
      return true;
    }
    if (raw === '0' || raw === 'false') {
      return false;
    }
    throw new Error('SERVER_COOKIE_SECURE 仅支持 1 / 0 / true / false');
  }
  return process.env.NODE_ENV === 'production';
}

function buildCookieOptions(maxAgeSeconds?: number): CookieSerializeOptions {
  const sameSite = resolveSameSite();
  const secure = resolveSecure();
  if (sameSite === 'none' && !secure) {
    throw new Error(
      'SERVER_COOKIE_SAMESITE=none 必须同时启用 SERVER_COOKIE_SECURE（HTTPS）'
    );
  }
  return {
    path: '/',
    httpOnly: true,
    secure,
    sameSite,
    ...(maxAgeSeconds === undefined ? {} : { maxAge: maxAgeSeconds })
  };
}

/** 启动时校验 Cookie 配置，避免运行中才发现无效组合。 */
export function assertSessionCookieConfig(): void {
  buildCookieOptions();
}

/** 读取 Cookie 中的会话 token；无 Cookie 时返回 undefined。 */
export function getSessionCookieToken(
  request: FastifyRequest
): string | undefined {
  return request.cookies?.[SESSION_COOKIE_NAME]?.trim() || undefined;
}

/** 登录成功时写入 HttpOnly 会话 Cookie。 */
export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: string | number
): void {
  const expiresAtMs =
    typeof expiresAt === 'string' ? Date.parse(expiresAt) : expiresAt;
  const maxAge = Number.isFinite(expiresAtMs)
    ? Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
    : 0;
  reply.setCookie(SESSION_COOKIE_NAME, token, buildCookieOptions(maxAge));
}

/** 注销 / 无效会话时清除 Cookie。 */
export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, buildCookieOptions());
}
