import { ErrorNotice } from '@/components/common/resultBlocks';
import { PanelSection, UiBadge, UiButton } from '@plugin/ui';
import type { Address } from 'viem';

type Props = {
  /** EIP-6963 钱包名或 `window.ethereum` 回退标识 */
  walletName: string;
  address: Address | null;
  chainId: number | null;
  busy: boolean;
  error: string | null;
  onConnect: () => void;
};

/** `/account` 第 1 步：连接钱包并展示当前地址 / chainId。 */
export function AccountWalletSection({
  walletName,
  address,
  chainId,
  busy,
  error,
  onConnect
}: Props) {
  return (
    <PanelSection
      title="1. 连接钱包"
      description={`当前 provider：${walletName}。连接后读取地址与 chainId。`}>
      <div className="flex flex-wrap items-center gap-2">
        <UiButton
          variant="primary"
          size="md"
          disabled={busy}
          onClick={onConnect}>
          {busy ? '等待钱包确认…' : '连接钱包'}
        </UiButton>
        <UiBadge variant={address ? 'success' : 'neutral'}>
          {address ? '已连接' : '未连接'}
        </UiBadge>
        {chainId ? <UiBadge variant="info">chainId {chainId}</UiBadge> : null}
      </div>
      {address ? (
        <p className="mt-2 break-all font-mono text-xs text-neutral-600 dark:text-neutral-400">
          {address}
        </p>
      ) : null}
      {error ? <ErrorNotice message={error} className="mt-3" /> : null}
    </PanelSection>
  );
}
