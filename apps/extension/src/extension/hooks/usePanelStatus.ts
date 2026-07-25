import { useCallback, useState } from 'react';

export type PanelStatus = { kind: 'idle' | 'ok' | 'err'; text: string };

/**
 * 侧栏 **操作反馈文案**（成功 / 错误 / 空闲），与 {@link UiAlert} 展示对应。
 */
export function usePanelStatus() {
  const [status, setStatus] = useState<PanelStatus>({
    kind: 'idle',
    text: ''
  });

  const showStatus = useCallback((kind: 'idle' | 'ok' | 'err', text: string) => {
    setStatus({ kind, text });
  }, []);

  return { status, showStatus };
}
