import { mkdirSync } from 'node:fs';
import path from 'node:path';
import pino from 'pino';

const PRETTY_ENV = process.env.LOG_PRETTY;

function usePrettyTransport(): boolean {
  if (PRETTY_ENV === '0' || PRETTY_ENV === 'false') {
    return false;
  }
  if (PRETTY_ENV === '1' || PRETTY_ENV === 'true') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}

/**
 * 文件日志路径；`LOG_TO_FILE=0` / `false` 关闭；`LOG_FILE` 可设绝对或相对 cwd 的路径。
 */
function resolveLogFilePath(): string | null {
  const off = process.env.LOG_TO_FILE?.trim();
  if (off === '0' || off === 'false') {
    return null;
  }
  const raw = process.env.LOG_FILE?.trim();
  if (raw === '' || raw === '0') {
    return null;
  }
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }
  return path.resolve(process.cwd(), 'logs', 'server.log');
}

function ensureDirForFile(filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * 服务端根 logger（Fastify 与进程级 fatal 共用）。
 * 勿在日志中输出 RPC URL、API Key、Authorization 等敏感字段。
 *
 * - 开发默认：控制台 pino-pretty + `logs/server.log`（每行一条 JSON，便于 grep）。
 * - 生产：控制台 JSON + 同文件（可用 `LOG_TO_FILE` 关闭文件）。
 */
export function createRootLogger(): pino.Logger {
  const level =
    process.env.LOG_LEVEL?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

  const logFilePath = resolveLogFilePath();
  if (logFilePath) {
    ensureDirForFile(logFilePath);
  }

  const base: pino.LoggerOptions = {
    level,
    base: { service: '@plugin/server' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        "req.headers['x-csrf-token']",
        'err.config.url',
        'err.config.headers.authorization',
        'err.request.url',
        'err.request.headers.authorization',
        '*.authorization',
        '*.password',
        '*.secret',
        '*.apiKey',
        '*.api_key',
        '*.token',
        '*.csrfToken',
        '*.accessToken',
        '*.refreshToken',
        '*.privateKey',
        '*.mnemonic',
        '*.signature',
        '*.rawTransaction',
        '*.signedTransaction',
        '*.url'
      ],
      remove: true
    },
    // 若某处仍序列化整段 req，避免刷屏（与 Fastify 默认相比更短）。
    serializers: {
      req(req: { method?: string; url?: string }) {
        return { method: req.method, url: req.url };
      },
      res(res: { statusCode?: number }) {
        return { statusCode: res.statusCode };
      }
    }
  };

  if (usePrettyTransport()) {
    if (logFilePath) {
      const transport = pino.transport({
        targets: [
          {
            target: 'pino-pretty',
            level,
            options: {
              sync: true,
              colorize: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname,service',
              singleLine: true
            }
          },
          {
            target: 'pino/file',
            level,
            options: { destination: logFilePath }
          }
        ]
      });
      return pino(base, transport);
    }
    return pino({
      ...base,
      transport: {
        target: 'pino-pretty',
        options: {
          sync: true,
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,service',
          singleLine: true
        }
      }
    });
  }

  if (logFilePath) {
    return pino(
      base,
      pino.multistream([
        { level, stream: process.stdout },
        { level, stream: pino.destination({ dest: logFilePath, sync: false }) }
      ])
    );
  }

  return pino(base);
}
