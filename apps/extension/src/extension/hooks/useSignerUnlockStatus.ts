import { useCallback, useEffect, useRef, useState } from 'react';

import type { UnlockStatus } from '~/types';
import { DEFAULT_UNLOCK_TTL_MINUTES } from '~lib/vault/unlockSettings';
import { fetchUnlockStatus } from '~lib/walletUi/unlockRuntime';

/**
 * 审批弹窗中的**签名地址解锁态**（P2-2）：每 10 秒从 background 刷新，
 * 过期或手动锁定后自动恢复口令输入；不直接接触解密账户。
 */

const LOCKED_STATUS: UnlockStatus = {
  unlocked: false,
  expiresAt: null,
  ttlMinutes: DEFAULT_UNLOCK_TTL_MINUTES
};

export function useSignerUnlockStatus(address: string | null): {
  status: UnlockStatus;
  refresh: () => void;
  setLocked: () => void;
} {
  const [status, setStatus] = useState<UnlockStatus>(LOCKED_STATUS);
  const requestSequence = useRef(0);

  const refresh = useCallback(() => {
    const sequence = ++requestSequence.current;
    if (!address) {
      setStatus(LOCKED_STATUS);
      return;
    }
    void fetchUnlockStatus(address).then((next) => {
      if (sequence === requestSequence.current) {
        setStatus(next ?? LOCKED_STATUS);
      }
    });
  }, [address]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => {
      requestSequence.current += 1;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const setLocked = useCallback(() => {
    requestSequence.current += 1;
    setStatus((prev) => ({ ...prev, unlocked: false, expiresAt: null }));
  }, []);

  return { status, refresh, setLocked };
}
