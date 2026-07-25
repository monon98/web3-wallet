import { isAddress, numberToHex } from 'viem';
import type { Chain } from 'viem/chains';

/** @see https://eips.ethereum.org/EIPS/eip-6963 */
export type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

export type AnnouncedWallet = {
  info: Eip6963ProviderInfo;
  provider: {
    request: (args: {
      method: string;
      params?: readonly unknown[];
    }) => Promise<unknown>;
  };
};

export const EIP6963_ANNOUNCE = 'eip6963:announceProvider';
export const EIP6963_REQUEST = 'eip6963:requestProvider';

export function requestProviderDiscovery(): void {
  window.dispatchEvent(new Event(EIP6963_REQUEST));
}

export function readWindowEthereum(): {
  request: AnnouncedWallet['provider']['request'];
} | null {
  const w = window as Window & {
    ethereum?: {
      request?: (args: {
        method: string;
        params?: readonly unknown[];
      }) => Promise<unknown>;
    };
  };
  const eth = w.ethereum;
  if (eth && typeof eth.request === 'function') {
    return { request: (args) => eth.request!(args) };
  }
  return null;
}

export function parseFirstEvmAddress(
  accountsText: string | null | undefined
): `0x${string}` | null {
  if (
    accountsText == null ||
    accountsText === '' ||
    accountsText === '（空）'
  ) {
    return null;
  }
  const first = accountsText.split(',')[0]?.trim();
  if (!first || !isAddress(first)) {
    return null;
  }
  return first;
}

export function chainAddEthereumChainParams(chain: Chain) {
  const http = chain.rpcUrls.default.http;
  return {
    chainId: numberToHex(chain.id),
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: { default: { http: [...http] } },
    blockExplorerUrls: chain.blockExplorers?.default?.url
      ? [chain.blockExplorers.default.url]
      : undefined
  };
}
