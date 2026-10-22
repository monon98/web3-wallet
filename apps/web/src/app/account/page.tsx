'use client';

import { AccountAuthSection } from '@/components/account/accountAuthSection';
import { AccountTxSection } from '@/components/account/accountTxSection';
import { AccountWalletSection } from '@/components/account/accountWalletSection';
import { useAccountWallet } from '@/hooks/useAccountWallet';
import {
  broadcastSignedTransaction,
  describeAccountError,
  fetchAuthSession,
  logoutAuthSession,
  prepareEvmTransaction,
  requestAuthChallenge,
  verifyAuthSignature,
  type AuthChallenge,
  type StoredAuthSession
} from '@/lib/accountApi';
import { getPublicApiBaseUrl } from '@/lib/publicApi';
import { PanelSection } from '@plugin/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getAddress, isAddress, numberToHex, parseEther } from 'viem';

/**
 * 登录与交易广播联调页。
 *
 * 登录：服务端 challenge → 钱包 personal_sign → 服务端校验 → HttpOnly Cookie 会话；
 * CSRF token 只保存在页面内存（刷新后从 `/auth/me` 恢复），不再写 sessionStorage。
 * 交易：服务端读 nonce / gas / gasPrice → 钱包 eth_signTransaction → 服务端广播。
 * 信任边界：私钥与助记词只在扩展内；本页只处理公开地址、签名和已签名 raw tx。
 */
export default function AccountPage() {
  const apiBase = useMemo(() => getPublicApiBaseUrl(), []);
  const {
    provider,
    walletName,
    address,
    chainId,
    busy: walletBusy,
    error: walletError,
    connect
  } = useAccountWallet();

  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [session, setSession] = useState<StoredAuthSession | null>(null);
  const [authBusy, setAuthBusy] = useState<
    'challenge' | 'sign' | 'verify' | null
  >(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [txTo, setTxTo] = useState('');
  const [txValueEth, setTxValueEth] = useState('0');
  const [signedTx, setSignedTx] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txNotice, setTxNotice] = useState<string | null>(null);
  const [txBusy, setTxBusy] = useState<'sign' | 'broadcast' | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiBase) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchAuthSession(apiBase);
        if (!cancelled) {
          setSession(me);
        }
      } catch {
        // 未登录 / 会话过期（HTTP 401）是正常状态；HttpOnly Cookie 由服务端清理。
        if (!cancelled) {
          setSession(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  async function connectWallet() {
    const connection = await connect();
    if (!connection) {
      return;
    }

    if (session && session.address !== connection.address) {
      const previous = session;
      setSession(null);
      setAuthNotice('钱包地址已变化，请重新登录。');
      if (apiBase) {
        try {
          await logoutAuthSession(apiBase, previous.csrfToken);
        } catch {
          setAuthError('旧登录会话注销失败，请刷新页面后重新登录。');
        }
      }
    }

    setChallenge(null);
    setSignature(null);
    setSignedTx(null);
    setTxHash(null);
    setTxNotice(null);
    setTxError(null);
  }

  async function requestChallenge() {
    if (!address || !chainId) {
      setAuthError('请先连接钱包。');
      return;
    }

    setAuthBusy('challenge');
    setAuthError(null);
    setAuthNotice(null);
    setSignature(null);
    try {
      const next = await requestAuthChallenge(apiBase, address, chainId);
      setChallenge(next);
      setAuthNotice('已获取登录消息；请用钱包签名后点击“验证并登录”。');
    } catch (e) {
      setAuthError(describeAccountError(e));
    } finally {
      setAuthBusy(null);
    }
  }

  async function signChallenge() {
    if (!challenge || !address) {
      setAuthError('请先生成登录消息。');
      return;
    }
    const activeProvider = provider;
    if (!activeProvider) {
      setAuthError('未检测到钱包 provider。');
      return;
    }

    setAuthBusy('sign');
    setAuthError(null);
    setAuthNotice(null);
    try {
      const result = await activeProvider.request({
        method: 'personal_sign',
        params: [challenge.message, address]
      });
      if (typeof result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(result)) {
        throw new Error('钱包未返回有效的签名。');
      }
      setSignature(result);
      setAuthNotice('签名已完成；请点击“验证并登录”。');
    } catch (e) {
      setAuthError(describeAccountError(e));
    } finally {
      setAuthBusy(null);
    }
  }

  async function verifyLogin() {
    if (!challenge || !signature || !address) {
      setAuthError('请先生成登录消息并完成钱包签名。');
      return;
    }

    setAuthBusy('verify');
    setAuthError(null);
    setAuthNotice(null);
    try {
      const verified = await verifyAuthSignature(apiBase, {
        challengeId: challenge.challengeId,
        address,
        signature
      });

      let me = verified;
      let cookieSessionRestored = true;
      try {
        me = await fetchAuthSession(apiBase);
      } catch {
        // Cookie 已由 verify 写入；/me 失败时仍可用 verify 的 CSRF token。
        cookieSessionRestored = false;
      }

      setSession(me);
      setChallenge(null);
      setSignature(null);
      setAuthNotice(
        cookieSessionRestored
          ? '登录成功；现在可以签名并广播交易。'
          : '登录签名已校验，但 Cookie 会话未能恢复；请检查服务端 CORS / SameSite 配置。'
      );
    } catch (e) {
      setAuthError(describeAccountError(e));
    } finally {
      setAuthBusy(null);
    }
  }

  function logout() {
    const csrfToken = session?.csrfToken;
    setSession(null);
    setChallenge(null);
    setSignature(null);
    setSignedTx(null);
    setTxHash(null);
    setTxNotice(null);
    setTxError(null);
    setAuthNotice('已退出登录。');
    if (csrfToken && apiBase) {
      void logoutAuthSession(apiBase, csrfToken).catch(() => {
        setAuthNotice('本地会话已清除；服务端注销请求失败。');
      });
    }
  }

  async function signTransaction() {
    if (!address || !chainId) {
      setTxError('请先连接钱包。');
      return;
    }
    if (!session) {
      setTxError('请先完成登录。');
      return;
    }
    if (session.address !== address) {
      setTxError('当前钱包地址与登录地址不一致，请重新登录。');
      return;
    }
    if (!isAddress(txTo)) {
      setTxError('请输入有效的接收地址。');
      return;
    }

    let valueWei: bigint;
    try {
      valueWei = parseEther((txValueEth || '0').trim());
    } catch {
      setTxError('请输入有效的 ETH 金额。');
      return;
    }

    const activeProvider = provider;
    if (!activeProvider) {
      setTxError('未检测到钱包 provider。');
      return;
    }

    setTxBusy('sign');
    setTxError(null);
    setTxNotice(null);
    setSignedTx(null);
    setTxHash(null);
    try {
      const to = getAddress(txTo);
      const prepared = await prepareEvmTransaction(apiBase, {
        from: address,
        to,
        valueWei,
        chainId
      });

      const raw = await activeProvider.request({
        method: 'eth_signTransaction',
        params: [
          {
            from: address,
            to,
            value: numberToHex(valueWei),
            nonce: prepared.nonce,
            gas: prepared.gas,
            gasPrice: prepared.gasPrice,
            chainId: numberToHex(chainId)
          }
        ]
      });
      if (typeof raw !== 'string' || !/^0x[0-9a-fA-F]+$/.test(raw)) {
        throw new Error('钱包未返回已签名 raw tx。');
      }

      setSignedTx(raw);
      setTxNotice('交易已签名；请点击“服务端广播”。');
    } catch (e) {
      setTxError(describeAccountError(e));
    } finally {
      setTxBusy(null);
    }
  }

  async function broadcastTransaction() {
    if (!session || !signedTx || !chainId) {
      setTxError('请先登录并完成交易签名。');
      return;
    }

    setTxBusy('broadcast');
    setTxError(null);
    setTxNotice(null);
    try {
      const result = await broadcastSignedTransaction(
        apiBase,
        session.csrfToken,
        chainId,
        signedTx
      );
      setTxHash(result.hash);
      setTxNotice('服务端已广播交易。');
    } catch (e) {
      if (e instanceof Error && 'code' in e && e.code === 'unauthorized') {
        setSession(null);
        setAuthError('登录已失效，请重新登录。');
      }
      setTxError(describeAccountError(e));
    } finally {
      setTxBusy(null);
    }
  }

  function updateTxTo(value: string) {
    setTxTo(value);
    setSignedTx(null);
    setTxHash(null);
    setTxNotice(null);
  }

  function updateTxValue(value: string) {
    setTxValueEth(value);
    setSignedTx(null);
    setTxHash(null);
    setTxNotice(null);
  }

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
          登录与交易广播（服务端广播）
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          登录使用一次性的 SIWE 风格消息 + 钱包{' '}
          <span className="font-mono text-xs">personal_sign</span>
          ；交易由扩展完成签名，Web 只把已签名 raw tx 交给服务端广播。
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          私钥与助记词始终只在扩展内；服务端需要配置{' '}
          <span className="font-mono text-xs">SERVER_RPC_URL</span>
          ，且其链 ID 应与钱包当前网络一致。
        </p>
      </header>

      {!apiBase ? (
        <PanelSection
          tone="amber"
          title="需要 API 基址"
          description="非开发构建未设置 NEXT_PUBLIC_API_URL。请在部署环境中配置后重新构建。"
        />
      ) : null}

      <AccountWalletSection
        walletName={walletName}
        address={address}
        chainId={chainId}
        busy={walletBusy}
        error={walletError}
        onConnect={() => void connectWallet()}
      />

      <AccountAuthSection
        address={address}
        challenge={challenge}
        signature={signature}
        session={session}
        busy={authBusy}
        error={authError}
        notice={authNotice}
        onRequestChallenge={() => void requestChallenge()}
        onSignChallenge={() => void signChallenge()}
        onVerifyLogin={() => void verifyLogin()}
        onLogout={logout}
      />

      <AccountTxSection
        address={address}
        session={session}
        txTo={txTo}
        txValueEth={txValueEth}
        signedTx={signedTx}
        txHash={txHash}
        txNotice={txNotice}
        txError={txError}
        busy={txBusy}
        onTxToChange={updateTxTo}
        onTxValueChange={updateTxValue}
        onSignTransaction={() => void signTransaction()}
        onBroadcast={() => void broadcastTransaction()}
      />
    </main>
  );
}
