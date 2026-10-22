import { CollapsibleSection, UiAlert } from '@plugin/ui';

type ErrorNoticeProps = {
  message: string | null;
  className?: string;
};

/** 请求失败提示（块级，`role="alert"`）；空消息不渲染。 */
export function ErrorNotice({ message, className = '' }: ErrorNoticeProps) {
  if (!message) {
    return null;
  }
  return (
    <UiAlert variant="error" className={className}>
      {message}
    </UiAlert>
  );
}

type PartialErrorNoticeProps = {
  message: string;
  className?: string;
};

/** 批量中单个地址 / 单条链失败：条目级警告（不阻断其它结果）。 */
export function PartialErrorNotice({
  message,
  className = ''
}: PartialErrorNoticeProps) {
  return (
    <p className={`text-sm text-[color:var(--ui-warning)] ${className}`.trim()}>
      {message}
    </p>
  );
}

type RawResultProps = {
  /** 成功时为 JSON 文本；非 JSON 按错误消息展示 */
  raw: string | null;
  className?: string;
  preClassName?: string;
};

/** 调试用原始响应：JSON 收进可折叠区块，错误消息按块级提示展示。 */
export function RawResult({
  raw,
  className = 'mt-3',
  preClassName = 'max-h-72'
}: RawResultProps) {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return <ErrorNotice message={raw} className={className} />;
  }

  return (
    <CollapsibleSection
      className={className}
      title="原始 JSON"
      summary="调试 / 对接用"
      defaultOpen={false}>
      <pre
        className={`${preClassName} overflow-auto font-mono text-[11px] leading-relaxed`}>
        {raw}
      </pre>
    </CollapsibleSection>
  );
}
