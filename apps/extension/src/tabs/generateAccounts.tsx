import '~/assets/style.css';

import { useCallback, useState, type MouseEvent } from 'react';

import { AddressRowsTable } from '~/components/common/generateAccountsAddressTable';
import { ADDRESS_GENERATOR_TAB_BATCH_MAX, ADDRESS_GENERATOR_TAB_LIST_MAX } from '~/constants';
import type {
  AddressGenerationChain,
  AddressJsonExportShape,
  AddressJsonFieldKey,
  AddressTableExportFormat,
  BtcAddressScriptKind,
  BtcNetworkKind
} from '~/types';
import { openTab } from '~lib/extension';
import {
  applyChainPreset,
  buildGeneratedTableRows,
  DEFAULT_ADDRESS_JSON_FIELD_SELECTION,
  exportAddressTable,
  type AddressJsonFieldSelection,
  type ChainPresetId,
  type GeneratedTableRow
} from '~lib/generateAccountsTabHelpers';
import { generateMnemonic, validateMnemonic } from '~web3';
import { defaultBtcHdPathTemplate } from '~web3/btc';
import { DEFAULT_EVM_HD_PATH_TEMPLATE } from '~web3/evm/addressGenerator';
import { DEFAULT_TVM_HD_PATH_TEMPLATE } from '~web3/tvm/tvmAddressGenerator';

/**
 * **新标签页**：EVM / TVM / Bitcoin 助记词 HD 批量派生（`~web3/*` 派生模块），**不写入** `vault` 持久化。
 * 支持多次「生成 → 加入导出列表」后统一导出 CSV / 可配置 JSON；列表可单条删除整理。
 */

const BTC_SCRIPT_LABELS: { value: BtcAddressScriptKind; label: string }[] = [
  { value: 'p2pkh', label: 'Legacy (P2PKH, BIP44)' },
  { value: 'p2sh-p2wpkh', label: 'Nested SegWit (P2SH-P2WPKH, BIP49)' },
  { value: 'p2wpkh', label: 'Native SegWit (P2WPKH, BIP84)' },
  { value: 'p2tr', label: 'Taproot (P2TR, BIP86)' }
];

const PRESET_BUTTONS: { id: ChainPresetId; label: string }[] = [
  { id: 'evm', label: 'EVM 标准' },
  { id: 'tvm', label: 'TVM(Tron) 标准' },
  { id: 'btcNative', label: 'BTC Native SegWit' },
  { id: 'btcTaproot', label: 'BTC Taproot' }
];

const JSON_FIELD_LABELS: { key: AddressJsonFieldKey; label: string }[] = [
  { key: 'chain', label: 'chain' },
  { key: 'path', label: 'path' },
  { key: 'addressMain', label: 'addressMain' },
  { key: 'addressExtra', label: 'addressExtra' },
  { key: 'btcScriptKind', label: 'btcScriptKind' },
  { key: 'btcNetwork', label: 'btcNetwork' },
  { key: 'privateKeyHex', label: 'privateKeyHex' },
  { key: 'privateKeyWif', label: 'privateKeyWif' }
];

function newSavedEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function Newtab() {
  const [inputMnemonic, setInputMnemonic] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [chain, setChain] = useState<AddressGenerationChain>('evm');
  const [btcScriptKind, setBtcScriptKind] = useState<BtcAddressScriptKind>('p2wpkh');
  const [btcNetwork, setBtcNetwork] = useState<BtcNetworkKind>('mainnet');
  const [pathTemplate, setPathTemplate] = useState<string>(DEFAULT_EVM_HD_PATH_TEMPLATE);
  const [startIndex, setStartIndex] = useState(0);
  const [count, setCount] = useState(5);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [exportFormat, setExportFormat] = useState<AddressTableExportFormat>('csv');
  const [jsonShape, setJsonShape] = useState<AddressJsonExportShape>('envelope');
  const [jsonFields, setJsonFields] = useState<AddressJsonFieldSelection>(() => ({
    ...DEFAULT_ADDRESS_JSON_FIELD_SELECTION
  }));
  const [previewRows, setPreviewRows] = useState<GeneratedTableRow[]>([]);
  const [savedEntries, setSavedEntries] = useState<{ id: string; row: GeneratedTableRow }[]>([]);
  const [error, setError] = useState('');

  const clearPreview = useCallback(() => {
    setPreviewRows([]);
  }, []);

  const clearSaved = useCallback(() => {
    setSavedEntries([]);
  }, []);

  const applyPreset = (id: ChainPresetId) => {
    const next = applyChainPreset(id);
    setChain(next.chain);
    setBtcScriptKind(next.btcScriptKind);
    setBtcNetwork(next.btcNetwork);
    setPathTemplate(next.pathTemplate);
    setError('');
  };

  const handleChainSelect = (c: AddressGenerationChain) => {
    setChain(c);
    clearPreview();
    setError('');
    if (c === 'evm') {
      setPathTemplate(DEFAULT_EVM_HD_PATH_TEMPLATE);
    } else if (c === 'tvm') {
      setPathTemplate(DEFAULT_TVM_HD_PATH_TEMPLATE);
    } else {
      setPathTemplate(defaultBtcHdPathTemplate(btcNetwork, btcScriptKind));
    }
  };

  const handleBtcScriptChange = (k: BtcAddressScriptKind) => {
    setBtcScriptKind(k);
    clearPreview();
    setError('');
    if (chain === 'btc') {
      setPathTemplate(defaultBtcHdPathTemplate(btcNetwork, k));
    }
  };

  const handleBtcNetworkChange = (n: BtcNetworkKind) => {
    setBtcNetwork(n);
    clearPreview();
    setError('');
    if (chain === 'btc') {
      setPathTemplate(defaultBtcHdPathTemplate(n, btcScriptKind));
    }
  };

  const handleGenerate = () => {
    setError('');
    if (!mnemonic) {
      setError('请先设置助记词');
      return;
    }
    const built = buildGeneratedTableRows({
      chain,
      btcScriptKind,
      btcNetwork,
      mnemonic,
      pathTemplate,
      startIndex,
      count,
      showPrivateKey
    });
    if (built.ok === false) {
      setError(built.error);
      setPreviewRows([]);
      return;
    }
    setPreviewRows(built.rows);
  };

  const handleAddToExportList = () => {
    if (previewRows.length === 0) {
      return;
    }
    const nextLen = savedEntries.length + previewRows.length;
    if (nextLen > ADDRESS_GENERATOR_TAB_LIST_MAX) {
      setError(
        `导出列表最多 ${ADDRESS_GENERATOR_TAB_LIST_MAX} 条，当前共 ${savedEntries.length} 条，本批 ${previewRows.length} 条将超出`
      );
      return;
    }
    const appended = previewRows.map((row) => ({ id: newSavedEntryId(), row }));
    setSavedEntries((prev) => [...prev, ...appended]);
    setPreviewRows([]);
    setError('');
  };

  const handleRemoveSaved = (id: string) => {
    setSavedEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSetMnemonic = () => {
    setError('');
    if (validateMnemonic(inputMnemonic)) {
      setMnemonic(inputMnemonic.trim());
      setInputMnemonic('');
      clearPreview();
      clearSaved();
    } else {
      setError('助记词不合法');
    }
  };

  const handleCopy = (e: MouseEvent<HTMLTableSectionElement>) => {
    const el = e.target as HTMLElement;
    const btn = el.closest('button[data-copy]');
    const copyData = btn?.getAttribute('data-copy');
    if (!copyData) {
      return;
    }
    void navigator.clipboard.writeText(copyData);
  };

  const handleExport = () => {
    if (savedEntries.length === 0) {
      return;
    }
    const rows = savedEntries.map((e) => e.row);
    exportAddressTable(rows, exportFormat, {
      showPrivateKey,
      jsonShape,
      jsonFields
    });
  };

  const toggleJsonField = (key: AddressJsonFieldKey, checked: boolean) => {
    setJsonFields((prev) => ({ ...prev, [key]: checked }));
  };

  const savedRows = savedEntries.map((e) => e.row);
  const savedIds = savedEntries.map((e) => e.id);

  return (
    <div className='flex min-h-[100dvh] flex-col items-stretch gap-3 rounded-xl bg-green-700 p-6 text-left text-sm text-white'>
      <h1 className='text-center text-lg font-semibold'>多链地址生成器</h1>
      <p className='text-center text-xs text-white/80'>
        只读派生、不落盘。打开侧栏：{' '}
        <button type='button' className='underline' onClick={() => openTab('sidepanel.html')}>
          侧栏钱包
        </button>
      </p>

      <section className='rounded-lg bg-white/10 p-3'>
        <p className='mb-2 text-xs font-medium text-white/90'>快捷预设（四种）</p>
        <div className='flex flex-wrap gap-2'>
          {PRESET_BUTTONS.map((p) => (
            <button
              key={p.id}
              type='button'
              className='rounded-md bg-emerald-800/90 px-3 py-1.5 text-xs text-white hover:bg-emerald-700'
              onClick={() => applyPreset(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <div className='flex flex-wrap gap-2'>
        <input
          className='min-w-[12rem] flex-1 rounded-md px-2 py-1 text-[var(--ui-fg)]'
          placeholder='输入助记词'
          onChange={(e) => setInputMnemonic(e.target.value)}
          value={inputMnemonic}
        />
        <button type='button' className='rounded-md bg-blue-500 px-3 py-1 text-white' onClick={handleSetMnemonic}>
          设置助记词
        </button>
        <button
          type='button'
          className='rounded-md bg-red-500 px-3 py-1 text-white'
          onClick={() => {
            setError('');
            setMnemonic(generateMnemonic());
            clearPreview();
            clearSaved();
          }}>
          生成新助记词
        </button>
      </div>

      {mnemonic ? (
        <div className='rounded-md bg-gray-600 px-3 py-2 text-sm'>
          <div className='font-medium'>当前助记词（请妥善保管，勿用于主网资金）</div>
          <div className='mt-1 break-words'>{mnemonic}</div>
        </div>
      ) : null}

      <div className='grid gap-3 sm:grid-cols-2'>
        <label className='flex flex-col gap-1 text-xs'>
          目标链
          <select
            className='rounded-md px-2 py-1.5 text-[var(--ui-fg)]'
            value={chain}
            onChange={(e) => handleChainSelect(e.target.value as AddressGenerationChain)}>
            <option value='evm'>EVM</option>
            <option value='tvm'>TVM (Tron)</option>
            <option value='btc'>Bitcoin</option>
          </select>
        </label>
        {chain === 'btc' ? (
          <label className='flex flex-col gap-1 text-xs'>
            BTC 地址类型
            <select
              className='rounded-md px-2 py-1.5 text-[var(--ui-fg)]'
              value={btcScriptKind}
              onChange={(e) => handleBtcScriptChange(e.target.value as BtcAddressScriptKind)}>
              {BTC_SCRIPT_LABELS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {chain === 'btc' ? (
        <label className='flex max-w-xs flex-col gap-1 text-xs'>
          BTC 网络
          <select
            className='rounded-md px-2 py-1.5 text-[var(--ui-fg)]'
            value={btcNetwork}
            onChange={(e) => handleBtcNetworkChange(e.target.value as BtcNetworkKind)}>
            <option value='mainnet'>主网</option>
            <option value='testnet'>测试网</option>
          </select>
        </label>
      ) : null}

      <div className='flex flex-wrap items-center gap-4 text-xs'>
        <label className='inline-flex cursor-pointer items-center gap-2'>
          <input type='checkbox' checked={showPrivateKey} onChange={(e) => setShowPrivateKey(e.target.checked)} />
          显示私钥列
        </label>
        <span className='text-[10px] text-white/70'>私钥仅在勾选后点击「生成」时派生；改选项后请重新生成。</span>
      </div>

      <div className='flex flex-col gap-2 rounded-lg border border-white/15 bg-white/5 p-3'>
        <p className='text-xs font-medium text-white/90'>导出</p>
        <div className='flex flex-wrap items-center gap-3'>
          <label className='inline-flex items-center gap-2'>
            表格 / 文件格式
            <select
              className='rounded-md px-2 py-1 text-[var(--ui-fg)]'
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as AddressTableExportFormat)}>
              <option value='csv'>CSV（表格）</option>
              <option value='json'>JSON（开发用）</option>
            </select>
          </label>
          <button
            type='button'
            className='rounded-md bg-amber-600 px-3 py-1 text-white disabled:opacity-40'
            disabled={savedEntries.length === 0}
            onClick={handleExport}>
            导出列表（{savedEntries.length} 条）
          </button>
          <button
            type='button'
            className='rounded-md bg-white/10 px-3 py-1 text-white hover:bg-white/20 disabled:opacity-40'
            disabled={savedEntries.length === 0}
            onClick={clearSaved}>
            清空列表
          </button>
        </div>
        {exportFormat === 'json' ? (
          <div className='mt-2 flex flex-col gap-2 border-t border-white/10 pt-2'>
            <label className='inline-flex flex-wrap items-center gap-2 text-xs'>
              JSON 结构
              <select
                className='rounded-md px-2 py-1 text-[var(--ui-fg)]'
                value={jsonShape}
                onChange={(e) => setJsonShape(e.target.value as AddressJsonExportShape)}>
                <option value='envelope'>信封（含 schema / exportedAt / rowCount）</option>
                <option value='flat'>纯数组</option>
              </select>
            </label>
            <fieldset className='text-xs'>
              <legend className='mb-1 text-white/80'>包含字段</legend>
              <div className='flex flex-wrap gap-x-3 gap-y-1'>
                {JSON_FIELD_LABELS.map(({ key, label }) => (
                  <label key={key} className='inline-flex items-center gap-1'>
                    <input
                      type='checkbox'
                      checked={jsonFields[key]}
                      onChange={(e) => toggleJsonField(key, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}
      </div>

      <div className='flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end'>
        <label className='flex min-w-[12rem] flex-1 flex-col gap-1 text-xs'>
          路径模板
          <input
            className='rounded-md px-2 py-1 text-[var(--ui-fg)]'
            value={pathTemplate}
            onChange={(e) => setPathTemplate(e.target.value)}
          />
        </label>
        <label className='flex w-24 flex-col gap-1 text-xs'>
          起始 index
          <input
            type='number'
            min={0}
            className='rounded-md px-2 py-1 text-[var(--ui-fg)]'
            onChange={(e) => setStartIndex(Number(e.target.value))}
            value={startIndex}
          />
        </label>
        <label className='flex w-28 flex-col gap-1 text-xs'>
          数量 (1–{ADDRESS_GENERATOR_TAB_BATCH_MAX})
          <input
            type='number'
            min={1}
            max={ADDRESS_GENERATOR_TAB_BATCH_MAX}
            className='rounded-md px-2 py-1 text-[var(--ui-fg)]'
            onChange={(e) => setCount(Number(e.target.value))}
            value={count}
          />
        </label>
        <button
          type='button'
          className='rounded-md bg-emerald-600 px-4 py-2 text-white sm:shrink-0'
          onClick={handleGenerate}>
          生成
        </button>
        <button
          type='button'
          className='rounded-md bg-teal-600 px-4 py-2 text-white disabled:opacity-40 sm:shrink-0'
          disabled={previewRows.length === 0}
          onClick={handleAddToExportList}>
          加入导出列表
        </button>
      </div>

      {error ? <p className='text-sm text-amber-200'>{error}</p> : null}

      <AddressRowsTable
        title={`本次生成（${previewRows.length} 条）`}
        rows={previewRows}
        showPrivateKey={showPrivateKey}
        onTableBodyClick={handleCopy}
        emptyHint='调整路径与数量后点击「生成」，再「加入导出列表」可多次累积。'
      />

      <AddressRowsTable
        title={`待导出列表（${savedEntries.length} / ${ADDRESS_GENERATOR_TAB_LIST_MAX} 条）`}
        rows={savedRows}
        rowIds={savedIds}
        showPrivateKey={showPrivateKey}
        onTableBodyClick={handleCopy}
        onRemoveRow={handleRemoveSaved}
        emptyHint='尚未添加；可从「本次生成」加入，或切换链后再次生成并加入。'
      />
    </div>
  );
}

export default Newtab;
