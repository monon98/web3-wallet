import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import {
  deleteStoredSession,
  getStoredSession,
  initializeSessionStore,
  setStoredSession
} from '../src/auth/sessionStore.js';

const ENV_KEYS = [
  'NODE_ENV',
  'SERVER_SESSION_STORE',
  'SERVER_SESSION_FILE'
] as const;

const HASH = 'a'.repeat(64);
const ADDRESS = '0x0000000000000000000000000000000000000001';

let tempDir = '';
let sessionFile = '';
let savedEnv: Record<string, string | undefined> = {};

function readFileSessions(): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(sessionFile, 'utf8')) as {
    version?: number;
    sessions?: Record<string, unknown>;
  };
  assert.equal(parsed.version, 1);
  return parsed.sessions ?? {};
}

before(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  tempDir = mkdtempSync(path.join(tmpdir(), 'wallet-session-'));
  sessionFile = path.join(tempDir, 'sessions.json');
  writeFileSync(
    sessionFile,
    JSON.stringify({
      version: 1,
      sessions: {
        [HASH]: {
          address: ADDRESS,
          chainId: 1,
          expiresAt: Date.now() + 60_000
        }
      }
    })
  );
  process.env.NODE_ENV = 'test';
  process.env.SERVER_SESSION_STORE = 'file';
  process.env.SERVER_SESSION_FILE = sessionFile;
});

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test('文件会话存储：启动加载、写入与删除', () => {
  initializeSessionStore();

  const loaded = getStoredSession(HASH);
  assert.equal(loaded?.address, ADDRESS);
  assert.equal(loaded?.chainId, 1);

  const anotherHash = 'b'.repeat(64);
  setStoredSession(anotherHash, {
    address: ADDRESS,
    chainId: 1,
    expiresAt: Date.now() + 60_000
  });
  let sessions = readFileSessions();
  assert.ok(sessions[HASH]);
  assert.ok(sessions[anotherHash]);

  deleteStoredSession(HASH);
  sessions = readFileSessions();
  assert.equal(sessions[HASH], undefined);
  assert.ok(sessions[anotherHash]);
});
