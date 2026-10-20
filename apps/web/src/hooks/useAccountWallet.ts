import { describeAccountError } from '@/lib/accountApi';
import {
  EIP6963_ANNOUNCE,
  readWindowEthereum,
  requestProviderDiscovery,
  type AnnouncedWallet
} from '@/lib/walletEip6963';
import { useEffect, useState } from 'react';
import { getAddress, isAddress, type Address } from 'viem';

export type InjectedProvider = AnnouncedWallet['provider'];

export type WalletConnection = {
  provider: InjectedProvider;
  address: Address;
  chainId: number;
};

type UseAccountWalletResult = {
  provider: InjectedProvider | null;
  walletName: string;
  address: Address | null;
  chainId: number | null;
  busy: boolean;
  error: string | null;
  connect: () => Promise<WalletConnection | null>;
};

function parseChainId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    return null;
  }
  const chainId = Number.parseInt(value, 16);
  return Number.isSafeInteger(chainId) && chainId > 0 ? chainId : null;
}

/**
 * `/account` 页的钱包连接状态：EIP-6963 发现、`window.ethereum` 回退、刷新后静默恢复。
 *
 * 只读取公开地址与 chainId；签名与私钥始终由扩展处理。
 */
export function useAccountWallet(): UseAccountWalletResult {
  const [provider, setProvider] = useState<InjectedProvider | null>(null);
  const [walletName, setWalletName] = useState('未发现');
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<AnnouncedWallet>).detail;
      if (
        !detail?.info?.uuid ||
        typeof detail.provider?.request !== 'function'
      ) {
        return;
      }
      setProvider(detail.provider);
      setWalletName(detail.info.name);
    };

    window.addEventListener(EIP6963_ANNOUNCE, onAnnounce);
    requestProviderDiscovery();

    // 部分扩展只注入 window.ethereum；给 EIP-6963 一点时间后再回退。
    const timer = window.setTimeout(() => {
      const fallback = readWindowEthereum();
      if (fallback) {
        setProvider((current) => current ?? fallback);
        setWalletName((current) =>
          current === '未发现' ? 'window.ethereum' : current
        );
      }
    }, 300);

    return () => {
      window.removeEventListener(EIP6963_ANNOUNCE, onAnnounce);
      window.clearTimeout(timer);
    };
  }, []);

  // 刷新页面后若站点仍被钱包授权，静默恢复地址与 chainId（不弹窗）。
  useEffect(() => {
    if (!provider || address) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const accounts = await provider.request({ method: 'eth_accounts' });
        if (
          cancelled ||
          !Array.isArray(accounts) ||
          typeof accounts[0] !== 'string' ||
          !isAddress(accounts[0])
        ) {
          return;
        }
        const nextChainId = parseChainId(
          await provider.request({ method: 'eth_chainId' })
        );
        if (cancelled || nextChainId === null) {
          return;
        }
        setAddress(getAddress(accounts[0]));
        setChainId(nextChainId);
      } catch {
        // 未授权或 provider 不支持静默读取时保持未连接状态。
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider, address]);

  async function connect(): Promise<WalletConnection | null> {
    setBusy(true);
    setError(null);
    try {
      const activeProvider = provider ?? readWindowEthereum();
      if (!activeProvider) {
        throw new Error(
          '未检测到 window.ethereum；请安装并启用浏览器扩展后刷新页面。'
        );
      }

      const accounts = await activeProvider.request({
        method: 'eth_requestAccounts'
      });
      if (
        !Array.isArray(accounts) ||
        typeof accounts[0] !== 'string' ||
        !isAddress(accounts[0])
      ) {
        throw new Error('钱包未返回有效的 EVM 地址。');
      }

      const nextChainId = parseChainId(
        await activeProvider.request({ method: 'eth_chainId' })
      );
      if (nextChainId === null) {
        throw new Error('钱包返回的 chainId 无效。');
      }

      const nextAddress = getAddress(accounts[0]);
      setProvider(activeProvider);
      setAddress(nextAddress);
      setChainId(nextChainId);
      return {
        provider: activeProvider,
        address: nextAddress,
        chainId: nextChainId
      };
    } catch (e) {
      setError(describeAccountError(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { provider, walletName, address, chainId, busy, error, connect };
}
