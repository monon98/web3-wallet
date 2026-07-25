import {
  bytesToHex,
  createPublicClient,
  getAddress,
  hexToBytes,
  http,
  isAddress,
  isHex,
  numberToHex,
  size,
  toHex
} from 'viem';

/**
 * EVM 三方库封装：统一收口 `viem` 的常用工具与类型。
 * 业务代码（vault/bridge/ui）应仅从 `~web3/evm/viem` 引用，避免散落的三方库 import。
 */

export { bytesToHex, createPublicClient, getAddress, hexToBytes, http, isAddress, isHex, numberToHex, size, toHex };

export type { Hex, TransactionSerializable } from 'viem';
