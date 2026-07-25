import { ADDRESS_GENERATOR_TAB_BATCH_MAX } from '~/constants';
import type {
  AddressGenerationChain,
  AddressJsonExportShape,
  AddressJsonFieldKey,
  AddressTableExportFormat,
  BtcAddressScriptKind,
  BtcNetworkKind
} from '~/types';
import { escapeCsvCell, prefixUtf8Bom } from '~lib/common/csvEscape';
import { downloadTextFile } from '~lib/common/downloadTextFile';
import {
  btcPrivateKeyBytesFromMnemonicPath,
  btcPrivateKeyToWif,
  defaultBtcHdPathTemplate,
  generateBtcAddressBatchFromMnemonic
} from '~web3/btc';
import { DEFAULT_EVM_HD_PATH_TEMPLATE, generateEvmAddressBatchFromMnemonic } from '~web3/evm/addressGenerator';
import { toHex } from '~web3/evm/viem';
import { mnemonicToAccountForHdPath } from '~web3/evm/viemAccounts';
import { DEFAULT_TVM_HD_PATH_TEMPLATE, generateTvmAddressBatchFromMnemonic } from '~web3/tvm/tvmAddressGenerator';

/** JSON 导出默认全字段勾选（与 `tabs/generateAccounts` 初始 state 对齐） */
export const DEFAULT_ADDRESS_JSON_FIELD_SELECTION: Readonly<Record<AddressJsonFieldKey, boolean>> = {
  chain: true,
  path: true,
  addressMain: true,
  addressExtra: true,
  btcScriptKind: true,
  btcNetwork: true,
  privateKeyHex: true,
  privateKeyWif: true
};

export type AddressJsonFieldSelection = Readonly<Record<AddressJsonFieldKey, boolean>>;

/**
 * **多链地址生成标签页** 纯逻辑（无 React）：汇总 EVM/TVM/BTC 派生与 CSV/JSON 导出。
 *
 * 物理路径放在 `extension/utils/`（`~lib/*`）而非 `src/tabs/`，与 **`~/constants`**、`~web3/*` 同 Parcel 图，避免仅 `tabs` 子包拆块时命名导出丢失（`buildGeneratedTableRows is not a function`）。
 *
 * 上游：`tabs/generateAccounts.tsx`。不落盘；`mnemonicToAccountForHdPath` / `toHex` 自 `~web3/evm/viemAccounts` 与 `~web3/evm/viem`（与 `~web3/base/hd` 派生路径分工一致）。
 */

export type GeneratedTableRow = Readonly<{
  chain: AddressGenerationChain;
  path: string;
  addressMain: string;
  addressExtra?: string;
  btcScriptKind?: BtcAddressScriptKind;
  btcNetwork?: BtcNetworkKind;
  privateKeyHex?: `0x${string}`;
  /** 仅 BTC + 展示私钥时填充（压缩 WIF）。 */
  privateKeyWif?: string;
}>;

export type BuildGeneratedRowsResult = { ok: true; rows: GeneratedTableRow[] } | { ok: false; error: string };

export type BuildGeneratedRowsInput = Readonly<{
  chain: AddressGenerationChain;
  btcScriptKind: BtcAddressScriptKind;
  btcNetwork: BtcNetworkKind;
  mnemonic: string;
  pathTemplate: string;
  startIndex: number;
  count: number;
  showPrivateKey: boolean;
}>;

export function buildGeneratedTableRows(input: BuildGeneratedRowsInput): BuildGeneratedRowsResult {
  const phrase = input.mnemonic.trim();
  const maxCount = ADDRESS_GENERATOR_TAB_BATCH_MAX;

  if (input.chain === 'evm') {
    const batch = generateEvmAddressBatchFromMnemonic({
      mnemonic: phrase,
      pathTemplate: input.pathTemplate,
      startIndex: input.startIndex,
      count: input.count,
      maxCount
    });
    if (batch.ok === false) {
      return batch;
    }
    const rows: GeneratedTableRow[] = batch.rows.map((r) => {
      let privateKeyHex: `0x${string}` | undefined;
      if (input.showPrivateKey) {
        const acc = mnemonicToAccountForHdPath(phrase, r.path);
        privateKeyHex = toHex(acc.getHdKey().privateKey);
      }
      return {
        chain: 'evm',
        path: r.path,
        addressMain: r.address,
        privateKeyHex
      };
    });
    return { ok: true, rows };
  }

  if (input.chain === 'tvm') {
    const batch = generateTvmAddressBatchFromMnemonic({
      mnemonic: phrase,
      pathTemplate: input.pathTemplate,
      startIndex: input.startIndex,
      count: input.count,
      maxCount
    });
    if (batch.ok === false) {
      return batch;
    }
    const rows: GeneratedTableRow[] = batch.rows.map((r) => {
      let privateKeyHex: `0x${string}` | undefined;
      if (input.showPrivateKey) {
        const acc = mnemonicToAccountForHdPath(phrase, r.path);
        privateKeyHex = toHex(acc.getHdKey().privateKey);
      }
      return {
        chain: 'tvm',
        path: r.path,
        addressMain: r.addressBase58,
        addressExtra: r.addressHex,
        privateKeyHex
      };
    });
    return { ok: true, rows };
  }

  const batch = generateBtcAddressBatchFromMnemonic({
    mnemonic: phrase,
    addressKind: input.btcScriptKind,
    btcNetwork: input.btcNetwork,
    pathTemplate: input.pathTemplate,
    startIndex: input.startIndex,
    count: input.count,
    maxCount
  });
  if (batch.ok === false) {
    return batch;
  }
  const rows: GeneratedTableRow[] = batch.rows.map((r) => {
    let privateKeyHex: `0x${string}` | undefined;
    let privateKeyWif: string | undefined;
    if (input.showPrivateKey) {
      const sk = btcPrivateKeyBytesFromMnemonicPath(phrase, r.path);
      if (sk) {
        privateKeyHex = toHex(sk);
        privateKeyWif = btcPrivateKeyToWif(sk, input.btcNetwork);
      }
    }
    return {
      chain: 'btc',
      path: r.path,
      addressMain: r.address,
      btcScriptKind: input.btcScriptKind,
      btcNetwork: input.btcNetwork,
      privateKeyHex,
      privateKeyWif
    };
  });
  return { ok: true, rows };
}

export type ChainPresetId = 'evm' | 'tvm' | 'btcNative' | 'btcTaproot';

export function applyChainPreset(id: ChainPresetId): {
  chain: AddressGenerationChain;
  btcScriptKind: BtcAddressScriptKind;
  btcNetwork: BtcNetworkKind;
  pathTemplate: string;
} {
  switch (id) {
    case 'evm':
      return {
        chain: 'evm',
        btcScriptKind: 'p2wpkh',
        btcNetwork: 'mainnet',
        pathTemplate: DEFAULT_EVM_HD_PATH_TEMPLATE
      };
    case 'tvm':
      return {
        chain: 'tvm',
        btcScriptKind: 'p2wpkh',
        btcNetwork: 'mainnet',
        pathTemplate: DEFAULT_TVM_HD_PATH_TEMPLATE
      };
    case 'btcNative':
      return {
        chain: 'btc',
        btcScriptKind: 'p2wpkh',
        btcNetwork: 'mainnet',
        pathTemplate: defaultBtcHdPathTemplate('mainnet', 'p2wpkh')
      };
    case 'btcTaproot':
      return {
        chain: 'btc',
        btcScriptKind: 'p2tr',
        btcNetwork: 'mainnet',
        pathTemplate: defaultBtcHdPathTemplate('mainnet', 'p2tr')
      };
    default: {
      const _e: never = id;
      return _e;
    }
  }
}

function chainLabel(c: AddressGenerationChain): string {
  switch (c) {
    case 'evm':
      return 'EVM';
    case 'tvm':
      return 'TVM';
    case 'btc':
      return 'BTC';
    default: {
      const _x: never = c;
      return _x;
    }
  }
}

function mapRowToJsonFields(
  r: GeneratedTableRow,
  showPrivateKey: boolean,
  fields: AddressJsonFieldSelection
): Record<string, string> {
  const o: Record<string, string> = {};
  if (fields.chain) {
    o.chain = r.chain;
  }
  if (fields.path) {
    o.path = r.path;
  }
  if (fields.addressMain) {
    o.addressMain = r.addressMain;
  }
  if (fields.addressExtra && r.addressExtra) {
    o.addressExtra = r.addressExtra;
  }
  if (fields.btcScriptKind && r.btcScriptKind) {
    o.btcScriptKind = r.btcScriptKind;
  }
  if (fields.btcNetwork && r.btcNetwork) {
    o.btcNetwork = r.btcNetwork;
  }
  if (showPrivateKey && fields.privateKeyHex && r.privateKeyHex) {
    o.privateKeyHex = r.privateKeyHex;
  }
  if (showPrivateKey && fields.privateKeyWif && r.privateKeyWif) {
    o.privateKeyWif = r.privateKeyWif;
  }
  return o;
}

/**
 * 多链混合列表：固定宽表头，便于多次追加后统一导出。
 */
export function buildAddressTableCsv(rows: readonly GeneratedTableRow[], opts: { showPrivateKey: boolean }): string {
  const headers = ['链', '路径', '主地址', '附加地址', 'BTC脚本', 'BTC网络'];
  if (opts.showPrivateKey) {
    headers.push('私钥(0x)', '私钥(WIF)');
  }
  const lines = [
    headers.join(','),
    ...rows.map((r) => {
      const cells = [
        chainLabel(r.chain),
        r.path,
        r.addressMain,
        r.addressExtra ?? '',
        r.btcScriptKind ?? '',
        r.btcNetwork ?? ''
      ];
      if (opts.showPrivateKey) {
        cells.push(r.privateKeyHex ?? '', r.privateKeyWif ?? '');
      }
      return cells.map((c) => escapeCsvCell(String(c))).join(',');
    })
  ];
  return prefixUtf8Bom(lines.join('\r\n'));
}

export function buildAddressTableJson(
  rows: readonly GeneratedTableRow[],
  opts: {
    showPrivateKey: boolean;
    shape: AddressJsonExportShape;
    fields: AddressJsonFieldSelection;
  }
): string {
  const mapped = rows.map((r) => mapRowToJsonFields(r, opts.showPrivateKey, opts.fields));
  if (opts.shape === 'envelope') {
    const envelope = {
      schema: 'address-generator/v1' as const,
      exportedAt: new Date().toISOString(),
      rowCount: mapped.length,
      rows: mapped
    };
    return `${JSON.stringify(envelope, null, 2)}\n`;
  }
  return `${JSON.stringify(mapped, null, 2)}\n`;
}

export function exportAddressTable(
  rows: readonly GeneratedTableRow[],
  format: AddressTableExportFormat,
  opts: {
    showPrivateKey: boolean;
    jsonShape?: AddressJsonExportShape;
    jsonFields?: AddressJsonFieldSelection;
  }
): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `addresses-bundle-${stamp}`;
  if (format === 'csv') {
    const csv = buildAddressTableCsv(rows, { showPrivateKey: opts.showPrivateKey });
    downloadTextFile(`${baseName}.csv`, csv, 'text/csv;charset=utf-8');
    return;
  }
  const json = buildAddressTableJson(rows, {
    showPrivateKey: opts.showPrivateKey,
    shape: opts.jsonShape ?? 'envelope',
    fields: opts.jsonFields ?? DEFAULT_ADDRESS_JSON_FIELD_SELECTION
  });
  downloadTextFile(`${baseName}.json`, json, 'application/json;charset=utf-8');
}
