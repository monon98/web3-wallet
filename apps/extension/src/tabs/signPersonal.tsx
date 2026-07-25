import '~/assets/style.css';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PendingPersonalSign } from '~/types';
import { RUNTIME_MSG_APPROVE_PERSONAL_SIGN, RUNTIME_MSG_REJECT_PERSONAL_SIGN } from '~lib/bridge/constants';
import { getPendingPersonalSign } from '~lib/bridge/personalSign/pendingPersonalSign';
import { extLogInfo } from '~lib/extensionLog';
import { formatPersonalSignPreview } from '~lib/vault/signing';

/**
 * **personal_sign** 口令弹窗：展示消息预览（UTF-8 / hex），提交口令后走 `RUNTIME_MSG_APPROVE_PERSONAL_SIGN`。
 * 成功时 background 已 `tabs.sendMessage` 给 DApp，本窗口仅 `windows.remove` 自身。
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

export default function SignPersonalPage() {
  const [pending, setPending] = useState<PendingPersonalSign | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getPendingPersonalSign().then(setPending);
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

  const preview = useMemo(() => {
    if (!pending) {
      return null;
    }
    return formatPersonalSignPreview(pending.messageHex);
  }, [pending]);

  const approve = useCallback(() => {
    setFormError(null);
    setBusy(true);
    if (pending) {
      extLogInfo('tab_approve_personal_sign', {
        requestId: pending.bridgeRequestId,
        origin: pending.origin
      });
    }
    chrome.runtime.sendMessage({ type: RUNTIME_MSG_APPROVE_PERSONAL_SIGN, password }, (resp: unknown) => {
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
      extLogInfo('tab_reject_personal_sign', {
        requestId: pending.bridgeRequestId,
        origin: pending.origin
      });
    }
    chrome.runtime.sendMessage({ type: RUNTIME_MSG_REJECT_PERSONAL_SIGN }, () => {
      void chrome.runtime.lastError;
      closeSelfWindow();
    });
  }, [pending]);

  return (
    <div className='box-border min-h-screen w-full p-4 text-left text-sm text-neutral-900 bg-white'>
      <h1 className='mb-2 text-base font-semibold'>签名请求（personal_sign）</h1>
      {!pending ? (
        <p className='text-neutral-600'>没有待处理的签名请求，可关闭本窗口。</p>
      ) : (
        <>
          <p className='mb-1 text-xs text-neutral-600'>来源</p>
          <p className='mb-3 break-all rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs'>
            {pending.origin}
          </p>
          <p className='mb-1 text-xs text-neutral-600'>签名地址</p>
          <p className='mb-3 break-all rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs'>
            {pending.signerAddress}
          </p>
          <p className='mb-1 text-xs font-medium text-neutral-800'>消息内容</p>
          <div className='mb-3 max-h-40 overflow-y-auto rounded border border-neutral-200 bg-neutral-50 p-2 text-xs'>
            {preview?.kind === 'utf8' ? (
              <pre className='whitespace-pre-wrap break-words font-sans'>{preview.text}</pre>
            ) : (
              <code className='break-all font-mono text-[11px]'>{preview?.short ?? pending.messageHex}</code>
            )}
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
