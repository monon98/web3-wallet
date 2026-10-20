import { ErrorNotice } from '@/components/gateway/resultBlocks';
import type { AuthChallenge, StoredAuthSession } from '@/lib/accountApi';
import {
  FieldHint,
  FieldLabel,
  PanelSection,
  TextArea,
  UiAlert,
  UiButton
} from '@plugin/ui';
import type { Address } from 'viem';

type Props = {
  address: Address | null;
  challenge: AuthChallenge | null;
  signature: string | null;
  session: StoredAuthSession | null;
  busy: 'challenge' | 'sign' | 'verify' | null;
  error: string | null;
  notice: string | null;
  onRequestChallenge: () => void;
  onSignChallenge: () => void;
  onVerifyLogin: () => void;
  onLogout: () => void;
};

function formatExpiry(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/** `/account` 第 2 步：challenge → personal_sign → 服务端校验并建立 Bearer 会话。 */
export function AccountAuthSection({
  address,
  challenge,
  signature,
  session,
  busy,
  error,
  notice,
  onRequestChallenge,
  onSignChallenge,
  onVerifyLogin,
  onLogout
}: Props) {
  return (
    <PanelSection
      title="2. 登录（SIWE 风格消息）"
      description="获取 challenge 后用钱包签名；服务端校验签名并签发 24 小时 Bearer 会话。">
      {!address ? (
        <FieldHint className="mb-2">
          请先连接钱包，再获取登录消息；已有会话仍会显示在下方。
        </FieldHint>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <UiButton
          variant="outline"
          size="sm"
          disabled={!address || busy !== null}
          onClick={onRequestChallenge}>
          {busy === 'challenge' ? '获取中…' : '获取登录消息'}
        </UiButton>
        <UiButton
          variant="outline"
          size="sm"
          disabled={!challenge || !address || busy !== null}
          onClick={onSignChallenge}>
          {busy === 'sign' ? '等待钱包签名…' : '用钱包签名'}
        </UiButton>
        <UiButton
          variant="primary"
          size="sm"
          disabled={!challenge || !signature || !address || busy !== null}
          onClick={onVerifyLogin}>
          {busy === 'verify' ? '验证中…' : '验证并登录'}
        </UiButton>
        {session ? (
          <UiButton
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={onLogout}>
            退出登录
          </UiButton>
        ) : null}
      </div>

      {challenge ? (
        <div className="mt-3">
          <FieldLabel htmlFor="accountChallenge">
            待签名消息（过期时间：{formatExpiry(challenge.expiresAt)}）
          </FieldLabel>
          <TextArea
            id="accountChallenge"
            readOnly
            rows={9}
            value={challenge.message}
            className="mt-1"
          />
        </div>
      ) : null}

      {signature ? (
        <p className="mt-2 break-all font-mono text-xs text-neutral-600 dark:text-neutral-400">
          签名：{signature}
        </p>
      ) : null}

      {session ? (
        <UiAlert variant="success" className="mt-3">
          已登录：<span className="font-mono">{session.address}</span>
          ；会话过期：{formatExpiry(session.expiresAt)}
        </UiAlert>
      ) : null}
      {notice ? (
        <UiAlert variant="success" className="mt-3">
          {notice}
        </UiAlert>
      ) : null}
      {error ? <ErrorNotice message={error} className="mt-3" /> : null}
    </PanelSection>
  );
}
