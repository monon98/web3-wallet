import {
  consumeRateLimit,
  parsePositiveInt,
  type RateLimitResult
} from '../security/rateLimit.js';

/**
 * 登录 challenge / verify 的匿名限流（按 IP，默认 20 次/分钟）。
 *
 * 目的：限制 challenge 内存增长与签名校验 CPU 滥用，不替代生产级 WAF / 网关限流。
 */
export function consumeAuthRateLimit(ip: string): RateLimitResult {
  const limit = parsePositiveInt(
    process.env.SERVER_AUTH_RATE_LIMIT_PER_MINUTE,
    20
  );
  return consumeRateLimit(`auth:${ip}`, limit);
}
