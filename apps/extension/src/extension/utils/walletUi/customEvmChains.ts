import { WALLET_BUILTIN_EVM_CHAINS } from '@plugin/shared';
import type { Chain } from 'viem/chains';

import type { CustomEvmChain } from '~/types';
import { extLogWarn } from '~lib/extensionLog';
import { defineChain } from '~web3/evm/viem';

/**
 * **自定义 EVM 网络存储与校验**（P2-3）。
 *
 * - 持久化键：`chrome.storage.local['web3_wallet_custom_evm_chains_v1']`；
 * - 读取入口给 background 的只读 RPC / 交易路径和侧栏网络设置共用；
 * - 内置链以 `@plugin/shared` 的 `WALLET_BUILTIN_EVM_CHAINS` 为准，不允许被自定义项覆盖；
 * - RPC URL 可能含节点访问 key，禁止写入日志；对外错误信息也不拼接完整 URL；
 * - 自定义链是**用户显式配置**的信任决策。DApp 不能通过 `wallet_addEthereumChain` 自动写入
 *   （见 `handleBridgeMessage.ts`），避免恶意页面把请求切到未确认的 RPC。
 */

/** 自定义链列表的本地存储键；侧栏与 background 变更监听需与此一致。 */
export const CUSTOM_EVM_CHAINS_STORAGE_KEY = 'web3_wallet_custom_evm_chains_v1' as const;

/** 自定义链数量上限；避免侧栏 / 存储被无限追加。 */
export const MAX_CUSTOM_EVM_CHAINS = 20;
export const MAX_CUSTOM_EVM_CHAIN_NAME_LENGTH = 64;
export const MAX_CUSTOM_EVM_CHAIN_SYMBOL_LENGTH = 16;
export const MAX_CUSTOM_EVM_CHAIN_RPC_URL_LENGTH = 2048;

const RPC_VALIDATION_TIMEOUT_MS = 8_000;
const MAX_RPC_RESPONSE_CHARS = 1_000_000;

const BUILTIN_CHAIN_IDS: ReadonlySet<number> = new Set(WALLET_BUILTIN_EVM_CHAINS.map((chain) => chain.id));

/** 表单草稿（字段均为字符串，便于直接绑定输入框）。 */
export type CustomEvmChainDraft = {
  chainIdInput: string;
  name: string;
  nativeSymbol: string;
  rpcUrl: string;
};

export type CustomEvmChainDraftValidation = { ok: true; chain: CustomEvmChain } | { ok: false; message: string };

export type CustomEvmChainRpcValidation = { ok: true } | { ok: false; message: string };

/**
 * 解析用户输入的 chainId：支持十进制或 `0x` 十六进制。
 * 必须是安全正整数；超过 `Number.MAX_SAFE_INTEGER` 的链 ID 无法安全交给 viem。
 */
export function parseCustomEvmChainIdInput(raw: string): number | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const value = raw.trim();
  if (value === '') {
    return null;
  }
  let parsed: bigint;
  try {
    if (/^0x[0-9a-f]+$/i.test(value)) {
      parsed = BigInt(value);
    } else if (/^[0-9]+$/.test(value)) {
      parsed = BigInt(value);
    } else {
      return null;
    }
  } catch {
    return null;
  }
  if (parsed <= 0n) {
    return null;
  }
  const chainId = Number(parsed);
  return Number.isSafeInteger(chainId) ? chainId : null;
}

/** 将十进制 chainId 转成 EIP-155 十六进制（不带前导零）。 */
export function customEvmChainIdToHex(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}` as `0x${string}`;
}

/** 解析 `eth_chainId` 风格的十六进制字符串；用于查找自定义链。 */
export function customEvmChainIdFromHex(chainIdHex: string): number | null {
  if (typeof chainIdHex !== 'string' || !/^0x[0-9a-f]+$/i.test(chainIdHex.trim())) {
    return null;
  }
  try {
    const value = Number(BigInt(chainIdHex.trim()));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function normalizeText(raw: unknown, maxLength: number): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value === '' || value.length > maxLength) {
    return null;
  }
  return value;
}

function isLocalHttpHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * 规范化并校验 RPC URL：
 * - 仅 HTTPS；为本地开发允许 `http://localhost` / `http://127.0.0.1`（与 manifest host_permissions 对齐）；
 * - 拒绝 URL 内嵌用户名 / 密码和 fragment；允许 path / query（节点 key 通常放在 query）。
 */
export function normalizeCustomEvmChainRpcUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const input = raw.trim();
  if (input === '' || input.length > MAX_CUSTOM_EVM_CHAIN_RPC_URL_LENGTH) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.username !== '' || url.password !== '' || input.includes('#') || url.hash !== '') {
    return null;
  }
  const protocol = url.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') {
    return null;
  }
  if (protocol === 'http:' && !isLocalHttpHost(url.hostname)) {
    return null;
  }
  return url.toString();
}

/**
 * 把存储中的原始对象收敛成 `CustomEvmChain`；任一项不合法即整条丢弃。
 * 该函数不访问网络，供读取与保存共用。
 */
function normalizeCustomEvmChain(raw: unknown): CustomEvmChain | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const chainId = typeof o.chainId === 'number' && Number.isSafeInteger(o.chainId) && o.chainId > 0 ? o.chainId : null;
  if (chainId === null || BUILTIN_CHAIN_IDS.has(chainId)) {
    return null;
  }
  const name = normalizeText(o.name, MAX_CUSTOM_EVM_CHAIN_NAME_LENGTH);
  const nativeSymbol = normalizeText(o.nativeSymbol, MAX_CUSTOM_EVM_CHAIN_SYMBOL_LENGTH);
  const rpcUrl = normalizeCustomEvmChainRpcUrl(o.rpcUrl);
  if (!name || !nativeSymbol || !rpcUrl) {
    return null;
  }
  return { chainId, name, nativeSymbol, rpcUrl };
}

/** 读取并修剪非法条目；去重按 `chainId`，保留首次出现的配置。 */
export async function loadCustomEvmChains(): Promise<CustomEvmChain[]> {
  const bag = await chrome.storage.local.get(CUSTOM_EVM_CHAINS_STORAGE_KEY);
  const raw = bag[CUSTOM_EVM_CHAINS_STORAGE_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: CustomEvmChain[] = [];
  const seen = new Set<number>();
  let rejectedCount = 0;
  for (const item of raw) {
    const chain = normalizeCustomEvmChain(item);
    if (!chain || seen.has(chain.chainId) || result.length >= MAX_CUSTOM_EVM_CHAINS) {
      rejectedCount += 1;
      continue;
    }
    seen.add(chain.chainId);
    result.push(chain);
  }
  if (rejectedCount > 0) {
    // 只记录数量，不记录 RPC URL / key。
    extLogWarn('custom_chain_coerce', { rejectedCount });
  }
  return result;
}

/** 全量写入；调用方应传入已经过 `normalizeCustomEvmChain` 语义的数据。 */
export async function saveCustomEvmChains(chains: readonly CustomEvmChain[]): Promise<void> {
  if (chains.length > MAX_CUSTOM_EVM_CHAINS) {
    throw new Error(`At most ${MAX_CUSTOM_EVM_CHAINS} custom chains are supported`);
  }
  const normalized: CustomEvmChain[] = [];
  const seen = new Set<number>();
  for (const chain of chains) {
    const next = normalizeCustomEvmChain(chain);
    if (!next || seen.has(next.chainId)) {
      throw new Error('Invalid custom chain');
    }
    seen.add(next.chainId);
    normalized.push(next);
  }
  await chrome.storage.local.set({ [CUSTOM_EVM_CHAINS_STORAGE_KEY]: normalized });
}

/** 新增或更新一条自定义链，返回写入后的完整列表。 */
export async function upsertCustomEvmChain(chain: CustomEvmChain): Promise<CustomEvmChain[]> {
  const normalized = normalizeCustomEvmChain(chain);
  if (!normalized) {
    throw new Error('Invalid custom chain');
  }
  const existing = await loadCustomEvmChains();
  const index = existing.findIndex((item) => item.chainId === normalized.chainId);
  if (index < 0 && existing.length >= MAX_CUSTOM_EVM_CHAINS) {
    throw new Error(`At most ${MAX_CUSTOM_EVM_CHAINS} custom chains are supported`);
  }
  const next = [...existing];
  if (index >= 0) {
    next[index] = normalized;
  } else {
    next.push(normalized);
  }
  await saveCustomEvmChains(next);
  return next;
}

/** 删除一条自定义链；不存在时视为成功。 */
export async function removeCustomEvmChain(chainId: number): Promise<CustomEvmChain[]> {
  const existing = await loadCustomEvmChains();
  const next = existing.filter((item) => item.chainId !== chainId);
  if (next.length !== existing.length) {
    await saveCustomEvmChains(next);
  }
  return next;
}

/** 按 `0x` chainId 查找自定义链；内置链不在此处返回。 */
export async function getCustomEvmChainByChainIdHex(chainIdHex: string): Promise<CustomEvmChain | null> {
  const chainId = customEvmChainIdFromHex(chainIdHex);
  if (chainId === null) {
    return null;
  }
  const chains = await loadCustomEvmChains();
  return chains.find((chain) => chain.chainId === chainId) ?? null;
}

/** 把本地配置转换为 viem `Chain`；原生币精度按 EVM 常见的 18 位处理。 */
export function customEvmChainToViemChain(chain: CustomEvmChain): Chain {
  return defineChain({
    id: chain.chainId,
    name: chain.name,
    nativeCurrency: {
      name: chain.nativeSymbol,
      symbol: chain.nativeSymbol,
      decimals: 18
    },
    rpcUrls: {
      default: { http: [chain.rpcUrl] }
    }
  });
}

/**
 * 表单的本地校验（不访问网络）：chainId、重名、内置链冲突、文本长度、RPC URL 形状。
 * 网络校验（`eth_chainId` 是否与填写值一致）由 {@link validateCustomEvmChainRpc} 完成。
 */
export function validateCustomEvmChainDraft(
  draft: CustomEvmChainDraft,
  existing: readonly CustomEvmChain[],
  originalChainId?: number
): CustomEvmChainDraftValidation {
  const chainId = parseCustomEvmChainIdInput(draft.chainIdInput);
  if (chainId === null) {
    return { ok: false, message: 'Chain ID 须为大于 0 的十进制整数或 0x 十六进制。' };
  }
  if (originalChainId !== undefined && chainId !== originalChainId) {
    return { ok: false, message: '编辑已有网络时不能修改 Chain ID；请删除后重新添加。' };
  }
  if (BUILTIN_CHAIN_IDS.has(chainId)) {
    return { ok: false, message: '该 Chain ID 属于内置网络，不能作为自定义网络覆盖。' };
  }
  if (existing.some((chain) => chain.chainId === chainId && chain.chainId !== originalChainId)) {
    return { ok: false, message: '该 Chain ID 已存在，请先编辑或删除原配置。' };
  }
  const name = normalizeText(draft.name, MAX_CUSTOM_EVM_CHAIN_NAME_LENGTH);
  if (!name) {
    return { ok: false, message: `网络名称不能为空，且不超过 ${MAX_CUSTOM_EVM_CHAIN_NAME_LENGTH} 个字符。` };
  }
  const nativeSymbol = normalizeText(draft.nativeSymbol, MAX_CUSTOM_EVM_CHAIN_SYMBOL_LENGTH);
  if (!nativeSymbol) {
    return { ok: false, message: `原生币符号不能为空，且不超过 ${MAX_CUSTOM_EVM_CHAIN_SYMBOL_LENGTH} 个字符。` };
  }
  const rpcUrl = normalizeCustomEvmChainRpcUrl(draft.rpcUrl);
  if (!rpcUrl) {
    return {
      ok: false,
      message: 'RPC URL 须为 HTTPS，或 localhost / 127.0.0.1 的 HTTP 地址；不能包含用户名、密码或 #fragment。'
    };
  }
  return { ok: true, chain: { chainId, name, nativeSymbol, rpcUrl } };
}

type JsonRpcChainIdResponse = {
  result?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
  };
};

function parseJsonRpcChainIdResponse(text: string): JsonRpcChainIdResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  return parsed as JsonRpcChainIdResponse;
}

/**
 * 用 `eth_chainId` 验证 RPC 可达且返回的链 ID 与用户填写一致。
 *
 * 只在用户新增网络或修改 RPC URL 时调用；`fetch` 从扩展页发出（依赖 manifest host_permissions），
 * 不把 RPC URL 或响应原文写进日志 / 错误提示。
 */
export async function validateCustomEvmChainRpc(chainId: number, rpcUrl: string): Promise<CustomEvmChainRpcValidation> {
  const normalizedUrl = normalizeCustomEvmChainRpcUrl(rpcUrl);
  if (!normalizedUrl) {
    return { ok: false, message: 'RPC URL 格式不合法。' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_VALIDATION_TIMEOUT_MS);
  try {
    const response = await fetch(normalizedUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    });
    if (!response.ok) {
      return { ok: false, message: `RPC 返回 HTTP ${response.status}，请检查节点地址与访问权限。` };
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_RPC_RESPONSE_CHARS) {
      return { ok: false, message: 'RPC 响应过大，已中止验证。' };
    }
    const text = await response.text();
    if (text.length > MAX_RPC_RESPONSE_CHARS) {
      return { ok: false, message: 'RPC 响应过大，已中止验证。' };
    }
    const body = parseJsonRpcChainIdResponse(text);
    if (!body || typeof body.result !== 'string') {
      return { ok: false, message: 'RPC 未返回有效的 eth_chainId 结果。' };
    }
    const remoteChainId = customEvmChainIdFromHex(body.result);
    if (remoteChainId === null) {
      return { ok: false, message: 'RPC 返回的 eth_chainId 不是有效的十六进制链 ID。' };
    }
    if (remoteChainId !== chainId) {
      return {
        ok: false,
        message: `RPC 返回的 chainId 为 ${remoteChainId}，与填写的 ${chainId} 不一致。`
      };
    }
    return { ok: true };
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === 'AbortError';
    return {
      ok: false,
      message: timedOut ? 'RPC 验证超时（8 秒），请检查节点可达性。' : '无法连接 RPC，请检查 URL、网络与节点设置。'
    };
  } finally {
    clearTimeout(timer);
  }
}
