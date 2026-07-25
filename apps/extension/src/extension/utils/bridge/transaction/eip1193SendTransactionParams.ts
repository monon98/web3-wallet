import type { Address, Hex } from 'viem';

import { getAddress, isAddress, isHex } from '~web3/evm/viem';

/** 不含 `account` / `chain`，供 `createWalletClient(...).sendTransaction` 使用（避免 viem 对 EIP-4844 `kzg` 等可选字段的推断问题）。 */
export type EvmWalletSendTxFields = {
  to: Address;
  value?: bigint;
  data?: Hex;
  gas?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
  type?: 'legacy' | 'eip2930' | 'eip1559';
};

/**
 * 将 DApp 的 `eth_sendTransaction` 交易对象规范化为 `walletClient.sendTransaction` 参数（不含 account/chain）。
 * 与当前钱包 `chainId` 不一致时失败；暂不支持无 `to` 的合约创建交易。
 */

function parseTxChainId(raw: unknown): bigint | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
    return BigInt(raw);
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const s = raw.trim();
    try {
      if (s.startsWith('0x') || s.startsWith('0X')) {
        return BigInt(s);
      }
      const dec = Number.parseInt(s, 10);
      if (!Number.isNaN(dec) && dec > 0) {
        return BigInt(dec);
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function hexQuantityToBigInt(label: string, v: unknown): bigint | undefined {
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  if (typeof v === 'bigint') {
    return v;
  }
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
    return BigInt(Math.trunc(v));
  }
  if (typeof v !== 'string') {
    throw new Error(`${label} 无效`);
  }
  const s = v.trim();
  if (s === '' || s === '0x') {
    return undefined;
  }
  try {
    return BigInt(s.startsWith('0x') || s.startsWith('0X') ? s : `0x${s}`);
  } catch {
    throw new Error(`${label} 须为有效十六进制数量`);
  }
}

function hexNonce(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) {
    return v;
  }
  if (typeof v !== 'string') {
    throw new Error('nonce 无效');
  }
  const n = hexQuantityToBigInt('nonce', v);
  if (n === undefined) {
    return undefined;
  }
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('nonce 过大');
  }
  return Number(n);
}

function parseData(v: unknown): Hex | undefined {
  if (v === undefined || v === null || v === '') {
    return undefined;
  }
  if (typeof v !== 'string') {
    throw new Error('data 须为 hex 字符串');
  }
  const s = v.trim();
  if (s === '') {
    return undefined;
  }
  const with0x = s.startsWith('0x') || s.startsWith('0X') ? s : `0x${s}`;
  if (!isHex(with0x)) {
    throw new Error('data 须为合法 hex');
  }
  return with0x as Hex;
}

export function eip1193TxToSendParams(
  tx: Record<string, unknown>,
  walletChainIdHex: `0x${string}`
): { ok: true; params: EvmWalletSendTxFields } | { ok: false; message: string } {
  const walletId = BigInt(walletChainIdHex);
  const paramChain = parseTxChainId(tx.chainId);
  if (paramChain !== undefined && paramChain !== walletId) {
    return {
      ok: false,
      message: '交易中的 chainId 与钱包当前链不一致，请先在 DApp 中切换网络或在本扩展中切换链。'
    };
  }

  const fromRaw = tx.from;
  if (typeof fromRaw !== 'string' || !isAddress(fromRaw)) {
    return { ok: false, message: '缺少或无效的 from 地址。' };
  }

  let toAddr: Address;
  const toRaw = tx.to;
  if (toRaw === undefined || toRaw === null) {
    return { ok: false, message: '暂不支持合约创建交易（缺少 to）。' };
  }
  if (typeof toRaw !== 'string' || !isAddress(toRaw)) {
    return { ok: false, message: '无效的 to 地址。' };
  }
  try {
    toAddr = getAddress(toRaw as `0x${string}`);
  } catch {
    return { ok: false, message: '无效的 to 地址。' };
  }
  void getAddress(fromRaw as `0x${string}`);

  try {
    const gasSource = tx.gas ?? tx.gasLimit;
    const value = hexQuantityToBigInt('value', tx.value);
    const gas = hexQuantityToBigInt('gas', gasSource);
    const gasPrice = hexQuantityToBigInt('gasPrice', tx.gasPrice);
    const maxFeePerGas = hexQuantityToBigInt('maxFeePerGas', tx.maxFeePerGas);
    const maxPriorityFeePerGas = hexQuantityToBigInt('maxPriorityFeePerGas', tx.maxPriorityFeePerGas);
    const nonce = hexNonce(tx.nonce);
    const data = parseData(tx.data);

    const typeRaw = tx.type;
    let type: 'legacy' | 'eip2930' | 'eip1559' | undefined;
    if (typeof typeRaw === 'string') {
      const t = typeRaw.trim();
      if (t === '0x0' || t === '0x00' || t === '0') {
        type = 'legacy';
      } else if (t === '0x1' || t === '1') {
        type = 'eip2930';
      } else if (t === '0x2' || t === '2') {
        type = 'eip1559';
      }
    } else if (typeof typeRaw === 'number' && (typeRaw === 0 || typeRaw === 1 || typeRaw === 2)) {
      type = typeRaw === 0 ? 'legacy' : typeRaw === 1 ? 'eip2930' : 'eip1559';
    }

    const params: EvmWalletSendTxFields = {
      to: toAddr,
      ...(value !== undefined ? { value } : {}),
      ...(data !== undefined ? { data } : {}),
      ...(gas !== undefined ? { gas } : {}),
      ...(gasPrice !== undefined ? { gasPrice } : {}),
      ...(maxFeePerGas !== undefined ? { maxFeePerGas } : {}),
      ...(maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas } : {}),
      ...(nonce !== undefined ? { nonce } : {}),
      ...(type !== undefined ? { type } : {})
    };
    return { ok: true, params };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg || '无法解析交易参数。' };
  }
}
