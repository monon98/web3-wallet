import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 启动时加载 `.env`（Node >= 20.12 内置 `process.loadEnvFile`，不引入 dotenv）。
 *
 * 查找顺序：当前工作目录 `.env` → 仓库根 `.env`
 * （`pnpm dev:server` 的 cwd 为 `apps/server`，根环境文件在 `../../.env`）。
 * `process.loadEnvFile` 不覆盖已存在的进程环境变量，因此 CI / 生产注入仍优先。
 * 本模块不输出任何变量值，避免密钥进入日志。
 */
function loadFirstExistingEnvFile(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env')
  ];

  for (const file of candidates) {
    if (!existsSync(file)) {
      continue;
    }
    try {
      process.loadEnvFile(file);
    } catch {
      // 解析失败不阻断启动；具体缺项由各网关返回 not_configured
    }
    return;
  }
}

loadFirstExistingEnvFile();
