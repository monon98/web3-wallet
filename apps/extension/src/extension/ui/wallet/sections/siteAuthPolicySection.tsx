import { FieldLabel, PanelSection, SelectField, TextInput, UiButton } from '@plugin/ui';

import type { SiteAuthPolicy, SiteAuthPolicySectionProps } from '~/types';

/** 编辑 `SiteAuthSettings` 并保存；影响**下一次** `authorizeSiteSession` 写入的会话形状。 */
export function SiteAuthPolicySection({
  variant = 'panel',
  authPolicy,
  onPolicyChange,
  authTimedMinutes,
  onTimedMinutesChange,
  onSave
}: SiteAuthPolicySectionProps) {
  const fields = (
    <>
      <FieldLabel htmlFor='wallet-auth-policy' className='text-[var(--ui-fg)] opacity-100'>
        策略
      </FieldLabel>
      <SelectField
        id='wallet-auth-policy'
        value={authPolicy}
        onChange={(e) => onPolicyChange(e.target.value as SiteAuthPolicy)}>
        <option value='per_reload'>当前标签（刷新或关标签后失效）</option>
        <option value='timed'>定时（按分钟过期）</option>
        <option value='persistent'>持久（点「断开」前一直有效）</option>
      </SelectField>
      {authPolicy === 'timed' ? (
        <>
          <FieldLabel htmlFor='wallet-auth-mins' className='text-[var(--ui-fg)] opacity-100'>
            有效时长（分钟，1–10080）
          </FieldLabel>
          <TextInput
            id='wallet-auth-mins'
            type='number'
            min={1}
            max={10080}
            value={authTimedMinutes}
            onChange={(e) => onTimedMinutesChange(e.target.value)}
            className='mb-2'
          />
        </>
      ) : null}
      <UiButton variant='secondary' size='sm' onClick={() => void onSave()}>
        保存策略
      </UiButton>
    </>
  );

  if (variant === 'plain') {
    return (
      <div className='space-y-2'>
        <p className='text-[11px] leading-snug text-[var(--ui-muted-fg)]'>
          批准后授权保持多久；「当前标签」下刷新或关标签需重连；「定时」对所有标签同一站点生效。
        </p>
        {fields}
      </div>
    );
  }

  return (
    <PanelSection
      title='站点连接授权策略'
      description='选择批准后授权保持多久。「当前标签」下刷新页面或关闭标签后需重新连接；「定时」对所有标签同一站点生效。'
      tone='default'>
      {fields}
    </PanelSection>
  );
}
