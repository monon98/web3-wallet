import { getWalletBuiltinEvmChainMetaFromHex, WALLET_BUILTIN_EVM_CHAINS } from '@plugin/shared';
import { FieldLabel, PanelSection, SelectField, TextInput, UiButton } from '@plugin/ui';
import { useCallback, useEffect, useState } from 'react';

import { useStorageKeyRefresh } from '~/hooks/common/useStorageKeyRefresh';
import type { CustomEvmChain } from '~/types';
import {
  CUSTOM_EVM_CHAINS_STORAGE_KEY,
  customEvmChainIdToHex,
  loadCustomEvmChains,
  MAX_CUSTOM_EVM_CHAINS,
  removeCustomEvmChain,
  upsertCustomEvmChain,
  validateCustomEvmChainDraft,
  validateCustomEvmChainRpc,
  type CustomEvmChainDraft
} from '~lib/walletUi/customEvmChains';
import {
  loadWalletUiState,
  normalizeChainIdHexInput,
  setWalletChainIdHex,
  WALLET_UI_STATE_STORAGE_KEY
} from '~lib/walletUi/globalSettings';

/**
 * **网络与自定义 RPC**（P2-3）：切换当前链，新增 / 编辑 / 删除本地自定义网络。
 *
 * 新增网络或修改 RPC URL 时会调用 `eth_chainId` 校验填写值；DApp 不能自动写入这里，
 * 只能切换到已由用户确认的链路。RPC URL 可能包含节点 key，列表只展示 host。
 */

const STORAGE_KEYS = [CUSTOM_EVM_CHAINS_STORAGE_KEY, WALLET_UI_STATE_STORAGE_KEY] as const;

const EMPTY_DRAFT: CustomEvmChainDraft = {
  chainIdInput: '',
  name: '',
  nativeSymbol: '',
  rpcUrl: ''
};

function rpcHostLabel(rpcUrl: string): string {
  try {
    return new URL(rpcUrl).host;
  } catch {
    return 'RPC';
  }
}

function chainIdToHex(chainId: number): `0x${string}` {
  return customEvmChainIdToHex(chainId);
}

export function CustomEvmChainsSection() {
  const [chains, setChains] = useState<CustomEvmChain[]>([]);
  const [currentChainIdHex, setCurrentChainIdHex] = useState<`0x${string}`>('0x1');
  const [draft, setDraft] = useState<CustomEvmChainDraft>(EMPTY_DRAFT);
  const [editingChainId, setEditingChainId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [state, list] = await Promise.all([loadWalletUiState(), loadCustomEvmChains()]);
      setCurrentChainIdHex(normalizeChainIdHexInput(state.chainIdHex) ?? '0x1');
      setChains(list);
    } catch {
      setNotice('读取网络配置失败，请稍后重试。');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useStorageKeyRefresh(STORAGE_KEYS, refresh);

  const currentBuiltin = getWalletBuiltinEvmChainMetaFromHex(currentChainIdHex);
  const currentCustom = chains.find((chain) => chainIdToHex(chain.chainId) === currentChainIdHex);
  const currentLabel = currentBuiltin
    ? `${currentBuiltin.name} · ${currentBuiltin.nativeSymbol}`
    : currentCustom
      ? `${currentCustom.name} · ${currentCustom.nativeSymbol}`
      : '未知网络';

  const resetForm = useCallback(() => {
    setEditingChainId(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(false);
  }, []);

  const startAdd = useCallback(() => {
    setNotice(null);
    setEditingChainId(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(true);
  }, []);

  const startEdit = useCallback((chain: CustomEvmChain) => {
    setNotice(null);
    setEditingChainId(chain.chainId);
    setDraft({
      chainIdInput: String(chain.chainId),
      name: chain.name,
      nativeSymbol: chain.nativeSymbol,
      rpcUrl: chain.rpcUrl
    });
    setFormOpen(true);
  }, []);

  const switchChain = useCallback(
    async (nextHex: string) => {
      const normalized = normalizeChainIdHexInput(nextHex);
      if (!normalized || normalized === currentChainIdHex) {
        return;
      }
      setNotice(null);
      setBusy(true);
      try {
        await setWalletChainIdHex(normalized);
        setCurrentChainIdHex(normalized);
        setNotice('已切换当前网络。');
      } catch {
        setNotice('切换网络失败，请稍后重试。');
      } finally {
        setBusy(false);
      }
    },
    [currentChainIdHex]
  );

  const save = useCallback(async () => {
    setNotice(null);
    const wasEditing = editingChainId !== null;
    if (!wasEditing && chains.length >= MAX_CUSTOM_EVM_CHAINS) {
      setNotice(`最多保存 ${MAX_CUSTOM_EVM_CHAINS} 个自定义网络。`);
      return;
    }
    const validation = validateCustomEvmChainDraft(draft, chains, editingChainId ?? undefined);
    if (validation.ok === false) {
      setNotice(validation.message);
      return;
    }
    setBusy(true);
    try {
      const existing = editingChainId !== null ? chains.find((chain) => chain.chainId === editingChainId) : undefined;
      // 仅改名 / 改符号时复用首次添加时的校验结果；RPC 变更或新增网络必须重新探测。
      if (!existing || existing.rpcUrl !== validation.chain.rpcUrl) {
        const rpc = await validateCustomEvmChainRpc(validation.chain.chainId, validation.chain.rpcUrl);
        if (rpc.ok === false) {
          setNotice(rpc.message);
          return;
        }
      }
      const next = await upsertCustomEvmChain(validation.chain);
      setChains(next);
      setNotice(wasEditing ? `已更新 ${validation.chain.name}。` : `已添加 ${validation.chain.name}。`);
      resetForm();
    } catch {
      setNotice('保存失败，请检查配置或稍后重试。');
    } finally {
      setBusy(false);
    }
  }, [chains, draft, editingChainId, resetForm]);

  const deleteChain = useCallback(
    async (chain: CustomEvmChain) => {
      if (!confirm(`删除自定义网络「${chain.name}」（Chain ID ${chain.chainId}）？`)) {
        return;
      }
      setNotice(null);
      setBusy(true);
      try {
        const next = await removeCustomEvmChain(chain.chainId);
        setChains(next);
        if (editingChainId === chain.chainId) {
          resetForm();
        }
        if (currentChainIdHex === chainIdToHex(chain.chainId)) {
          try {
            await setWalletChainIdHex('0x1');
            setCurrentChainIdHex('0x1');
            setNotice(`已删除 ${chain.name}，当前网络已切回 Ethereum。`);
          } catch {
            setNotice(`已删除 ${chain.name}，但当前网络切换失败，请手动选择网络。`);
          }
        } else {
          setNotice(`已删除 ${chain.name}。`);
        }
      } catch {
        setNotice('删除失败，请稍后重试。');
      } finally {
        setBusy(false);
      }
    },
    [currentChainIdHex, editingChainId, resetForm]
  );

  return (
    <PanelSection
      title='网络与自定义 RPC'
      description='切换当前网络，或添加本地自定义 EVM 网络。新增 / 修改 RPC 时会用 eth_chainId 校验，链 ID 不一致时不会写入。'
      tone='default'>
      <FieldLabel htmlFor='wallet-current-chain' className='text-[var(--ui-fg)] opacity-100'>
        当前网络
      </FieldLabel>
      <SelectField
        id='wallet-current-chain'
        value={currentChainIdHex}
        disabled={busy}
        onChange={(e) => void switchChain(e.target.value)}>
        {!currentBuiltin && !currentCustom ? (
          <option value={currentChainIdHex}>未知网络（{currentChainIdHex}）</option>
        ) : null}
        <optgroup label='内置网络'>
          {WALLET_BUILTIN_EVM_CHAINS.map((chain) => (
            <option key={chain.id} value={chainIdToHex(chain.id)}>
              {chain.name} · {chain.nativeSymbol} · {chain.id}
            </option>
          ))}
        </optgroup>
        {chains.length > 0 ? (
          <optgroup label='自定义网络'>
            {chains.map((chain) => (
              <option key={chain.chainId} value={chainIdToHex(chain.chainId)}>
                {chain.name} · {chain.nativeSymbol} · {chain.chainId}
              </option>
            ))}
          </optgroup>
        ) : null}
      </SelectField>
      <p className='mb-2 text-[11px] leading-snug text-[var(--ui-muted-fg)]'>
        当前：<span className='text-[var(--ui-fg)]'>{currentLabel}</span> · {currentChainIdHex}
      </p>
      <p className='mb-3 text-[11px] leading-snug text-[var(--ui-muted-fg)]'>
        自定义 RPC 会看到该网络的地址查询与交易广播，请只使用可信节点。RPC URL 保存在本机
        chrome.storage.local；不要填写带高权限的共享 key。
      </p>

      <div className='mb-2 flex items-center justify-between gap-2'>
        <p className='text-[11px] text-[var(--ui-muted-fg)]'>
          自定义网络（{chains.length}/{MAX_CUSTOM_EVM_CHAINS}）
        </p>
        <UiButton variant='secondary' size='sm' disabled={busy} onClick={startAdd}>
          添加网络
        </UiButton>
      </div>

      {chains.length === 0 ? (
        <p className='text-[11px] leading-snug text-[var(--ui-muted-fg)]'>
          尚未添加自定义网络。可添加本地 Anvil、测试网或自建节点。
        </p>
      ) : (
        <ul className='space-y-2'>
          {chains.map((chain) => {
            const hex = chainIdToHex(chain.chainId);
            const isCurrent = hex === currentChainIdHex;
            return (
              <li key={chain.chainId} className='rounded border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-2'>
                <div className='flex items-start justify-between gap-2'>
                  <p className='min-w-0 truncate text-[11px] font-medium text-[var(--ui-fg)]'>{chain.name}</p>
                  {isCurrent ? (
                    <span className='shrink-0 rounded bg-[var(--ui-surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--ui-muted-fg)]'>
                      当前
                    </span>
                  ) : null}
                </div>
                <p className='mt-0.5 text-[10px] leading-snug text-[var(--ui-muted-fg)]'>
                  Chain ID {chain.chainId} · {chain.nativeSymbol} · {rpcHostLabel(chain.rpcUrl)}
                </p>
                <div className='mt-2 flex flex-wrap gap-1.5'>
                  <UiButton
                    variant='secondary'
                    size='xs'
                    disabled={busy || isCurrent}
                    onClick={() => void switchChain(hex)}>
                    {isCurrent ? '当前网络' : '切换'}
                  </UiButton>
                  <UiButton variant='outline' size='xs' disabled={busy} onClick={() => startEdit(chain)}>
                    编辑
                  </UiButton>
                  <UiButton variant='linkDanger' size='xs' disabled={busy} onClick={() => void deleteChain(chain)}>
                    删除
                  </UiButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {formOpen ? (
        <div className='mt-3 rounded border border-[var(--ui-border)] bg-[var(--ui-surface-2)] p-3'>
          <FieldLabel htmlFor='wallet-custom-chain-name' className='text-[var(--ui-fg)] opacity-100'>
            网络名称
          </FieldLabel>
          <TextInput
            id='wallet-custom-chain-name'
            value={draft.name}
            placeholder='例如 Local Anvil'
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            className='mb-2'
          />

          <FieldLabel htmlFor='wallet-custom-chain-id' className='text-[var(--ui-fg)] opacity-100'>
            Chain ID
          </FieldLabel>
          <TextInput
            id='wallet-custom-chain-id'
            value={draft.chainIdInput}
            placeholder='例如 31337 或 0x7a69'
            disabled={editingChainId !== null}
            onChange={(e) => setDraft((prev) => ({ ...prev, chainIdInput: e.target.value }))}
            className='mb-1'
          />
          {editingChainId !== null ? (
            <p className='mb-2 text-[10px] leading-snug text-[var(--ui-muted-fg)]'>
              编辑已有网络时 Chain ID 不可修改。
            </p>
          ) : null}

          <FieldLabel htmlFor='wallet-custom-chain-symbol' className='text-[var(--ui-fg)] opacity-100'>
            原生币符号
          </FieldLabel>
          <TextInput
            id='wallet-custom-chain-symbol'
            value={draft.nativeSymbol}
            placeholder='例如 ETH'
            onChange={(e) => setDraft((prev) => ({ ...prev, nativeSymbol: e.target.value }))}
            className='mb-2'
          />

          <FieldLabel htmlFor='wallet-custom-chain-rpc' className='text-[var(--ui-fg)] opacity-100'>
            RPC URL
          </FieldLabel>
          <TextInput
            id='wallet-custom-chain-rpc'
            type='url'
            value={draft.rpcUrl}
            placeholder='https://... 或 http://localhost:8545'
            onChange={(e) => setDraft((prev) => ({ ...prev, rpcUrl: e.target.value }))}
            className='mb-2'
          />

          <div className='flex flex-wrap gap-2'>
            <UiButton variant='primary' size='sm' disabled={busy} onClick={() => void save()}>
              {busy ? '校验中…' : editingChainId !== null ? '保存修改' : '添加网络'}
            </UiButton>
            <UiButton variant='secondary' size='sm' disabled={busy} onClick={resetForm}>
              取消
            </UiButton>
          </div>
        </div>
      ) : null}

      {notice ? <p className='mt-2 text-[11px] leading-snug text-[var(--ui-muted-fg)]'>{notice}</p> : null}
    </PanelSection>
  );
}
