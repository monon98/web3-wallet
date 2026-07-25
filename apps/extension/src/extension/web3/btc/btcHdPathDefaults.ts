import type { BtcAddressScriptKind, BtcNetworkKind } from '~/types/addressGeneration';

/**
 * **BTC HD 默认路径模板**（纯字符串）：供标签页与 `btcAddressGenerator` 共用。
 *
 * 主网 coin type `0'`、测试网 `1'`（BIP44 测试网约定）。
 */

function coinSeg(network: BtcNetworkKind): '0' | '1' {
  return network === 'mainnet' ? '0' : '1';
}

/** 给定网络与脚本类型，返回默认路径模板（含 `{index}` 占位符）。 */
export function defaultBtcHdPathTemplate(network: BtcNetworkKind, kind: BtcAddressScriptKind): string {
  const c = coinSeg(network);
  switch (kind) {
    case 'p2pkh':
      return `m/44'/${c}'/0'/0/{index}`;
    case 'p2sh-p2wpkh':
      return `m/49'/${c}'/0'/0/{index}`;
    case 'p2wpkh':
      return `m/84'/${c}'/0'/0/{index}`;
    case 'p2tr':
      return `m/86'/${c}'/0'/0/{index}`;
    default: {
      const _e: never = kind;
      return _e;
    }
  }
}
