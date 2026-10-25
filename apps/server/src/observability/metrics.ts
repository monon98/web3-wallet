/**
 * P4-4 进程内 Prometheus 指标登记表。
 *
 * 调用方：Fastify `onResponse`（HTTP 错误率 / 耗时）与上游客户端封装
 * （RPC / Etherscan / TronGrid / Esplora）。只保存计数、耗时和最近成败时间戳，
 * 不保存地址、URL、API Key、请求体或响应体；多实例部署时各实例独立，
 * 需在 Prometheus / 日志侧按 `instance` 聚合。
 */

export const UPSTREAM_PROVIDERS = [
  'rpc',
  'etherscan',
  'trongrid',
  'esplora'
] as const;

export type UpstreamProvider = (typeof UPSTREAM_PROVIDERS)[number];

export const UPSTREAM_ERROR_KINDS = [
  'http',
  'network',
  'timeout',
  'rate_limited',
  'invalid_response',
  'other'
] as const;

export type UpstreamErrorKind = (typeof UPSTREAM_ERROR_KINDS)[number];

export const RATE_LIMIT_SCOPES = ['auth', 'balances'] as const;

export type RateLimitScope = (typeof RATE_LIMIT_SCOPES)[number];

export type HttpMetricSnapshot = {
  method: string;
  route: string;
  statusCode: number;
  count: number;
  durationMsSum: number;
};

export type UpstreamMetricSnapshot = {
  requests: number;
  successes: number;
  errors: number;
  durationMsSum: number;
  errorKinds: Partial<Record<UpstreamErrorKind, number>>;
  rateLimited: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
};

export type MetricsSnapshot = {
  processStartedAt: number;
  http: {
    stats: HttpMetricSnapshot[];
    clientErrors: number;
    serverErrors: number;
  };
  rateLimitRejections: Partial<Record<RateLimitScope, number>>;
  upstream: Record<UpstreamProvider, UpstreamMetricSnapshot>;
};

type HttpStat = HttpMetricSnapshot;

type UpstreamStat = {
  requests: number;
  successes: number;
  errors: number;
  durationMsSum: number;
  errorKinds: Map<UpstreamErrorKind, number>;
  rateLimited: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
};

const httpStats = new Map<string, HttpStat>();
let httpClientErrors = 0;
let httpServerErrors = 0;

const upstreamStats = new Map<UpstreamProvider, UpstreamStat>();
const rateLimitRejections = new Map<RateLimitScope, number>();

const processStartedAt = Date.now();

function emptyUpstreamStat(): UpstreamStat {
  return {
    requests: 0,
    successes: 0,
    errors: 0,
    durationMsSum: 0,
    errorKinds: new Map(),
    rateLimited: 0
  };
}

function ensureUpstreamStat(provider: UpstreamProvider): UpstreamStat {
  const existing = upstreamStats.get(provider);
  if (existing) {
    return existing;
  }
  const created = emptyUpstreamStat();
  upstreamStats.set(provider, created);
  return created;
}

function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  return trimmed ? trimmed.slice(0, 200) : 'unmatched';
}

function toDurationMs(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** 记录一次 HTTP 响应；`route` 必须是 Fastify 路由模板，不能是原始 URL。 */
export function recordHttpRequest(params: {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}): void {
  const method = params.method.toUpperCase();
  const route = normalizeRoute(params.route);
  const statusCode = Math.trunc(params.statusCode);
  const key = `${method}\u0000${route}\u0000${statusCode}`;
  const existing = httpStats.get(key);

  if (existing) {
    existing.count += 1;
    existing.durationMsSum += toDurationMs(params.durationMs);
  } else {
    httpStats.set(key, {
      method,
      route,
      statusCode,
      count: 1,
      durationMsSum: toDurationMs(params.durationMs)
    });
  }

  if (statusCode >= 500) {
    httpServerErrors += 1;
  } else if (statusCode >= 400) {
    httpClientErrors += 1;
  }
}

/** 记录一次本地限流拒绝（auth / 余额查询），用于区分本地配额与上游限流。 */
export function recordRateLimitRejection(scope: RateLimitScope): void {
  rateLimitRejections.set(scope, (rateLimitRejections.get(scope) ?? 0) + 1);
}

/**
 * 包装一次上游调用并记录结果。
 *
 * 失败只记录经过分类的错误类型，不记录异常消息中的 URL / Key / 地址。
 */
export async function withUpstreamMetrics<T>(
  provider: UpstreamProvider,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();

  try {
    const value = await fn();
    const stat = ensureUpstreamStat(provider);
    stat.requests += 1;
    stat.successes += 1;
    stat.durationMsSum += toDurationMs(Date.now() - startedAt);
    stat.lastSuccessAt = Date.now();
    return value;
  } catch (error) {
    const kind = classifyUpstreamError(error);
    const stat = ensureUpstreamStat(provider);
    stat.requests += 1;
    stat.errors += 1;
    stat.durationMsSum += toDurationMs(Date.now() - startedAt);
    stat.errorKinds.set(kind, (stat.errorKinds.get(kind) ?? 0) + 1);
    if (kind === 'rate_limited') {
      stat.rateLimited += 1;
    }
    stat.lastFailureAt = Date.now();
    throw error;
  }
}

/**
 * 记录 HTTP 200 但业务响应明确提示限流的上游错误（目前用于 Etherscan
 * `NOTOK + rate limit` 响应）。请求本身的成功 / 失败计数不变。
 */
export function recordUpstreamRateLimited(provider: UpstreamProvider): void {
  const stat = ensureUpstreamStat(provider);
  stat.rateLimited += 1;
  stat.lastFailureAt = Date.now();
}

function classifyUpstreamError(error: unknown): UpstreamErrorKind {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';

  if (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    /timeout|timed out/i.test(message)
  ) {
    return 'timeout';
  }
  if (/rate[\s_-]?limit|http[_\s-]?429|\b429\b/i.test(message)) {
    return 'rate_limited';
  }
  if (
    /unreachable|fetch failed|econn|enotfound|eai_again|socket hang up|network/i.test(
      message
    )
  ) {
    return 'network';
  }
  if (
    /invalid.*(response|result|json|chain)|non_json|malformed|chain_mismatch|missing_response/i.test(
      message
    )
  ) {
    return 'invalid_response';
  }
  if (/http[\s_-]?\d{3}|http_error|upstream_http/i.test(message)) {
    return 'http';
  }
  return 'other';
}

/** 返回只读快照，供 Prometheus 文本渲染；不暴露可变 Map。 */
export function getMetricsSnapshot(): MetricsSnapshot {
  const upstream = {} as Record<UpstreamProvider, UpstreamMetricSnapshot>;

  for (const provider of UPSTREAM_PROVIDERS) {
    const stat = upstreamStats.get(provider) ?? emptyUpstreamStat();
    const errorKinds: Partial<Record<UpstreamErrorKind, number>> = {};
    for (const [kind, count] of stat.errorKinds) {
      errorKinds[kind] = count;
    }
    upstream[provider] = {
      requests: stat.requests,
      successes: stat.successes,
      errors: stat.errors,
      durationMsSum: stat.durationMsSum,
      errorKinds,
      rateLimited: stat.rateLimited,
      lastSuccessAt: stat.lastSuccessAt,
      lastFailureAt: stat.lastFailureAt
    };
  }

  const rateLimitSnapshot: Partial<Record<RateLimitScope, number>> = {};
  for (const [scope, count] of rateLimitRejections) {
    rateLimitSnapshot[scope] = count;
  }

  return {
    processStartedAt,
    http: {
      stats: [...httpStats.values()].map((stat) => ({ ...stat })),
      clientErrors: httpClientErrors,
      serverErrors: httpServerErrors
    },
    rateLimitRejections: rateLimitSnapshot,
    upstream
  };
}

/** 仅测试使用：清空进程内累计值，避免测试文件内用例互相影响。 */
export function resetMetricsForTests(): void {
  httpStats.clear();
  httpClientErrors = 0;
  httpServerErrors = 0;
  upstreamStats.clear();
  rateLimitRejections.clear();
}
