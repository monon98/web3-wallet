import { FieldLabel, PanelSection, TextInput, UiButton } from '@plugin/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { UnlockSummary } from '~/types';
import {
  DEFAULT_UNLOCK_TTL_MINUTES,
  loadUnlockTtlMinutes,
  MAX_UNLOCK_TTL_MINUTES,
  MIN_UNLOCK_TTL_MINUTES,
  saveUnlockTtlMinutes
} from '~lib/vault/unlockSettings';
import { fetchUnlockSummary, lockUnlockedAccounts } from '~lib/walletUi/unlockRuntime';

/**
 * **账户解锁安全区**（P2-2）：展示 background 内存中已解锁的地址与到期时间，
 * 允许修改空闲自动锁定 TTL、立即锁定全部账户。
 *
 * 仅处理公开地址和 TTL；口令与解密账户不会进入侧栏。
 */

function formatExpiry(value: number): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未知' : date.toLocaleString();
}

export function UnlockSessionSection() {
  const [summary, setSummary] = useState<UnlockSummary>({
    accounts: [],
    ttlMinutes: DEFAULT_UNLOCK_TTL_MINUTES
  });
  const [ttlInput, setTtlInput] = useState(String(DEFAULT_UNLOCK_TTL_MINUTES));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const refresh = useCallback(() => {
    const sequence = ++requestSequence.current;
    void fetchUnlockSummary().then((next) => {
      if (next && sequence === requestSequence.current) {
        setSummary(next);
      }
    });
  }, []);

  useEffect(() => {
    void loadUnlockTtlMinutes().then((minutes) => {
      setTtlInput(String(minutes));
    });
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      requestSequence.current += 1;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const saveTtl = useCallback(async () => {
    setNotice(null);
    const requested = Number(ttlInput);
    if (!Number.isInteger(requested) || requested < MIN_UNLOCK_TTL_MINUTES || requested > MAX_UNLOCK_TTL_MINUTES) {
      setNotice(`请输入 ${MIN_UNLOCK_TTL_MINUTES}–${MAX_UNLOCK_TTL_MINUTES} 的整数分钟。`);
      return;
    }
    setBusy(true);
    try {
      const next = await saveUnlockTtlMinutes(requested);
      setTtlInput(String(next));
      setSummary((prev) => ({ ...prev, ttlMinutes: next }));
      setNotice(`已保存：空闲 ${next} 分钟后自动锁定。`);
      refresh();
    } catch {
      setNotice('保存失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  }, [refresh, ttlInput]);

  const lockAll = useCallback(async () => {
    setNotice(null);
    setBusy(true);
    try {
      const ok = await lockUnlockedAccounts();
      setNotice(ok ? '已锁定全部账户。' : '锁定请求失败，请重试。');
      refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return (
    <PanelSection
      title='账户解锁'
      description='解锁态只保存在扩展后台内存，Service Worker 休眠或浏览器重启后自动清除；成功签名后重新计算空闲时间。'
      tone='muted'>
      <p className='mb-2 text-[11px] leading-snug text-[var(--ui-muted-fg)]'>
        当前已解锁 <strong className='text-[var(--ui-fg)]'>{summary.accounts.length}</strong> 个账户。
      </p>
      {summary.accounts.length > 0 ? (
        <ul className='mb-3 space-y-1 rounded border border-[var(--ui-border)] bg-[var(--ui-surface-2)] p-2'>
          {summary.accounts.map((item) => (
            <li key={item.address} className='break-all font-mono text-[10px] leading-snug text-[var(--ui-fg)]'>
              {item.address}
              <span className='ml-1 font-sans text-[var(--ui-muted-fg)]'>（{formatExpiry(item.expiresAt)} 前）</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className='mb-3 text-[11px] leading-snug text-[var(--ui-muted-fg)]'>
          当前没有已解锁账户；下次签名时输入一次账户口令即可建立解锁态。
        </p>
      )}

      <FieldLabel htmlFor='wallet-unlock-ttl' className='text-[var(--ui-fg)] opacity-100'>
        空闲自动锁定（分钟，{MIN_UNLOCK_TTL_MINUTES}–{MAX_UNLOCK_TTL_MINUTES}）
      </FieldLabel>
      <TextInput
        id='wallet-unlock-ttl'
        type='number'
        min={MIN_UNLOCK_TTL_MINUTES}
        max={MAX_UNLOCK_TTL_MINUTES}
        step={1}
        value={ttlInput}
        onChange={(e) => setTtlInput(e.target.value)}
        className='mb-2'
      />
      <div className='flex flex-wrap gap-2'>
        <UiButton variant='secondary' size='sm' disabled={busy} onClick={() => void saveTtl()}>
          保存解锁时长
        </UiButton>
        <UiButton
          variant='secondary'
          size='sm'
          disabled={busy || summary.accounts.length === 0}
          onClick={() => void lockAll()}>
          立即锁定全部
        </UiButton>
      </div>
      {notice ? <p className='mt-2 text-[11px] leading-snug text-[var(--ui-muted-fg)]'>{notice}</p> : null}
    </PanelSection>
  );
}
