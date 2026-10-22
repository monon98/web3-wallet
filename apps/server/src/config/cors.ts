/**
 * CORS / 登录消息使用的 Web Origin 白名单。
 *
 * 安全边界：只允许显式配置的前端 Origin 跨域读取 API 响应；生产环境未配置时
 * 不返回任何 CORS 放行头。`*` *不是* 有效配置，避免把 Cookie / Bearer 会话暴露给任意站点。
 * 开发环境默认放行 Next 默认的 localhost:3000 / 127.0.0.1:3000。
 */

const DEV_DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000'
] as const;

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

function parseConfiguredOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const value = part.trim();
    if (!value || value === '*') {
      continue;
    }
    const normalized = normalizeOrigin(value);
    if (normalized) {
      seen.add(normalized);
    }
  }
  return [...seen];
}

/** 当前进程允许的浏览器 Origin；顺序稳定，供登录消息选择默认域名。 */
export function getCorsOrigins(): string[] {
  const configured = parseConfiguredOrigins(process.env.SERVER_CORS_ORIGINS);
  if (configured.length > 0) {
    return configured;
  }
  return process.env.NODE_ENV === 'production' ? [] : [...DEV_DEFAULT_ORIGINS];
}

/**
 * 判断请求 Origin 是否允许。
 *
 * 无 Origin 的请求（curl、服务端调用）不经过浏览器 CORS，直接放行；
 * 有 Origin 时必须命中白名单，避免恶意站点读取 challenge / 会话响应。
 */
export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  const normalized = normalizeOrigin(origin);
  return normalized ? getCorsOrigins().includes(normalized) : false;
}

/** challenge 消息在无 Origin 请求时使用的回退 URI。 */
export function getDefaultWebOrigin(): string {
  return getCorsOrigins()[0] ?? 'http://localhost:3000';
}
