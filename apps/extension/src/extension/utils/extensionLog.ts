/**
 * 扩展内 **开发态调试日志**（`console`）：生产构建（`NODE_ENV === 'production'`）下静默。
 *
 * **使用位置**：Service Worker（`background`，含 `side_panel_open` 等）、桥接模块、**隔离内容脚本**（`allUrls.ts`）、**MAIN 世界**（`inpageEvm.ts`，与页面共用控制台上下文时选扩展帧查看）。
 *
 * **禁止**传入或拼接：助记词、私钥、口令、`personal_sign` 原文、typed data 全量；可记录 `method`、`requestId`、**origin**、错误 code/message、**tabId**、**chainIdHex**、连接审批失败原因（如 `connect_approval_address` 的 `result` 枚举）、只读 RPC 失败摘要（`readonly_rpc_error`）、站点会话动作（`site_session` 的 `action` / `policy`）、`vault_bundle_coerce` 的计数、桥接拒绝 `reason` 枚举（`site_connect_blocked` / `personal_sign_blocked` / `typed_data_sign_blocked` / `bridge_handler_reject`）、`wallet_ui_pruned` 的 `reason` / `removedCount`、侧栏 `panel_action` 的 `action`（及断开站点时的 **origin**）、`side_panel_open_failed`、`approval_popup_create_failed` 的 `reason` / Chrome 错误摘要（**无**密钥材料）。
 */

const TAG = '[web3-wallet]';

/**
 * Plasmo / Parcel 在构建时写入 `process.env.NODE_ENV`；**生产包**为 `production` 时关闭全部 `extLog*`。
 * 少数运行环境可能无 `process`，`catch` 分支默认 **开启** 日志，便于本地未定义 `NODE_ENV` 时仍能排障。
 */
function devLogsEnabled(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return true;
  }
}

function emit(level: 'debug' | 'info' | 'warn', msg: string, extra?: Record<string, unknown>): void {
  if (!devLogsEnabled()) {
    return;
  }
  const line = extra !== undefined ? [TAG, msg, extra] : [TAG, msg];
  switch (level) {
    case 'debug':
      console.debug(...line);
      break;
    case 'info':
      console.info(...line);
      break;
    case 'warn':
      console.warn(...line);
      break;
    default:
      break;
  }
}

/** 高频或排障细节；生产环境不输出。 */
export function extLogDebug(msg: string, extra?: Record<string, unknown>): void {
  emit('debug', msg, extra);
}

/** 关键状态迁移（如进入 deferred、解析完成）。 */
export function extLogInfo(msg: string, extra?: Record<string, unknown>): void {
  emit('info', msg, extra);
}

/** 超时、解析失败、runtime 错误等可行动异常路径。 */
export function extLogWarn(msg: string, extra?: Record<string, unknown>): void {
  emit('warn', msg, extra);
}
