import '~/assets/style.css';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PendingSiteConnect, SiteAuthSettings, WalletAccountSummary, WalletConnectChoice } from '~/types';
import { RUNTIME_MSG_APPROVE_SITE_CONNECT, RUNTIME_MSG_REJECT_SITE_CONNECT } from '~lib/bridge/constants';
import { getPendingSiteConnect } from '~lib/bridge/siteConnect/pendingSiteConnect';
import { extLogInfo } from '~lib/extensionLog';
import { listWalletAccountSummaries } from '~lib/vault/record';
import { loadSiteAuthSettings, loadWalletUiState } from '~lib/walletUi/globalSettings';

/**
 * **站点连接**扩展弹窗（`siteConnect.html`）：展示 `origin`、授权策略说明与本地账户列表；
 * 用户确认后 `chrome.runtime.sendMessage` → `approvePendingSiteConnectAndNotify` / reject。
 * 定时拉取 `pendingSiteConnect` 与账户列表，以便与其它入口修改 storage 时保持同步。
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

export default function SiteConnectPage() {
  const [pending, setPending] = useState<PendingSiteConnect | null>(null);
  const [settings, setSettings] = useState<SiteAuthSettings | null>(null);
  const [accounts, setAccounts] = useState<WalletAccountSummary[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState('');

  const refresh = useCallback(() => {
    void getPendingSiteConnect().then(setPending);
  }, []);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const [list] = await Promise.all([listWalletAccountSummaries(), loadWalletUiState()]);
      setAccounts(list);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const choices: WalletConnectChoice[] = useMemo(() => {
    if (accounts.length === 0) {
      return [];
    }
    return accounts.map((a) => ({
      key: a.id,
      label: `${a.label} · ${a.address.slice(0, 6)}…${a.address.slice(-4)}`,
      address: a.address
    }));
  }, [accounts]);

  useEffect(() => {
    void loadSiteAuthSettings().then(setSettings);
    refresh();
    void loadAccounts();
    const poll = window.setInterval(() => {
      refresh();
      void loadAccounts();
    }, 600);
    const onStorage = (_c: unknown, area: string) => {
      if (area === 'session') {
        refresh();
      }
      if (area === 'local') {
        void loadAccounts();
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => {
      window.clearInterval(poll);
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, [refresh, loadAccounts]);

  useEffect(() => {
    if (choices.length === 0) {
      setSelectedAddress('');
      return;
    }
    setSelectedAddress((prev) => {
      if (prev && choices.some((c) => c.address.toLowerCase() === prev.toLowerCase())) {
        return prev;
      }
      return choices[0].address;
    });
  }, [choices]);

  const approve = () => {
    if (!selectedAddress) {
      return;
    }
    if (pending) {
      extLogInfo('tab_approve_site_connect', {
        requestId: pending.bridgeRequestId,
        origin: pending.origin
      });
    }
    chrome.runtime.sendMessage({ type: RUNTIME_MSG_APPROVE_SITE_CONNECT, selectedAddress }, () => {
      void chrome.runtime.lastError;
      closeSelfWindow();
    });
  };

  const reject = () => {
    if (pending) {
      extLogInfo('tab_reject_site_connect', {
        requestId: pending.bridgeRequestId,
        origin: pending.origin
      });
    }
    chrome.runtime.sendMessage({ type: RUNTIME_MSG_REJECT_SITE_CONNECT }, () => {
      void chrome.runtime.lastError;
      closeSelfWindow();
    });
  };

  const policyLabel =
    settings?.policy === 'persistent'
      ? '持久（在钱包中断开前一直有效）'
      : settings?.policy === 'timed'
        ? `定时（约 ${settings.timedMinutes} 分钟后失效）`
        : '当前标签（刷新页面或关闭标签后需重新连接）';

  return (
    <div className='box-border min-h-screen w-full bg-white p-4 text-left text-sm text-neutral-900'>
      <h1 className='mb-2 text-base font-semibold'>站点连接请求</h1>
      {!pending ? (
        <p className='text-neutral-600'>没有待处理的连接请求，可关闭本窗口。</p>
      ) : (
        <>
          <p className='mb-1 text-xs text-neutral-600'>来源</p>
          <p className='mb-3 break-all rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs'>
            {pending.origin}
          </p>
          <p className='mb-3 text-xs text-neutral-600'>
            授权策略：<span className='font-medium text-neutral-800'>{policyLabel}</span>
          </p>

          <p className='mb-1 text-xs font-medium text-neutral-800'>选择要授权的账户</p>
          {accountsLoading ? (
            <p className='mb-3 text-xs text-neutral-500'>正在加载账户列表…</p>
          ) : choices.length === 0 ? (
            <p className='mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950'>
              尚未导入任何账户。请打开扩展侧栏，在「账户列表」中添加助记词或私钥后，再回到本页刷新或重新发起连接。
            </p>
          ) : (
            <ul className='mb-3 max-h-40 overflow-y-auto rounded border border-neutral-200 p-1'>
              {choices.map((c) => (
                <li key={c.key} className='list-none'>
                  <label className='flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-neutral-50'>
                    <input
                      type='radio'
                      name='acc'
                      className='mt-0.5'
                      checked={selectedAddress.toLowerCase() === c.address.toLowerCase()}
                      onChange={() => setSelectedAddress(c.address)}
                    />
                    <span className='text-xs leading-snug'>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              disabled={!selectedAddress || choices.length === 0}
              className='cursor-pointer rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50'
              onClick={approve}>
              批准连接
            </button>
            <button
              type='button'
              className='cursor-pointer rounded-md bg-neutral-600 px-3 py-2 text-xs font-medium text-white'
              onClick={reject}>
              拒绝
            </button>
          </div>
        </>
      )}
    </div>
  );
}
