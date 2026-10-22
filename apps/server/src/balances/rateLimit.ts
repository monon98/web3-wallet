import { parsePositiveInt } from '../security/rateLimit.js';

/** 统一余额查询的默认限额（次/分钟）。 */
export function getBalanceRateLimits(): {
  anonymousPerMinute: number;
  sessionPerMinute: number;
} {
  return {
    anonymousPerMinute: parsePositiveInt(
      process.env.SERVER_BALANCE_RATE_LIMIT_PER_MINUTE,
      30
    ),
    sessionPerMinute: parsePositiveInt(
      process.env.SERVER_BALANCE_AUTH_RATE_LIMIT_PER_MINUTE,
      120
    )
  };
}
