import {
  describeBalancesError,
  queryBalances
} from '@/lib/balancesApi';
import type { BalanceQueryRequest, BalanceQueryResponse } from '@plugin/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * `/balances` 页的查询状态机：取消上一次请求；浏览器自动携带 HttpOnly Cookie 会话。
 * 服务端对过期 Cookie 会清除并按匿名限额继续，因此前端无需再读取 token。
 * 只保存公开查询结果；不接触钱包私钥或签名。
 */

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export function useBalancesQuery(apiBase: string): {
  result: BalanceQueryResponse | null;
  busy: boolean;
  error: string | null;
  notice: string | null;
  query: (request: BalanceQueryRequest) => Promise<void>;
  cancel: () => void;
} {
  const [result, setResult] = useState<BalanceQueryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const query = useCallback(
    async (request: BalanceQueryRequest) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setBusy(true);
      setError(null);
      setNotice(null);
      setResult(null);

      try {
        const data = await queryBalances(apiBase, request, controller.signal);
        if (!controller.signal.aborted) {
          setResult(data);
        }
      } catch (e) {
        if (controller.signal.aborted || isAbortError(e)) {
          if (abortRef.current === controller) {
            setNotice('已取消本次查询。');
          }
          return;
        }
        setError(describeBalancesError(e));
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setBusy(false);
        }
      }
    },
    [apiBase]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { result, busy, error, notice, query, cancel };
}
