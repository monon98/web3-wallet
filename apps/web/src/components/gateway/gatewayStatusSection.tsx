import { readJson, type ApiMeta, type EvmStatus } from '@/lib/gatewayHelpers';
import { PanelSection, UiBadge, UiSpinner } from '@plugin/ui';
import { useQuery } from '@tanstack/react-query';

import { ErrorNotice } from './resultBlocks';

type Props = {
  /** Fastify 基址（末尾无 `/`）；空串表示未配置 */
  apiBase: string;
};

/** 连接与状态：服务端可达性、服务端 RPC / Etherscan 配置与 bridge 方法枚举。 */
export function GatewayStatusSection({ apiBase }: Props) {
  const statusQuery = useQuery({
    queryKey: ['evm-status', apiBase],
    enabled: Boolean(apiBase),
    queryFn: async (): Promise<EvmStatus> => {
      const res = await fetch(`${apiBase}/api/v1/evm/status`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return readJson<EvmStatus>(res);
    }
  });

  const metaQuery = useQuery({
    queryKey: ['api-meta', apiBase],
    enabled: Boolean(apiBase),
    queryFn: async (): Promise<ApiMeta> => {
      const res = await fetch(`${apiBase}/api/v1/meta`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return readJson<ApiMeta>(res);
    }
  });

  return (
    <PanelSection title="连接与状态">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        请求目标：
        <span className="font-mono">{apiBase || '（未配置）'}</span>
      </p>

      {statusQuery.isPending && apiBase ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <UiSpinner size="sm" label="加载状态" />
          正在拉取状态…
        </p>
      ) : null}

      {statusQuery.isError ? (
        <ErrorNotice
          className="mt-2"
          message={`无法连接服务端：${(statusQuery.error as Error).message}。确认已启动 dev:server 且端口一致。`}
        />
      ) : null}

      {statusQuery.data ? (
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/50">
            <dt
              className="text-xs text-neutral-500 dark:text-neutral-400"
              title="SERVER_RPC_URL：用于 EVM JSON-RPC 转发与原生余额查询">
              服务端 RPC
            </dt>
            <dd className="mt-1">
              <UiBadge variant={statusQuery.data.rpc ? 'success' : 'warning'}>
                {statusQuery.data.rpc ? '已配置' : '未配置'}
              </UiBadge>
            </dd>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/50">
            <dt className="text-xs text-neutral-500 dark:text-neutral-400">
              Etherscan
            </dt>
            <dd className="mt-1">
              <UiBadge
                variant={statusQuery.data.etherscan ? 'success' : 'warning'}>
                {statusQuery.data.etherscan ? '已配置' : '未配置'}
              </UiBadge>
            </dd>
          </div>
        </dl>
      ) : null}

      {metaQuery.data ? (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          meta · bridgeMethods：{metaQuery.data.bridgeMethods.join(', ')}
        </p>
      ) : null}
    </PanelSection>
  );
}
