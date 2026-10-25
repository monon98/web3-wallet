import {
  getMetricsSnapshot,
  RATE_LIMIT_SCOPES,
  UPSTREAM_ERROR_KINDS,
  UPSTREAM_PROVIDERS,
  type UpstreamProvider
} from './metrics.js';

/**
 * P4-4 Prometheus text format (version 0.0.4) 渲染。
 *
 * 指标只含稳定标签（路由模板 / 方法 / 状态码 / 上游名），不含地址、
 * RPC URL、API Key 或请求内容。数据来自 `metrics.ts` 的只读快照。
 */

export type MetricsContext = {
  /** 上游是否已配置（RPC / Etherscan 需要环境变量；TronGrid / Esplora 有默认地址）。 */
  configured?: Partial<Record<UpstreamProvider, boolean>>;
  /** 上游冷却剩余时间；目前仅 Etherscan 使用。 */
  cooldownRemainingMs?: Partial<Record<UpstreamProvider, number>>;
};

function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function addMetric(
  lines: string[],
  name: string,
  type: 'counter' | 'gauge' | 'summary',
  help: string,
  samples: string[]
): void {
  lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`, ...samples);
}

export function renderPrometheusMetrics(context: MetricsContext = {}): string {
  const snapshot = getMetricsSnapshot();
  const lines: string[] = [];

  addMetric(
    lines,
    'web3_wallet_process_start_time_seconds',
    'gauge',
    'Process start time as Unix timestamp in seconds.',
    [
      `web3_wallet_process_start_time_seconds ${formatNumber(
        snapshot.processStartedAt / 1000
      )}`
    ]
  );
  addMetric(
    lines,
    'web3_wallet_process_uptime_seconds',
    'gauge',
    'Process uptime in seconds.',
    [
      `web3_wallet_process_uptime_seconds ${formatNumber(
        Math.max(0, Date.now() - snapshot.processStartedAt) / 1000
      )}`
    ]
  );

  const httpSamples: string[] = [];
  const httpDurationSamples: string[] = [];
  const durationByRoute = new Map<
    string,
    { method: string; route: string; sum: number; count: number }
  >();

  const sortedHttp = [...snapshot.http.stats].sort((a, b) => {
    return (
      a.method.localeCompare(b.method) ||
      a.route.localeCompare(b.route) ||
      a.statusCode - b.statusCode
    );
  });

  for (const stat of sortedHttp) {
    const labels = `method="${escapeLabel(stat.method)}",route="${escapeLabel(
      stat.route
    )}",status="${stat.statusCode}"`;
    httpSamples.push(
      `web3_wallet_http_requests_total{${labels}} ${stat.count}`
    );

    const key = `${stat.method}\u0000${stat.route}`;
    const duration = durationByRoute.get(key);
    if (duration) {
      duration.sum += stat.durationMsSum;
      duration.count += stat.count;
    } else {
      durationByRoute.set(key, {
        method: stat.method,
        route: stat.route,
        sum: stat.durationMsSum,
        count: stat.count
      });
    }
  }

  for (const duration of durationByRoute.values()) {
    const labels = `method="${escapeLabel(
      duration.method
    )}",route="${escapeLabel(duration.route)}"`;
    httpDurationSamples.push(
      `web3_wallet_http_request_duration_ms_sum{${labels}} ${formatNumber(
        duration.sum
      )}`,
      `web3_wallet_http_request_duration_ms_count{${labels}} ${duration.count}`
    );
  }

  addMetric(
    lines,
    'web3_wallet_http_requests_total',
    'counter',
    'HTTP responses by method, route template and status code.',
    httpSamples
  );
  addMetric(
    lines,
    'web3_wallet_http_request_duration_ms',
    'summary',
    'HTTP response time in milliseconds by method and route template.',
    httpDurationSamples
  );
  addMetric(
    lines,
    'web3_wallet_http_errors_total',
    'counter',
    'HTTP 4xx and 5xx responses.',
    [
      `web3_wallet_http_errors_total{status_class="4xx"} ${snapshot.http.clientErrors}`,
      `web3_wallet_http_errors_total{status_class="5xx"} ${snapshot.http.serverErrors}`
    ]
  );

  const rateLimitSamples = RATE_LIMIT_SCOPES.map(
    (scope) =>
      `web3_wallet_rate_limit_rejections_total{scope="${scope}"} ${
        snapshot.rateLimitRejections[scope] ?? 0
      }`
  );
  addMetric(
    lines,
    'web3_wallet_rate_limit_rejections_total',
    'counter',
    'Requests rejected by the local fixed-window rate limiter.',
    rateLimitSamples
  );

  const upstreamRequestSamples: string[] = [];
  const upstreamErrorSamples: string[] = [];
  const upstreamRateLimitSamples: string[] = [];
  const upstreamDurationSamples: string[] = [];
  const upstreamLastSuccessSamples: string[] = [];
  const upstreamLastFailureSamples: string[] = [];
  const upstreamConfiguredSamples: string[] = [];
  const upstreamCooldownSamples: string[] = [];

  for (const provider of UPSTREAM_PROVIDERS) {
    const stat = snapshot.upstream[provider];
    const providerLabel = `provider="${provider}"`;

    upstreamRequestSamples.push(
      `web3_wallet_upstream_requests_total{${providerLabel},outcome="success"} ${stat.successes}`,
      `web3_wallet_upstream_requests_total{${providerLabel},outcome="error"} ${stat.errors}`
    );

    for (const kind of UPSTREAM_ERROR_KINDS) {
      const count = stat.errorKinds[kind] ?? 0;
      if (count > 0) {
        upstreamErrorSamples.push(
          `web3_wallet_upstream_errors_total{${providerLabel},kind="${kind}"} ${count}`
        );
      }
    }

    upstreamRateLimitSamples.push(
      `web3_wallet_upstream_rate_limited_total{${providerLabel}} ${stat.rateLimited}`
    );
    upstreamDurationSamples.push(
      `web3_wallet_upstream_duration_ms_sum{${providerLabel}} ${formatNumber(
        stat.durationMsSum
      )}`,
      `web3_wallet_upstream_duration_ms_count{${providerLabel}} ${stat.requests}`
    );

    if (stat.lastSuccessAt !== undefined) {
      upstreamLastSuccessSamples.push(
        `web3_wallet_upstream_last_success_timestamp_seconds{${providerLabel}} ${formatNumber(
          stat.lastSuccessAt / 1000
        )}`
      );
    }
    if (stat.lastFailureAt !== undefined) {
      upstreamLastFailureSamples.push(
        `web3_wallet_upstream_last_failure_timestamp_seconds{${providerLabel}} ${formatNumber(
          stat.lastFailureAt / 1000
        )}`
      );
    }

    upstreamConfiguredSamples.push(
      `web3_wallet_upstream_configured{${providerLabel}} ${
        context.configured?.[provider] ? 1 : 0
      }`
    );
    upstreamCooldownSamples.push(
      `web3_wallet_upstream_cooldown_remaining_seconds{${providerLabel}} ${formatNumber(
        Math.max(0, context.cooldownRemainingMs?.[provider] ?? 0) / 1000
      )}`
    );
  }

  addMetric(
    lines,
    'web3_wallet_upstream_requests_total',
    'counter',
    'Upstream calls by provider and outcome.',
    upstreamRequestSamples
  );
  addMetric(
    lines,
    'web3_wallet_upstream_errors_total',
    'counter',
    'Failed upstream calls by provider and classified error kind.',
    upstreamErrorSamples
  );
  addMetric(
    lines,
    'web3_wallet_upstream_rate_limited_total',
    'counter',
    'Upstream rate-limit signals, including HTTP 429 and provider envelope errors.',
    upstreamRateLimitSamples
  );
  addMetric(
    lines,
    'web3_wallet_upstream_duration_ms',
    'summary',
    'Upstream call duration in milliseconds by provider.',
    upstreamDurationSamples
  );
  addMetric(
    lines,
    'web3_wallet_upstream_last_success_timestamp_seconds',
    'gauge',
    'Unix timestamp of the last successful upstream call by provider.',
    upstreamLastSuccessSamples
  );
  addMetric(
    lines,
    'web3_wallet_upstream_last_failure_timestamp_seconds',
    'gauge',
    'Unix timestamp of the last failed or rate-limited upstream call by provider.',
    upstreamLastFailureSamples
  );
  addMetric(
    lines,
    'web3_wallet_upstream_configured',
    'gauge',
    'Whether the upstream has the required configuration (1) or not (0).',
    upstreamConfiguredSamples
  );
  addMetric(
    lines,
    'web3_wallet_upstream_cooldown_remaining_seconds',
    'gauge',
    'Remaining upstream cooldown in seconds.',
    upstreamCooldownSamples
  );

  return `${lines.join('\n')}\n`;
}
