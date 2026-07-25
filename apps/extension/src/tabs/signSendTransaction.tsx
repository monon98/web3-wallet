import '~/assets/style.css';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { EvmTxSubmitMode, PendingSendTransaction } from '~/types';
import { RUNTIME_MSG_APPROVE_SEND_TRANSACTION, RUNTIME_MSG_REJECT_SEND_TRANSACTION } from '~lib/bridge/constants';
import { getPendingSendTransaction } from '~lib/bridge/transaction/pendingSendTransaction';
import { extLogInfo } from '~lib/extensionLog';
import { loadWalletGlobalSettingsSnapshot } from '~lib/walletUi/globalSettings';

function isSignTransactionRpc(p: PendingSendTransaction | null): boolean {
  return p?.pendingTxRpcMethod === 'eth_signTransaction';
}

/**
 * **`eth_sendTransaction`** 口令弹窗：展示摘要；提交方式由侧栏全局「交易提交方式」决定（签名并广播或仅签名）。
 */

function closeSelfWindow(): void {
  chrome.windows.getCurrent((w) => {
    if (w.id !== undefined) {
      void chrome.windows.remove(w.id);
    } else {
      window.close();
    }
  });
}

function truncateHex(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max - 1)}…`;
}

function txPreviewLines(tx: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if (typeof tx.to === 'string') {
    lines.push(`to: ${tx.to}`);
  }
  if (tx.from !== undefined) {
    lines.push(`from: ${String(tx.from)}`);
  }
  if (tx.value !== undefined) {
    lines.push(`value: ${String(tx.value)}`);
  }
  if (tx.data !== undefined) {
    lines.push(`data: ${truncateHex(String(tx.data), 160)}`);
  }
  const gasSource = tx.gas ?? tx.gasLimit;
  if (gasSource !== undefined) {
    lines.push(`gas: ${String(gasSource)}`);
  }
  if (tx.gasPrice !== undefined) {
    lines.push(`gasPrice: ${String(tx.gasPrice)}`);
  }
  if (tx.maxFeePerGas !== undefined) {
    lines.push(`maxFeePerGas: ${String(tx.maxFeePerGas)}`);
  }
  if (tx.maxPriorityFeePerGas !== undefined) {
    lines.push(`maxPriorityFeePerGas: ${String(tx.maxPriorityFeePerGas)}`);
  }
  if (tx.nonce !== undefined) {
    lines.push(`nonce: ${String(tx.nonce)}`);
  }
  if (tx.chainId !== undefined) {
    lines.push(`chainId: ${String(tx.chainId)}`);
  }
  return lines;
}

export default function SignSendTransactionPage() {
  const [pending, setPending] = useState<PendingSendTransaction | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<EvmTxSubmitMode>('signAndBroadcast');

  const refresh = useCallback(() => {
    void getPendingSendTransaction().then(setPending);
  }, []);

  const refreshSubmitMode = useCallback(() => {
    void loadWalletGlobalSettingsSnapshot().then((snap) => setSubmitMode(snap.walletUi.evmTxSubmitMode));
  }, []);

  useEffect(() => {
    refresh();
    const poll = window.setInterval(refresh, 600);
    const onStorage = (_c: unknown, area: string) => {
      if (area === 'session') {
        refresh();
      }
      if (area === 'local') {
        refreshSubmitMode();
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    refreshSubmitMode();
    return () => {
      window.clearInterval(poll);
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, [refresh, refreshSubmitMode]);

  const previewLines = useMemo(() => {
    if (!pending) {
      return [];
    }
    return txPreviewLines(pending.transaction);
  }, [pending]);

  const approve = useCallback(() => {
    setFormError(null);
    setBusy(true);
    if (pending) {
      extLogInfo('tab_approve_send_transaction', {
        requestId: pending.bridgeRequestId,
        origin: pending.origin
      });
    }
    chrome.runtime.sendMessage({ type: RUNTIME_MSG_APPROVE_SEND_TRANSACTION, password }, (resp: unknown) => {
      setBusy(false);
      void chrome.runtime.lastError;
      if (resp && typeof resp === 'object' && 'ok' in resp && resp.ok === true) {
        closeSelfWindow();
        return;
      }
      if (
        resp &&
        typeof resp === 'object' &&
        'ok' in resp &&
        resp.ok === false &&
        'error' in resp &&
        typeof (resp as { error?: string }).error === 'string'
      ) {
        setFormError((resp as { error: string }).error);
        return;
      }
      setFormError('无法发送交易。');
    });
  }, [password, pending]);

  const reject = useCallback(() => {
    if (pending) {
      extLogInfo('tab_reject_send_transaction', {
        requestId: pending.bridgeRequestId,
        origin: pending.origin
      });
    }
    chrome.runtime.sendMessage({ type: RUNTIME_MSG_REJECT_SEND_TRANSACTION }, () => {
      void chrome.runtime.lastError;
      closeSelfWindow();
    });
  }, [pending]);

  return (
    <div className='box-border min-h-screen w-full p-4 text-left text-sm text-neutral-900 bg-white'>
      <h1 className='mb-2 text-base font-semibold'>
        {pending && isSignTransactionRpc(pending)
          ? '签名交易（eth_signTransaction）'
          : '发送交易（eth_sendTransaction）'}
      </h1>
      {pending && isSignTransactionRpc(pending) ? (
        <p className='mb-3 rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px] leading-snug text-neutral-700'>
          本请求为 <strong className='font-medium'>仅签名</strong>
          ：批准后向页面返回已签名 RLP（不受侧栏全局「交易提交方式」影响）。
        </p>
      ) : (
        <p className='mb-3 rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px] leading-snug text-neutral-700'>
          当前全局提交方式：
          <strong className='font-medium'>
            {submitMode === 'signOnly' ? '仅签名（向页面返回 RLP，不广播）' : '签名并广播（向页面返回交易哈希）'}
          </strong>
          。可在扩展侧栏 → 概览 →「DApp 交易提交方式」中切换。
        </p>
      )}
      {!pending ? (
        <p className='text-neutral-600'>没有待处理的交易请求，可关闭本窗口。</p>
      ) : (
        <>
          <p className='mb-1 text-xs text-neutral-600'>来源</p>
          <p className='mb-3 break-all rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs'>
            {pending.origin}
          </p>
          <p className='mb-1 text-xs text-neutral-600'>发起地址</p>
          <p className='mb-3 break-all rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs'>
            {pending.signerAddress}
          </p>
          <p className='mb-1 text-xs font-medium text-neutral-800'>交易摘要</p>
          <div className='mb-3 max-h-48 overflow-y-auto rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-[11px] leading-relaxed'>
            {previewLines.map((line, idx) => (
              <div key={`${idx}-${line.slice(0, 48)}`} className='break-all'>
                {line}
              </div>
            ))}
          </div>
          <p className='mb-1 text-xs font-medium text-neutral-800'>账户加密口令</p>
          <input
            type='password'
            autoComplete='current-password'
            className='mb-3 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='导入账户时设置的口令'
          />
          {formError ? <p className='mb-2 text-xs text-red-700'>{formError}</p> : null}
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              disabled={busy || password.length === 0}
              className='cursor-pointer rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50'
              onClick={approve}>
              {busy
                ? pending && isSignTransactionRpc(pending)
                  ? '签名中…'
                  : '发送中…'
                : pending && isSignTransactionRpc(pending)
                  ? '确认签名'
                  : '确认发送'}
            </button>
            <button
              type='button'
              disabled={busy}
              className='cursor-pointer rounded-md bg-neutral-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50'
              onClick={reject}>
              拒绝
            </button>
          </div>
        </>
      )}
    </div>
  );
}
