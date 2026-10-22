import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';

/**
 * 登录会话存储（P4-5）。
 *
 * 调用链：`auth/authService.ts` 只通过本模块读写会话；`app.ts` 启动时初始化。
 * 安全边界：键为会话 token 的 SHA-256 摘要，文件不保存原始 token / 私钥 / 助记词。
 * 持久化：`SERVER_SESSION_STORE=file`（生产默认）使用原子替换写 JSON；多实例需共享 Redis / DB。
 */

export type StoredSession = {
  address: `0x${string}`;
  chainId: number;
  expiresAt: number;
};

type SessionFile = {
  version: 1;
  sessions: Record<string, StoredSession>;
};

const MAX_SESSIONS = 10_000;
const sessions = new Map<string, StoredSession>();
let loaded = false;

function resolveStoreMode(): 'memory' | 'file' {
  const raw = process.env.SERVER_SESSION_STORE?.trim().toLowerCase();
  if (raw === 'memory' || raw === 'file') {
    return raw;
  }
  return process.env.NODE_ENV === 'production' ? 'file' : 'memory';
}

function resolveSessionFilePath(): string | null {
  if (resolveStoreMode() !== 'file') {
    return null;
  }
  const raw = process.env.SERVER_SESSION_FILE?.trim();
  if (raw === '0') {
    return null;
  }
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }
  return path.resolve(process.cwd(), 'logs', 'sessions.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.address === 'string' &&
    /^0x[0-9a-fA-F]{40}$/.test(value.address) &&
    typeof value.chainId === 'number' &&
    Number.isInteger(value.chainId) &&
    value.chainId > 0 &&
    typeof value.expiresAt === 'number' &&
    Number.isFinite(value.expiresAt)
  );
}

function loadFromDisk(): void {
  const filePath = resolveSessionFilePath();
  if (!filePath || !existsSync(filePath)) {
    return;
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!isRecord(parsed) || !isRecord(parsed.sessions)) {
      throw new Error('invalid session file shape');
    }
    for (const [tokenHash, value] of Object.entries(parsed.sessions)) {
      if (isStoredSession(value)) {
        sessions.set(tokenHash, value);
      }
    }
  } catch (e) {
    // 文件损坏时从空会话启动，避免把原始错误内容（可能含地址）写进日志。
    console.warn(
      `[sessionStore] 无法读取会话文件 ${filePath}，将以空会话启动（${e instanceof Error ? e.name : 'unknown'}）`
    );
  }
}

function ensureLoaded(): void {
  if (loaded) {
    return;
  }
  loaded = true;
  loadFromDisk();
}

function persist(): void {
  const filePath = resolveSessionFilePath();
  if (!filePath) {
    return;
  }
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const payload: SessionFile = {
    version: 1,
    sessions: Object.fromEntries(sessions)
  };
  const tempPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(payload)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
  try {
    chmodSync(tempPath, 0o600);
  } catch {
    // Windows 等平台可能不支持 chmod；文件权限由运行目录控制。
  }
  renameSync(tempPath, filePath);
}

function prune(now: number): boolean {
  let changed = false;
  for (const [tokenHash, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(tokenHash);
      changed = true;
    }
  }
  return changed;
}

/** 启动时加载并校验持久化配置；文件模式下立即写入一次，避免运行中才发现不可写。 */
export function initializeSessionStore(): void {
  if (resolveStoreMode() === 'file' && !resolveSessionFilePath()) {
    throw new Error(
      'SERVER_SESSION_STORE=file 需要有效的 SERVER_SESSION_FILE（不能为 0）'
    );
  }
  ensureLoaded();
  prune(Date.now());
  if (resolveStoreMode() === 'file') {
    persist();
  }
}

/** 按 token 摘要读取会话；过期条目会被移除。 */
export function getStoredSession(tokenHash: string): StoredSession | null {
  ensureLoaded();
  const session = sessions.get(tokenHash);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    sessions.delete(tokenHash);
    persist();
    return null;
  }
  return session;
}

/** 写入会话，并在达到上限时淘汰最旧条目。 */
export function setStoredSession(
  tokenHash: string,
  session: StoredSession
): void {
  ensureLoaded();
  if (!sessions.has(tokenHash) && sessions.size >= MAX_SESSIONS) {
    prune(Date.now());
    if (sessions.size >= MAX_SESSIONS) {
      const oldest = sessions.keys().next().value;
      if (typeof oldest === 'string') {
        sessions.delete(oldest);
      }
    }
  }
  sessions.set(tokenHash, session);
  persist();
}

/** 删除会话；不存在时保持幂等。 */
export function deleteStoredSession(tokenHash: string): void {
  ensureLoaded();
  if (sessions.delete(tokenHash)) {
    persist();
  }
}

/** 清理过期会话；仅在确有删除时落盘。 */
export function pruneStoredSessions(now = Date.now()): void {
  ensureLoaded();
  if (prune(now)) {
    persist();
  }
}
