import type { WalletViewGlobalSettingsProps } from '~/types';

import { FormModuleFrame } from '../layout/formModuleFrame';
import { ConnectedSitesSection } from '../sections/connectedSitesSection';
import { DefaultChainAccountsSection } from '../sections/defaultChainAccountsSection';
import { EvmTxSubmitModeSection } from '../sections/evmTxSubmitModeSection';
import { SiteAuthPolicySection } from '../sections/siteAuthPolicySection';

/**
 * **子页**：DApp 全局偏好一页聚合——默认 EVM/TVM 账户、交易提交方式、已连接网站、站点授权策略（与 `~lib/walletUi/globalSettings` 概念对齐）。
 */
export function WalletViewGlobalSettings({
  evmDefaultAccount,
  tvmDefaultAccount,
  evmTxSubmitMode,
  onEvmTxSubmitModeChange,
  sessions,
  onRevokeOrigin,
  onRevokeAll,
  authPolicy,
  onPolicyChange,
  authTimedMinutes,
  onTimedMinutesChange,
  onSave
}: WalletViewGlobalSettingsProps) {
  return (
    <div className='flex flex-col gap-6'>
      <FormModuleFrame resetSectionMargin>
        <DefaultChainAccountsSection evmDefaultAccount={evmDefaultAccount} tvmDefaultAccount={tvmDefaultAccount} />
      </FormModuleFrame>
      <FormModuleFrame resetSectionMargin>
        <EvmTxSubmitModeSection
          variant='panel'
          evmTxSubmitMode={evmTxSubmitMode}
          onEvmTxSubmitModeChange={onEvmTxSubmitModeChange}
        />
      </FormModuleFrame>
      <FormModuleFrame resetSectionMargin>
        <ConnectedSitesSection
          variant='panel'
          sessions={sessions}
          onRevokeOrigin={onRevokeOrigin}
          onRevokeAll={onRevokeAll}
        />
      </FormModuleFrame>
      <FormModuleFrame resetSectionMargin>
        <SiteAuthPolicySection
          variant='panel'
          authPolicy={authPolicy}
          onPolicyChange={onPolicyChange}
          authTimedMinutes={authTimedMinutes}
          onTimedMinutesChange={onTimedMinutesChange}
          onSave={onSave}
        />
      </FormModuleFrame>
    </div>
  );
}
