/**
 * 浏览器可访问的 Fastify 基址（末尾无 `/`）。
 * - 若设置 `NEXT_PUBLIC_API_URL`，优先使用（生产必选）。
 * - 开发环境未设置时默认 `http://localhost:8787`（与 `SERVER_PORT=8787` 对齐），免本地再配一项。
 */
export function getPublicApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() ?? '';
  if (raw) {
    return raw.replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8787';
  }
  return '';
}
