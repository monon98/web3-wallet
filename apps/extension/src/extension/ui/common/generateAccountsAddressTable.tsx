import type { MouseEvent } from 'react';

import type { GeneratedTableRow } from '~lib/generateAccountsTabHelpers';

/**
 * 地址生成标签页用的结果表格（预览 / 待导出列表）。
 *
 * 上游：`tabs/generateAccounts.tsx`。仅展示与复制按钮；删除由父组件回调处理。
 */

function chainCellText(r: GeneratedTableRow): string {
  if (r.chain === 'btc' && r.btcScriptKind) {
    return `BTC · ${r.btcScriptKind} · ${r.btcNetwork === 'testnet' ? '测试网' : '主网'}`;
  }
  return r.chain.toUpperCase();
}

export function AddressRowsTable(props: {
  title: string;
  rows: readonly GeneratedTableRow[];
  rowIds?: readonly string[];
  showPrivateKey: boolean;
  onTableBodyClick: (e: MouseEvent<HTMLTableSectionElement>) => void;
  onRemoveRow?: (id: string) => void;
  emptyHint?: string;
}) {
  const { title, rows, rowIds, showPrivateKey, onTableBodyClick, onRemoveRow, emptyHint } = props;
  const removable = Boolean(onRemoveRow && rowIds && rowIds.length === rows.length);

  if (rows.length === 0) {
    return (
      <div className='rounded-md border border-white/15 bg-gray-800/40 p-3 text-xs text-white/70'>
        <div className='font-medium text-white/90'>{title}</div>
        {emptyHint ? <p className='mt-1'>{emptyHint}</p> : null}
      </div>
    );
  }

  return (
    <div className='overflow-x-auto rounded-md border border-white/20'>
      <div className='bg-gray-800 px-2 py-1 text-xs font-medium text-white/90'>{title}</div>
      <table className='w-full min-w-[36rem] border-collapse text-left text-xs'>
        <thead>
          <tr className='bg-gray-800'>
            {removable ? <th className='w-16 p-2'>操作</th> : null}
            <th className='p-2'>链</th>
            <th className='p-2'>路径</th>
            <th className='p-2'>主地址</th>
            <th className='p-2'>附加 (hex)</th>
            <th className='p-2'>BTC脚本</th>
            <th className='p-2'>BTC网络</th>
            {showPrivateKey ? (
              <>
                <th className='p-2'>私钥 (0x)</th>
                <th className='p-2'>私钥 (WIF)</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody onClick={onTableBodyClick}>
          {rows.map((r, i) => (
            <tr
              key={removable && rowIds ? rowIds[i] : `${r.path}-${i}`}
              className='border-b border-white/10 bg-gray-600/80'>
              {removable && rowIds && onRemoveRow ? (
                <td className='p-2 align-top'>
                  <button
                    type='button'
                    className='rounded bg-red-600/90 px-2 py-0.5 text-[10px] text-white hover:bg-red-500'
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRow(rowIds[i]!);
                    }}>
                    删除
                  </button>
                </td>
              ) : null}
              <td className='p-2 align-top'>{chainCellText(r)}</td>
              <td className='max-w-[10rem] break-all p-2 align-top font-mono'>{r.path}</td>
              <td className='p-2 align-top'>
                <div className='max-w-[14rem] break-all'>{r.addressMain}</div>
                <button
                  type='button'
                  className='mt-1 rounded bg-blue-500 px-2 py-0.5 text-[10px] text-white'
                  data-copy={r.addressMain}>
                  复制
                </button>
              </td>
              <td className='p-2 align-top'>
                {r.addressExtra ? (
                  <>
                    <div className='max-w-[12rem] break-all font-mono text-[10px]'>{r.addressExtra}</div>
                    <button
                      type='button'
                      className='mt-1 rounded bg-blue-500 px-2 py-0.5 text-[10px] text-white'
                      data-copy={r.addressExtra}>
                      复制
                    </button>
                  </>
                ) : (
                  <span className='text-white/50'>—</span>
                )}
              </td>
              <td className='p-2 align-top text-white/90'>{r.btcScriptKind ?? '—'}</td>
              <td className='p-2 align-top text-white/90'>{r.btcNetwork ?? '—'}</td>
              {showPrivateKey ? (
                <>
                  <td className='p-2 align-top'>
                    {r.privateKeyHex ? (
                      <>
                        <div className='max-w-[12rem] break-all font-mono text-[10px]'>
                          {r.privateKeyHex.slice(0, 12)}…{r.privateKeyHex.slice(-10)}
                        </div>
                        <button
                          type='button'
                          className='mt-1 rounded bg-blue-500 px-2 py-0.5 text-[10px] text-white'
                          data-copy={r.privateKeyHex}>
                          复制
                        </button>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className='p-2 align-top'>
                    {r.privateKeyWif ? (
                      <>
                        <div className='max-w-[12rem] break-all font-mono text-[10px]'>
                          {r.privateKeyWif.slice(0, 8)}…{r.privateKeyWif.slice(-8)}
                        </div>
                        <button
                          type='button'
                          className='mt-1 rounded bg-blue-500 px-2 py-0.5 text-[10px] text-white'
                          data-copy={r.privateKeyWif}>
                          复制
                        </button>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
