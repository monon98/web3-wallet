import { clearAuthSessionToken, readAuthSessionToken } from '@/lib/authSession';
import {
  BalancesApiError,
  describeBalancesError,
  queryBalances
} from '@/lib/balancesApi';
import type { BalanceQueryRequest, BalanceQueryResponse } from '@plugin/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * `/balances` 页的查询状态机：取消上一次请求、可选 Bearer 会话、401 自动降级为匿名。
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

      const token = readAuthSessionToken();
      try {
        let data: BalanceQueryResponse;
        try {
          data = await queryBalances(
            apiBase,
            request,
            token,
            controller.signal
          );
        } catch (e) {
          if (
            token &&
            e instanceof BalancesApiError &&
            e.code === 'unauthorized'
          ) {
            clearAuthSessionToken();
            data = await queryBalances(
              apiBase,
              request,
              null,
              controller.signal
            );
            setNotice('登录会话已失效，已改用匿名限额查询。');
          } else {
            throw e;
          }
        }

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
