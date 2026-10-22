import type { BalanceFamily } from '@plugin/shared';

/**
 * 多链余额页的链元信息。
 *
 * 每条链使用独立路由与独立表单，避免三组输入和结果挤在同一页；
 * 统一 API 仍然保留，页面只提交当前链对应的一个 group。
 */

export type BalanceFamilyMeta = {
  family: BalanceFamily;
  /** 导航 / 标签用短名称 */
  label: string;
  /** 页面标题 */
  title: string;
  /** 入口卡片说明 */
  description: string;
  /** 子路由 */
  href: string;
  /** 地址输入框占位符 */
  placeholder: string;
};

export const BALANCE_FAMILY_ORDER: BalanceFamily[] = ['evm', 'tron', 'btc'];

export const BALANCE_FAMILY_META: Record<BalanceFamily, BalanceFamilyMeta> = {
  evm: {
    family: 'evm',
    label: 'EVM',
    title: 'EVM 余额查询',
    description:
      'Ethereum 及其他内置 EVM 链的原生币与 ERC-20 持仓，原生余额优先走服务端 RPC。',
    href: '/balances/evm',
    placeholder: '0x…\n0x…'
  },
  tron: {
    family: 'tron',
    label: 'Tron',
    title: 'Tron 余额查询',
    description: 'TRX 余额与 TRC-20 持仓，数据来自 TronGrid。',
    href: '/balances/tron',
    placeholder: 'T…\nT…'
  },
  btc: {
    family: 'btc',
    label: 'BTC',
    title: 'BTC 余额查询',
    description:
      'Bitcoin 主网已确认余额、内存池净变化与交易数，数据来自 Esplora。',
    href: '/balances/btc',
    placeholder: 'bc1… / 1… / 3…'
  }
};

export function getBalanceFamilyMeta(family: BalanceFamily): BalanceFamilyMeta {
  return BALANCE_FAMILY_META[family];
}
