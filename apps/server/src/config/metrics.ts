/**
 * P4-4 运维指标配置。
 *
 * `SERVER_METRICS_TOKEN` 非空时启用 `GET /metrics`，并要求
 * `Authorization: Bearer <token>`；未配置时端点固定返回 404，避免默认暴露
 * 进程内部计数。token 只用于鉴权，不写入日志或指标标签。
 */
export function getMetricsToken(): string | undefined {
  const token = process.env.SERVER_METRICS_TOKEN?.trim();
  return token || undefined;
}
