import {
  ErrorNotice,
  PartialErrorNotice
} from '@/components/common/resultBlocks';
import { EVM_CHAIN_OPTIONS, type BalancesFormState } from '@/lib/balancesApi';
import { getBalanceFamilyMeta } from '@/lib/balancesFamilies';
import {
  BALANCE_MAX_ADDRESSES_PER_CHAIN,
  type BalanceFamily
} from '@plugin/shared';
import {
  FieldHint,
  FieldLabel,
  PanelSection,
  SelectField,
  TextArea,
  UiButton
} from '@plugin/ui';

type Props = {
  family: BalanceFamily;
  form: BalancesFormState;
  onChange: (patch: Partial<BalancesFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
  notice: string | null;
  apiBaseConfigured: boolean;
};

/** 单链查询条件：EVM / Tron / BTC 各自独立页面，只展示当前链的字段。 */
export function BalancesQueryForm({
  family,
  form,
  onChange,
  onSubmit,
  onCancel,
  busy,
  error,
  notice,
  apiBaseConfigured
}: Props) {
  const meta = getBalanceFamilyMeta(family);
  const tokenOption =
    family === 'evm'
      ? {
          label: '查询 ERC-20 持仓（Etherscan）',
          checked: form.includeEvmTokens,
          onChange: (checked: boolean) =>
            onChange({ includeEvmTokens: checked })
        }
      : family === 'tron'
        ? {
            label: '返回 TRC-20 持仓',
            checked: form.includeTronTokens,
            onChange: (checked: boolean) =>
              onChange({ includeTronTokens: checked })
          }
        : null;

  return (
    <PanelSection
      title={`${meta.label} 查询条件`}
      description={`每个地址一行，最多 ${BALANCE_MAX_ADDRESSES_PER_CHAIN} 个；空行会被忽略，重复地址自动去重。`}>
      <div className="grid gap-4">
        {family === 'evm' ? (
          <div className="max-w-xs">
            <FieldLabel htmlFor="balances-evm-chain">EVM 链</FieldLabel>
            <SelectField
              id="balances-evm-chain"
              value={form.evmChainId}
              onChange={(event) =>
                onChange({ evmChainId: event.target.value })
              }>
              {EVM_CHAIN_OPTIONS.map((chain) => (
                <option key={chain.id} value={String(chain.id)}>
                  {chain.label}
                </option>
              ))}
            </SelectField>
          </div>
        ) : null}

        <div>
          <FieldLabel htmlFor={`balances-${family}-addresses`}>
            {meta.label} 地址（每行一个）
          </FieldLabel>
          <TextArea
            id={`balances-${family}-addresses`}
            rows={8}
            value={
              family === 'evm'
                ? form.evmAddresses
                : family === 'tron'
                  ? form.tronAddresses
                  : form.btcAddresses
            }
            onChange={(event) => {
              if (family === 'evm') {
                onChange({ evmAddresses: event.target.value });
              } else if (family === 'tron') {
                onChange({ tronAddresses: event.target.value });
              } else {
                onChange({ btcAddresses: event.target.value });
              }
            }}
            placeholder={meta.placeholder}
            spellCheck={false}
          />
          <FieldHint>
            {family === 'evm'
              ? 'EVM 地址会在提交前做 checksum 校验；完整链上校验由服务端复核。'
              : family === 'tron'
                ? 'Tron base58 地址；完整校验和由服务端复核。'
                : '仅支持 Bitcoin 主网；完整 base58check / bech32 校验由服务端复核。'}
          </FieldHint>
        </div>

        {tokenOption ? (
          <label className="flex items-center gap-2 text-sm text-[color:var(--ui-fg)]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--ui-primary)]"
              checked={tokenOption.checked}
              onChange={(event) => tokenOption.onChange(event.target.checked)}
            />
            {tokenOption.label}
          </label>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <UiButton
          variant="primary"
          size="lg"
          disabled={busy || !apiBaseConfigured}
          onClick={onSubmit}>
          {busy ? '查询中…' : '查询余额'}
        </UiButton>
        {busy ? (
          <UiButton variant="outline" size="lg" onClick={onCancel}>
            取消查询
          </UiButton>
        ) : null}
        <FieldHint>登录后可获得更高限额；未登录按 IP 限额查询。</FieldHint>
      </div>

      {notice ? <PartialErrorNotice message={notice} className="mt-3" /> : null}
      <ErrorNotice message={error} className="mt-3" />
    </PanelSection>
  );
}
