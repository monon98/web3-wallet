import '~/assets/style.css';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PendingTypedDataSign } from '~/types';
import { RUNTIME_MSG_APPROVE_TYPED_DATA_SIGN, RUNTIME_MSG_REJECT_TYPED_DATA_SIGN } from '~lib/bridge/constants';
import { getPendingTypedDataSign } from '~lib/bridge/typedData/pendingTypedDataSign';
import { extLogInfo } from '~lib/extensionLog';

/**
 * **EIP-712** 口令弹窗：展示 `domain` 摘要与 `message` JSON，流程与 `signPersonal` 对称。
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

/** 将常见 EIP-712 domain 字段拼成可读多行，缺失时退回 `JSON.stringify`。 */
function domainSummary(domain: Record<string, unknown>): string {
  const parts: string[] = [];
  const name = domain.name;
  const version = domain.version;
  const chainId = domain.chainId;
  const verifyingContract = domain.verifyingContract;
  if (typeof name === 'string') {
    parts.push(`name: ${name}`);
  }
  if (typeof version === 'string') {
    parts.push(`version: ${version}`);
  }
  if (chainId !== undefined && chainId !== null) {
    parts.push(`chainId: ${String(chainId)}`);
  }
  if (typeof verifyingContract === 'string') {
    parts.push(`verifyingContract: ${verifyingContract}`);
  }
  return parts.length > 0 ? parts.join('\n') : JSON.stringify(domain, null, 2);
}

export default function SignTypedDataPage() {
  const [pending, setPending] = useState<PendingTypedDataSign | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getPendingTypedDataSign().then(setPending);
  }, []);

  useEffect(() => {
    refresh();
    const poll = window.setInterval(refresh, 600);
    const onStorage = (_c: unknown, area: string) => {
      if (area === 'session') {
        refresh();
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => {
      window.clearInterval(poll);
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, [refresh]);

  const messagePreview = useMemo(() => {
    if (!pending) {
      return '';
    }
    try {
      return JSON.stringify(pending.typedData.message, null, 2);
    } catch {
      return String(pending.typedData.message);
    }
  }, [pending]);

  const approve = useCallback(() => {
    setFormError(null);
    setBusy(true);
    if (pending) {
      extLogInfo('tab_approve_typed_data_sign', {
        requestId: pending.bridgeRequestId,
        origin: pending.origin
      });
    }
    chrome.runtime.sendMessage({ type: RUNTIME_MSG_APPROVE_TYPED_DATA_SIGN, password }, (resp: unknown) => {
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
      setFormError('无法完成签名。');
    });
  }, [password, pending]);

  const reject = useCallback(() => {
    if (pending) {
      extLogInfo('tab_reject_typed_data_sign', {
        requestId: pending.bridgeRequestId,
        origin: pending.origin
      });
    }
    chrome.runtime.sendMessage({ type: RUNTIME_MSG_REJECT_TYPED_DATA_SIGN }, () => {
      void chrome.runtime.lastError;
      closeSelfWindow();
    });
  }, [pending]);

  return (
    <div className='box-border min-h-screen w-full p-4 text-left text-sm text-neutral-900 bg-white'>
      <h1 className='mb-2 text-base font-semibold'>签名请求（EIP-712）</h1>
      {!pending ? (
        <p className='text-neutral-600'>没有待处理的签名请求，可关闭本窗口。</p>
      ) : (
        <>
          <p className='mb-1 text-xs text-amber-800'>
            站点请求对结构化数据（EIP-712）签名，常用于登录或链下授权。请确认 domain 与 message 与预期一致。
          </p>
          <p className='mb-1 text-xs text-neutral-600'>来源</p>
          <p className='mb-3 break-all rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs'>
            {pending.origin}
          </p>
          <p className='mb-1 text-xs text-neutral-600'>签名地址</p>
          <p className='mb-3 break-all rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs'>
            {pending.signerAddress}
          </p>
          <p className='mb-1 text-xs font-medium text-neutral-800'>Domain</p>
          <pre className='mb-3 max-h-28 overflow-y-auto whitespace-pre-wrap break-words rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-[11px]'>
            {domainSummary(pending.typedData.domain)}
          </pre>
          <p className='mb-1 text-xs font-medium text-neutral-800'>
            主类型 <span className='font-mono'>{pending.typedData.primaryType}</span>
          </p>
          <p className='mb-1 text-xs font-medium text-neutral-800'>Message</p>
          <pre className='mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-[11px]'>
            {messagePreview}
          </pre>
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
              {busy ? '签名中…' : '确认签名'}
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
