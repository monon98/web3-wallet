/** 链网关相关环境变量（勿在日志中输出密钥） */

export function getServerRpcUrl(): string | undefined {
  const u = process.env.SERVER_RPC_URL?.trim();
  return u || undefined;
}

export function getEtherscanApiKey(): string | undefined {
  const k = process.env.ETHERSCAN_API_KEY?.trim();
  return k || undefined;
}

/** Etherscan API V2 根 URL，见 https://docs.etherscan.io/introduction */
export function getEtherscanApiUrl(): string {
  return (
    process.env.ETHERSCAN_API_URL?.trim() || 'https://api.etherscan.io/v2/api'
  );
}

/** Tron HTTP API（TronGrid）根地址，见 https://developers.tron.network/ */
export function getTronApiUrl(): string {
  return process.env.SERVER_TRON_API_URL?.trim() || 'https://api.trongrid.io';
}

export function getTronApiKey(): string | undefined {
  const k = process.env.SERVER_TRON_API_KEY?.trim();
  return k || undefined;
}
