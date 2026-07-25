'use client';

import {
  chainAddEthereumChainParams,
  EIP6963_ANNOUNCE,
  parseFirstEvmAddress,
  readWindowEthereum,
  requestProviderDiscovery,
  type AnnouncedWallet
} from '@/lib/walletEip6963';
import {
  getWalletBuiltinEvmChainMetaFromHex,
  WALLET_BUILTIN_EVM_CHAINS
} from '@plugin/shared';
import {
  FieldHint,
  FieldLabel,
  PanelSection,
  SelectField,
  TextArea,
  UiButton
} from '@plugin/ui';
import Link from 'next/link';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { formatEther, numberToHex } from 'viem';
import {
  arbitrum,
  base,
  bsc,
  mainnet,
  optimism,
  polygon,
  sepolia,
  type Chain
} from 'viem/chains';

const VIEM_BY_ID: ReadonlyMap<number, Chain> = new Map(
  [mainnet, sepolia, arbitrum, optimism, base, polygon, bsc].map((c) => [
    c.id,
    c
  ])
);

/** 与 `@plugin/shared` / 扩展 `readonly-evm-rpc` 顺序、ID 一致。 */
const ORDERED_DEMO_VIEM_CHAINS: readonly Chain[] =
  WALLET_BUILTIN_EVM_CHAINS.map((m) => {
    const c = VIEM_BY_ID.get(m.id);
    if (!c) {
      throw new Error(`wallet: missing viem chain for builtin id ${m.id}`);
    }
    return c;
  });

export default function WalletPage() {
  const [wallets, setWallets] = useState<AnnouncedWallet[]>([]);
  const [usedEthereumFallback, setUsedEthereumFallback] = useState(false);
  const [chainId, setChainId] = useState<Record<string, string | null>>({});
  const [accounts, setAccounts] = useState<Record<string, string | null>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [balanceLabel, setBalanceLabel] = useState<
    Record<string, string | null>
  >({});
  const [balanceLoading, setBalanceLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [signMessageText, setSignMessageText] = useState(
    'Hello from wallet（Web 联调）'
  );
  const [signLoading, setSignLoading] = useState<Record<string, boolean>>({});
  const [signResult, setSignResult] = useState<Record<string, string | null>>(
    {}
  );
  const [targetChainId, setTargetChainId] = useState<number>(
    WALLET_BUILTIN_EVM_CHAINS[0].id
  );
  const [chainOpLoading, setChainOpLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [blockNumberLabel, setBlockNumberLabel] = useState<
    Record<string, string | null>
  >({});
  const [blockNumberLoading, setBlockNumberLoading] = useState<
    Record<string, boolean>
  >({});
  const [balanceBlockTag, setBalanceBlockTag] = useState<'latest' | 'pending'>(
    'latest'
  );

  const chainOptions = useMemo(
    () =>
      WALLET_BUILTIN_EVM_CHAINS.map((c) => ({
        id: c.id,
        label: `${c.name} (${c.id})`
      })),
    []
  );

  useLayoutEffect(() => {
    const byKey = new Map<string, AnnouncedWallet>();

    const flush = () => {
      setWallets(Array.from(byKey.values()));
    };

    const onAnnounce = (event: Event) => {
      const ce = event as CustomEvent<AnnouncedWallet>;
      const detail = ce.detail;
      if (
        !detail?.info?.uuid ||
        typeof detail.provider?.request !== 'function'
      ) {
        return;
      }
      const key = `${detail.info.rdns}:${detail.info.uuid}`;
      byKey.set(key, detail);
      flush();
    };

    window.addEventListener(EIP6963_ANNOUNCE, onAnnounce);

    const scheduleFallback = () => {
      if (byKey.size > 0) {
        return;
      }
      const p = readWindowEthereum();
      if (!p) {
        return;
      }
      setUsedEthereumFallback(true);
      byKey.set('__window_ethereum__', {
        info: {
          uuid: 'window-ethereum-fallback',
          name: 'window.ethereum',
          icon: '',
          rdns: 'eip1193.window.ethereum'
        },
        provider: p
      });
      flush();
    };

    requestProviderDiscovery();

    const delays = [50, 200, 800, 2000];
    const timers = delays.map((ms) =>
      window.setTimeout(() => {
        requestProviderDiscovery();
        if (ms === 2000) {
          scheduleFallback();
        }
      }, ms)
    );

    const onLoad = () => {
      requestProviderDiscovery();
    };
    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad);
    }

    return () => {
      window.removeEventListener(EIP6963_ANNOUNCE, onAnnounce);
      window.removeEventListener('load', onLoad);
      for (const t of timers) {
        window.clearTimeout(t);
      }
      setWallets([]);
      setUsedEthereumFallback(false);
    };
  }, []);

  const refreshDiscovery = useCallback(() => {
    requestProviderDiscovery();
    window.setTimeout(requestProviderDiscovery, 100);
  }, []);

  const readChainId = useCallback(async (w: AnnouncedWallet) => {
    const key = w.info.uuid;
    setErrors((e) => ({ ...e, [key]: null }));
    try {
      const id = await w.provider.request({ method: 'eth_chainId' });
      setChainId((c) => ({
        ...c,
        [key]: typeof id === 'string' ? id : JSON.stringify(id)
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrors((e) => ({ ...e, [key]: message }));
      setChainId((c) => ({ ...c, [key]: null }));
    }
  }, []);

  const readAccounts = useCallback(async (w: AnnouncedWallet) => {
    const key = w.info.uuid;
    setErrors((e) => ({ ...e, [key]: null }));
    try {
      const list = await w.provider.request({ method: 'eth_accounts' });
      const text = Array.isArray(list)
        ? list.map((a) => String(a)).join(', ') || '（空）'
        : JSON.stringify(list);
      setAccounts((a) => ({ ...a, [key]: text }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrors((e) => ({ ...e, [key]: message }));
      setAccounts((a) => ({ ...a, [key]: null }));
    }
  }, []);

  const connectRequestAccounts = useCallback(
    async (w: AnnouncedWallet) => {
      const key = w.info.uuid;
      setErrors((e) => ({ ...e, [key]: null }));
      setConnecting((c) => ({ ...c, [key]: true }));
      try {
        const list = await w.provider.request({
          method: 'eth_requestAccounts'
        });
        const text = Array.isArray(list)
          ? list.map((a) => String(a)).join(', ')
          : JSON.stringify(list);
        setAccounts((a) => ({ ...a, [key]: text }));
        await readChainId(w);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setErrors((e) => ({ ...e, [key]: message }));
      } finally {
        setConnecting((c) => ({ ...c, [key]: false }));
      }
    },
    [readChainId]
  );

  const fetchNativeBalance = useCallback(
    async (w: AnnouncedWallet) => {
      const key = w.info.uuid;
      const addr = parseFirstEvmAddress(accounts[key]);
      if (addr === null) {
        setErrors((e) => ({
          ...e,
          [key]: '请先连接钱包，或当前 accounts 中无有效 0x 地址。'
        }));
        return;
      }
      setErrors((e) => ({ ...e, [key]: null }));
      setBalanceLoading((b) => ({ ...b, [key]: true }));
      try {
        const hex = await w.provider.request({
          method: 'eth_getBalance',
          params: [addr, balanceBlockTag]
        });
        if (typeof hex !== 'string' || !hex.startsWith('0x')) {
          throw new Error(`Unexpected eth_getBalance payload: ${String(hex)}`);
        }
        const wei = BigInt(hex);
        const human = formatEther(wei);
        const meta = getWalletBuiltinEvmChainMetaFromHex(chainId[key] ?? null);
        const sym = meta?.nativeSymbol ?? 'native';
        setBalanceLabel((b) => ({
          ...b,
          [key]: `${human} ${sym} · ${hex}（wei）· ${balanceBlockTag} · 地址 ${addr}`
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setErrors((e) => ({ ...e, [key]: message }));
        setBalanceLabel((b) => ({ ...b, [key]: null }));
      } finally {
        setBalanceLoading((b) => ({ ...b, [key]: false }));
      }
    },
    [accounts, balanceBlockTag, chainId]
  );

  const fetchBlockNumber = useCallback(async (w: AnnouncedWallet) => {
    const key = w.info.uuid;
    setErrors((e) => ({ ...e, [key]: null }));
    setBlockNumberLoading((b) => ({ ...b, [key]: true }));
    try {
      const hex = await w.provider.request({ method: 'eth_blockNumber' });
      if (typeof hex !== 'string' || !hex.startsWith('0x')) {
        throw new Error(`Unexpected eth_blockNumber: ${String(hex)}`);
      }
      const n = BigInt(hex);
      setBlockNumberLabel((b) => ({
        ...b,
        [key]: `${n.toString()}（${hex}）`
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrors((e) => ({ ...e, [key]: message }));
      setBlockNumberLabel((b) => ({ ...b, [key]: null }));
    } finally {
      setBlockNumberLoading((b) => ({ ...b, [key]: false }));
    }
  }, []);

  const runPersonalSign = useCallback(
    async (w: AnnouncedWallet) => {
      const key = w.info.uuid;
      const addr = parseFirstEvmAddress(accounts[key]);
      if (addr === null) {
        setErrors((e) => ({
          ...e,
          [key]:
            '请先连接钱包；personal_sign 需要当前 accounts 中的地址（扩展要求与站点会话一致）。'
        }));
        return;
      }
      setErrors((e) => ({ ...e, [key]: null }));
      setSignLoading((s) => ({ ...s, [key]: true }));
      try {
        const sig = await w.provider.request({
          method: 'personal_sign',
          params: [signMessageText, addr]
        });
        if (typeof sig !== 'string') {
          throw new Error(`Unexpected signature: ${String(sig)}`);
        }
        setSignResult((s) => ({ ...s, [key]: sig }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setErrors((e) => ({ ...e, [key]: message }));
        setSignResult((s) => ({ ...s, [key]: null }));
      } finally {
        setSignLoading((s) => ({ ...s, [key]: false }));
      }
    },
    [accounts, signMessageText]
  );

  const runWalletSwitchChain = useCallback(
    async (w: AnnouncedWallet) => {
      const key = w.info.uuid;
      const chain = ORDERED_DEMO_VIEM_CHAINS.find(
        (c) => c.id === targetChainId
      );
      if (!chain) {
        return;
      }
      const chainIdHex = numberToHex(chain.id);
      setErrors((e) => ({ ...e, [key]: null }));
      setChainOpLoading((c) => ({ ...c, [key]: true }));
      try {
        await w.provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }]
        });
        await readChainId(w);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setErrors((e) => ({ ...e, [key]: message }));
      } finally {
        setChainOpLoading((c) => ({ ...c, [key]: false }));
      }
    },
    [readChainId, targetChainId]
  );

  const runWalletAddChain = useCallback(
    async (w: AnnouncedWallet) => {
      const key = w.info.uuid;
      const chain = ORDERED_DEMO_VIEM_CHAINS.find(
        (c) => c.id === targetChainId
      );
      if (!chain) {
        return;
      }
      setErrors((e) => ({ ...e, [key]: null }));
      setChainOpLoading((c) => ({ ...c, [key]: true }));
      try {
        await w.provider.request({
          method: 'wallet_addEthereumChain',
          params: [chainAddEthereumChainParams(chain)]
        });
        await readChainId(w);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setErrors((e) => ({ ...e, [key]: message }));
      } finally {
        setChainOpLoading((c) => ({ ...c, [key]: false }));
      }
    },
    [readChainId, targetChainId]
  );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 leading-relaxed text-neutral-900 dark:text-neutral-100 sm:px-6 lg:px-8">
      <p>
        <Link
          href="/"
          className="text-sm text-blue-700 underline decoration-blue-700/50 hover:opacity-80 dark:text-blue-400 dark:decoration-blue-400/50">
          ← 返回首页
        </Link>
      </p>
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          钱包连接（EIP-6963）
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          在同一浏览器中通过 EIP-6963 发现扩展钱包；只读与签名操作见各面板说明。
        </p>
      </header>
      <PanelSection
        tone="muted"
        title="使用说明"
        description="在已安装本扩展的同一浏览器窗口中打开本页（如 http://localhost:3000）。扩展侧须先在侧栏导入至少一个账户；只读：eth_blockNumber、eth_getBalance（须先连接）；切链与 personal_sign；签名需在扩展弹窗输入加密口令。内置链与 @plugin/shared 的 WALLET_BUILTIN_EVM_CHAINS 一致。">
        <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          若列表为空：确认扩展有权访问本站；Plasmo
          开发改代码后需重新加载扩展。若本机有 MetaMask，扩展仍会通过 EIP-6963
          播报；约 2 秒后可回退到{' '}
          <code className="rounded bg-white/80 px-1 font-mono dark:bg-neutral-800/80">
            window.ethereum
          </code>
          。
        </p>
      </PanelSection>

      {usedEthereumFallback ? (
        <PanelSection
          tone="amber"
          title="注入回退"
          description="未收到 EIP-6963 播报，当前使用 window.ethereum（可能与 MetaMask 等共用注入对象）。"
        />
      ) : null}

      <UiButton variant="secondary" size="sm" onClick={refreshDiscovery}>
        再次请求发现（dispatch requestProvider）
      </UiButton>

      {wallets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white/60 px-4 py-6 text-center text-sm text-neutral-600 dark:border-neutral-600 dark:bg-neutral-900/40 dark:text-neutral-400">
          当前未发现任何 EIP-6963 钱包；等待回退或检查扩展是否注入本页。
        </p>
      ) : (
        <>
          <PanelSection
            title="联调共用参数"
            description="personal_sign 消息、wallet_switch / wallet_add 目标链、eth_getBalance 区块标签。">
            <FieldLabel className="mt-1">
              待签名消息（personal_sign 首参）
              <TextArea
                className="mt-1.5 font-sans"
                rows={3}
                value={signMessageText}
                onChange={(e) => setSignMessageText(e.target.value)}
              />
            </FieldLabel>
            <FieldLabel className="mt-4">
              目标链
              <SelectField
                className="mt-1.5 max-w-full sm:max-w-md"
                value={targetChainId}
                onChange={(e) => setTargetChainId(Number(e.target.value))}>
                {chainOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
            </FieldLabel>
            <FieldLabel className="mt-4">
              eth_getBalance 区块参数
              <SelectField
                className="mt-1.5 max-w-full sm:max-w-xs"
                value={balanceBlockTag}
                onChange={(e) =>
                  setBalanceBlockTag(
                    e.target.value === 'pending' ? 'pending' : 'latest'
                  )
                }>
                <option value="latest">latest</option>
                <option value="pending">pending</option>
              </SelectField>
            </FieldLabel>
          </PanelSection>

          <ul className="list-none space-y-4 p-0">
            {wallets.map((w) => (
              <li key={`${w.info.rdns}-${w.info.uuid}`}>
                <PanelSection className="shadow-sm dark:shadow-none">
                  <div className="flex items-start gap-3 sm:items-center">
                    {w.info.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data URI from wallet
                      <img
                        src={w.info.icon}
                        alt=""
                        width={36}
                        height={36}
                        className="rounded-md"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-50">
                        {w.info.name}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        <code className="font-mono">{w.info.rdns}</code> · uuid:{' '}
                        {w.info.uuid}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <UiButton
                      variant="primary"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={connecting[w.info.uuid] === true}
                      onClick={() => void connectRequestAccounts(w)}>
                      {connecting[w.info.uuid] === true
                        ? '等待扩展确认…'
                        : '连接 eth_requestAccounts'}
                    </UiButton>
                    <UiButton
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => void readAccounts(w)}>
                      读取 eth_accounts
                    </UiButton>
                    <UiButton
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => void readChainId(w)}>
                      读取 eth_chainId
                    </UiButton>
                    <UiButton
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={blockNumberLoading[w.info.uuid] === true}
                      onClick={() => void fetchBlockNumber(w)}>
                      {blockNumberLoading[w.info.uuid] === true
                        ? '读取区块号…'
                        : 'eth_blockNumber'}
                    </UiButton>
                    <UiButton
                      variant="secondary"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={balanceLoading[w.info.uuid] === true}
                      onClick={() => void fetchNativeBalance(w)}>
                      {balanceLoading[w.info.uuid] === true
                        ? '查询余额中…'
                        : 'eth_getBalance'}
                    </UiButton>
                    <UiButton
                      variant="neutral"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={
                        signLoading[w.info.uuid] === true ||
                        chainOpLoading[w.info.uuid] === true
                      }
                      onClick={() => void runPersonalSign(w)}>
                      {signLoading[w.info.uuid] === true
                        ? '等待签名…'
                        : 'personal_sign'}
                    </UiButton>
                    <UiButton
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={chainOpLoading[w.info.uuid] === true}
                      onClick={() => void runWalletSwitchChain(w)}>
                      wallet_switch
                    </UiButton>
                    <UiButton
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={chainOpLoading[w.info.uuid] === true}
                      onClick={() => void runWalletAddChain(w)}>
                      wallet_add
                    </UiButton>
                  </div>
                  {accounts[w.info.uuid] != null ? (
                    <p className="mt-3 break-all text-xs text-neutral-700 dark:text-neutral-300">
                      accounts:{' '}
                      <code className="font-mono">{accounts[w.info.uuid]}</code>
                    </p>
                  ) : null}
                  {chainId[w.info.uuid] !== undefined &&
                  chainId[w.info.uuid] !== null ? (
                    <p className="mt-1 text-xs text-neutral-700 dark:text-neutral-300">
                      chainId:{' '}
                      <code className="font-mono">{chainId[w.info.uuid]}</code>
                    </p>
                  ) : null}
                  {blockNumberLabel[w.info.uuid] != null ? (
                    <p className="mt-1 break-all text-xs text-neutral-700 dark:text-neutral-300">
                      区块号:{' '}
                      <code className="font-mono">
                        {blockNumberLabel[w.info.uuid]}
                      </code>
                    </p>
                  ) : null}
                  {balanceLabel[w.info.uuid] != null ? (
                    <p className="mt-2 break-all text-xs text-neutral-700 dark:text-neutral-300">
                      余额:{' '}
                      <code className="font-mono">
                        {balanceLabel[w.info.uuid]}
                      </code>
                    </p>
                  ) : null}
                  {signResult[w.info.uuid] != null ? (
                    <p className="mt-2 break-all text-xs text-neutral-700 dark:text-neutral-300">
                      签名:{' '}
                      <code className="font-mono">
                        {signResult[w.info.uuid]}
                      </code>
                    </p>
                  ) : null}
                  {errors[w.info.uuid] ? (
                    <FieldHint variant="error" className="mt-2">
                      {errors[w.info.uuid]}
                    </FieldHint>
                  ) : null}
                </PanelSection>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
