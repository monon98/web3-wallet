import { getEtherscanApiKey, getServerRpcUrl } from '../config/chain.js';
import {
  getNativeBalancesBatchEtherscan,
  isEtherscanCoolingDown,
  isEtherscanNetworkFailure,
  markEtherscanUnavailable
} from './etherscanV2.js';
import {
  getNativeBalancesRpc,
  NativeBalanceRpcError
} from './nativeBalanceRpc.js';

/**
 * EVM 原生余额数据源选择：配置 `SERVER_RPC_URL` 时优先 RPC（链 ID 必须一致），
 * RPC 不可用再回退 Etherscan；返回值 `source` 供 Web 标注数据来源。
 *
 * 调用链：旧版 `/api/v1/evm/explorer/native-balance(s)` 与统一余额查询共用。
 */

export type NativeBalanceRow = {
  chainId: number;
  address: string;
  balanceWei: string;
};

export type NativeBalanceSource = 'etherscan' | 'rpc';

export async function loadNativeBalances(params: {
  chainId: number;
  addresses: string[];
}): Promise<{ rows: NativeBalanceRow[]; source: NativeBalanceSource }> {
  const rpcConfigured = Boolean(getServerRpcUrl());
  const etherscanConfigured = Boolean(getEtherscanApiKey());

  if (rpcConfigured) {
    try {
      const rows = await getNativeBalancesRpc(params);
      return { rows, source: 'rpc' };
    } catch (e) {
      // 地址 / 参数错误无需再试 Etherscan
      if (e instanceof NativeBalanceRpcError && e.statusCode === 400) {
        throw e;
      }
      if (!etherscanConfigured || isEtherscanCoolingDown()) {
        throw e;
      }

      try {
        const rows = await getNativeBalancesBatchEtherscan(params);
        return { rows, source: 'etherscan' };
      } catch (etherscanError) {
        // RPC 链不一致时优先返回可操作的原因（切换链或调整 SERVER_RPC_URL）
        if (
          e instanceof NativeBalanceRpcError &&
          e.message === 'rpc_chain_mismatch'
        ) {
          throw e;
        }
        if (isEtherscanNetworkFailure(etherscanError)) {
          markEtherscanUnavailable();
        }
        throw etherscanError;
      }
    }
  }

  try {
    const rows = await getNativeBalancesBatchEtherscan(params);
    return { rows, source: 'etherscan' };
  } catch (e) {
    if (isEtherscanNetworkFailure(e)) {
      markEtherscanUnavailable();
    }
    throw e;
  }
}
