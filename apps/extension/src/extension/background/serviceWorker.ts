import type { BridgeRequest } from '@plugin/shared';

import {
  RUNTIME_MSG_APPROVE_PERSONAL_SIGN,
  RUNTIME_MSG_APPROVE_SEND_TRANSACTION,
  RUNTIME_MSG_APPROVE_SITE_CONNECT,
  RUNTIME_MSG_APPROVE_TYPED_DATA_SIGN,
  RUNTIME_MSG_GET_UNLOCK_STATUS,
  RUNTIME_MSG_LOCK_UNLOCKED_ACCOUNTS,
  RUNTIME_MSG_REJECT_PERSONAL_SIGN,
  RUNTIME_MSG_REJECT_SEND_TRANSACTION,
  RUNTIME_MSG_REJECT_SITE_CONNECT,
  RUNTIME_MSG_REJECT_TYPED_DATA_SIGN,
  WEB3_WALLET_BRIDGE_RUNTIME_CHANNEL
} from '~lib/bridge/constants';
import { handleBridgeRequest } from '~lib/bridge/handleBridgeMessage';
import {
  approvePendingPersonalSignAndNotify,
  rejectPendingPersonalSignAndNotify
} from '~lib/bridge/personalSign/resolvePendingPersonalSign';
import {
  approvePendingSiteConnectAndNotify,
  rejectPendingSiteConnectAndNotify
} from '~lib/bridge/siteConnect/resolvePendingSiteConnect';
import {
  approvePendingSendTransactionAndNotify,
  rejectPendingSendTransactionAndNotify
} from '~lib/bridge/transaction/resolvePendingSendTransaction';
import {
  approvePendingTypedDataSignAndNotify,
  rejectPendingTypedDataSignAndNotify
} from '~lib/bridge/typedData/resolvePendingTypedDataSign';
import { maybeOpenOnboardingTab } from '~lib/extension/onboarding';
import { extLogDebug, extLogInfo, extLogWarn } from '~lib/extensionLog';
import { getUnlockStatus, getUnlockSummary, lockAllUnlockedAccounts } from '~lib/vault/unlockSession';
import { ensureWalletGlobalSettingsInitialized } from '~lib/walletUi/globalSettings';
import { revokeSiteAuthSessionsForTab } from '~lib/walletUi/walletUiState';

/**
 * Chrome MV3 **Service Worker** 实现（由根目录 `src/background.ts` 侧载，以满足 Plasmo 入口路径约定）。
 *
 * **职责**：侧栏与右键菜单；安装/升级时打开安全与使用指南；启动时初始化钱包 UI 状态与站点授权策略；接收两类 `runtime` 消息——
 * （1）连接/签名弹窗的批准或拒绝；（2）隔离内容脚本转发的 {@link BridgeRequest}（网页 DApp → `contents/allUrls` → 本处 → `handleBridgeRequest`）。
 *
 * **生命周期**：标签页关闭或**整页刷新**（非 iframe）时按 tab 撤销站点会话，避免残留授权。
 *
 * **安全**：不记录私钥/助记词/口令；解密后的 viem 账户仅在 background 内存缓存至解锁 TTL（P2-2），
 * 不落盘；签名仍须用户在每个审批弹窗确认（见 `vault/unlockSession` 与 `resolvePending*`）。
 *
 * 架构边界见 `docs/engineering/TECHNICAL-SOLUTION.md` 信任边界与扩展章节。
 */

/** MV3 service worker：右键菜单打开侧边栏（contextMenus 仅在此上下文可用） */

const MENU_ID = 'openSidePanel' as const;

/** 点击扩展图标时打开侧边栏（而非默认弹窗） */
function ensureSidePanelOpensOnActionClick(): void {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    void chrome.runtime.lastError;
  });
}

function ensureContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: MENU_ID,
        title: '打开侧边栏',
        contexts: ['all']
      },
      () => void chrome.runtime.lastError
    );
  });
}

/** 主框架整页刷新时撤销该 tab 的站点会话（防旧页面授权被新文档继承）。 */
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }
  if (details.transitionType !== 'reload') {
    return;
  }
  extLogDebug('tab_sessions_revoked', { reason: 'main_frame_reload', tabId: details.tabId });
  void revokeSiteAuthSessionsForTab(details.tabId);
});

/** 关闭标签即清理其站点会话。 */
chrome.tabs.onRemoved.addListener((tabId) => {
  extLogDebug('tab_sessions_revoked', { reason: 'tab_removed', tabId });
  void revokeSiteAuthSessionsForTab(tabId);
});

chrome.runtime.onInstalled.addListener((details) => {
  extLogInfo('sw_lifecycle', { event: 'installed', reason: details.reason });
  void ensureWalletGlobalSettingsInitialized();
  ensureSidePanelOpensOnActionClick();
  ensureContextMenu();

  // 首次安装 / 版本变化时打开安全与使用指南；同版本重载不重复弹页。
  void maybeOpenOnboardingTab(details)
    .then((opened) => {
      if (opened) {
        extLogInfo('sw_lifecycle', { event: 'onboarding_opened', reason: details.reason });
      }
    })
    .catch(() => {
      extLogWarn('sw_lifecycle', { event: 'onboarding_open_failed', reason: details.reason });
    });
});

chrome.runtime.onStartup.addListener(() => {
  extLogInfo('sw_lifecycle', { event: 'startup' });
  void ensureWalletGlobalSettingsInitialized();
  ensureSidePanelOpensOnActionClick();
  ensureContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || tab?.windowId === undefined) {
    return;
  }
  const windowId = tab.windowId;
  extLogDebug('side_panel_open', { source: 'context_menu', windowId });
  void chrome.sidePanel.open({ windowId }).catch(() => {
    extLogWarn('side_panel_open_failed', { source: 'context_menu', windowId });
  });
});

/**
 * `runtime` 消息入口：
 * - **弹窗 / 侧栏 → 后台**：`type` 为 `RUNTIME_MSG_*`，用于批准/拒绝挂起的连接或个人签名、typed data 签名（须 `return true` 异步 `sendResponse`）；日志前缀为 `runtime_*`。
 * - **隔离脚本 → 后台**：`channel === WEB3_WALLET_BRIDGE_RUNTIME_CHANNEL` 且含 `request: BridgeRequest`（见 `contents/allUrls.ts`）。
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && typeof message === 'object' && 'type' in message) {
    const t = (message as { type?: string }).type;
    // --- 站点连接弹窗结果 ---
    if (t === RUNTIME_MSG_APPROVE_SITE_CONNECT) {
      extLogInfo('runtime_approve_site_connect', { type: t });
      const raw = message as { selectedAddress?: string };
      const selected =
        typeof raw.selectedAddress === 'string' && raw.selectedAddress.trim() !== ''
          ? raw.selectedAddress.trim()
          : undefined;
      void approvePendingSiteConnectAndNotify(selected).then(sendResponse);
      return true;
    }
    if (t === RUNTIME_MSG_REJECT_SITE_CONNECT) {
      extLogInfo('runtime_reject_site_connect', { type: t });
      void rejectPendingSiteConnectAndNotify().then(sendResponse);
      return true;
    }
    // --- personal_sign 弹窗：口令解密签名 ---
    if (t === RUNTIME_MSG_APPROVE_PERSONAL_SIGN) {
      extLogInfo('runtime_approve_personal_sign', { type: t });
      const raw = message as { password?: string };
      const password = typeof raw.password === 'string' ? raw.password : '';
      void approvePendingPersonalSignAndNotify(password).then(sendResponse);
      return true;
    }
    if (t === RUNTIME_MSG_REJECT_PERSONAL_SIGN) {
      extLogInfo('runtime_reject_personal_sign', { type: t });
      void rejectPendingPersonalSignAndNotify().then(sendResponse);
      return true;
    }
    if (t === RUNTIME_MSG_APPROVE_TYPED_DATA_SIGN) {
      extLogInfo('runtime_approve_typed_data_sign', { type: t });
      const raw = message as { password?: string };
      const password = typeof raw.password === 'string' ? raw.password : '';
      void approvePendingTypedDataSignAndNotify(password).then(sendResponse);
      return true;
    }
    if (t === RUNTIME_MSG_REJECT_TYPED_DATA_SIGN) {
      extLogInfo('runtime_reject_typed_data_sign', { type: t });
      void rejectPendingTypedDataSignAndNotify().then(sendResponse);
      return true;
    }
    if (t === RUNTIME_MSG_APPROVE_SEND_TRANSACTION) {
      extLogInfo('runtime_approve_send_transaction', { type: t });
      const raw = message as { password?: string };
      const password = typeof raw.password === 'string' ? raw.password : '';
      void approvePendingSendTransactionAndNotify(password).then(sendResponse);
      return true;
    }
    if (t === RUNTIME_MSG_REJECT_SEND_TRANSACTION) {
      extLogInfo('runtime_reject_send_transaction', { type: t });
      void rejectPendingSendTransactionAndNotify().then(sendResponse);
      return true;
    }
    // --- 账户解锁态（P2-2）：审批弹窗按地址读取，侧栏读取全部摘要 ---
    if (t === RUNTIME_MSG_GET_UNLOCK_STATUS) {
      const raw = message as { address?: unknown };
      const address = typeof raw.address === 'string' && raw.address ? raw.address : null;
      const task = address ? getUnlockStatus(address) : getUnlockSummary();
      void task.then(sendResponse).catch(() => sendResponse(null));
      return true;
    }
    if (t === RUNTIME_MSG_LOCK_UNLOCKED_ACCOUNTS) {
      const removedCount = lockAllUnlockedAccounts();
      extLogInfo('unlock_session', { action: 'lock_all', removedCount });
      sendResponse({ ok: true });
      return false;
    }
  }

  // --- DApp bridge：EIP-1193 与高层 connect/disconnect 等 ---
  if (
    !message ||
    typeof message !== 'object' ||
    !('channel' in message) ||
    message.channel !== WEB3_WALLET_BRIDGE_RUNTIME_CHANNEL ||
    !('request' in message) ||
    !message.request ||
    typeof message.request !== 'object'
  ) {
    return false;
  }

  void (async () => {
    const req = message.request as BridgeRequest;
    extLogInfo('bridge_dispatch', { requestId: req.id, bridgeMethod: req.method });
    const out = await handleBridgeRequest(req, sender);
    if ('error' in out && out.error) {
      extLogInfo('bridge_out', {
        requestId: req.id,
        errorCode: out.error.code,
        errorMessage: out.error.message
      });
    } else if ('deferred' in out && out.deferred) {
      extLogInfo('bridge_out', { requestId: req.id, deferred: true });
    } else {
      extLogInfo('bridge_out', { requestId: req.id, deferred: false });
    }
    sendResponse(out);
  })();

  return true;
});
