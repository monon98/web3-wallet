import { ErrorNotice } from '@/components/gateway/resultBlocks';
import type { StoredAuthSession } from '@/lib/accountApi';
import {
  FieldHint,
  FieldLabel,
  PanelSection,
  TextArea,
  TextInput,
  UiAlert,
  UiButton
} from '@plugin/ui';
import type { Address } from 'viem';

type Props = {
  address: Address | null;
  session: StoredAuthSession | null;
  txTo: string;
  txValueEth: string;
  signedTx: string | null;
  txHash: string | null;
  txNotice: string | null;
  txError: string | null;
  busy: 'sign' | 'broadcast' | null;
  onTxToChange: (value: string) => void;
  onTxValueChange: (value: string) => void;
  onSignTransaction: () => void;
  onBroadcast: () => void;
};

/**
 * `/account` 第 3 步：服务端读取 nonce / gas，扩展 `eth_signTransaction`，
 * 再把已签名 raw tx 交回服务端广播。
 */
export function AccountTxSection({
  address,
  session,
  txTo,
  txValueEth,
  signedTx,
  txHash,
  txNotice,
  txError,
  busy,
  onTxToChange,
  onTxValueChange,
  onSignTransaction,
  onBroadcast
}: Props) {
  return (
    <PanelSection
      title="3. 签名并广播交易"
      description="服务端通过 JSON-RPC 读取 nonce / gas / gasPrice；扩展只返回已签名 raw tx，不发送私钥。">
      {!session ? (
        <FieldHint>请先完成登录，再签名并广播交易。</FieldHint>
      ) : !address ? (
        <FieldHint>已有登录会话；请连接钱包后继续签名和广播。</FieldHint>
      ) : (
        <>
          {session.address !== address ? (
            <UiAlert variant="error" className="mb-3">
              当前钱包地址与会话地址不一致，请重新连接并登录。
            </UiAlert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="accountTxTo">接收地址</FieldLabel>
              <TextInput
                id="accountTxTo"
                className="mt-1"
                value={txTo}
                placeholder="0x..."
                onChange={(event) => onTxToChange(event.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="accountTxValue">金额（ETH）</FieldLabel>
              <TextInput
                id="accountTxValue"
                className="mt-1"
                inputMode="decimal"
                value={txValueEth}
                placeholder="0"
                onChange={(event) => onTxValueChange(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <UiButton
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={onSignTransaction}>
              {busy === 'sign' ? '等待扩展签名…' : '1. 签名交易'}
            </UiButton>
            <UiButton
              variant="primary"
              size="sm"
              disabled={!signedTx || busy !== null}
              onClick={onBroadcast}>
              {busy === 'broadcast' ? '广播中…' : '2. 服务端广播'}
            </UiButton>
          </div>

          {signedTx ? (
            <div className="mt-3">
              <FieldLabel htmlFor="accountSignedTx">
                已签名 raw transaction
              </FieldLabel>
              <TextArea
                id="accountSignedTx"
                readOnly
                rows={4}
                value={signedTx}
                className="mt-1"
              />
            </div>
          ) : null}

          {txNotice ? (
            <UiAlert variant="success" className="mt-3">
              {txNotice}
            </UiAlert>
          ) : null}
          {txHash ? (
            <UiAlert variant="success" className="mt-3">
              交易哈希：
              <span className="break-all font-mono text-xs">{txHash}</span>
            </UiAlert>
          ) : null}
          {txError ? <ErrorNotice message={txError} className="mt-3" /> : null}
        </>
      )}
    </PanelSection>
  );
}
