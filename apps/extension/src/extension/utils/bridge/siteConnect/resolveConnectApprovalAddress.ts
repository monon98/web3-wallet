import { extLogWarn } from '~lib/extensionLog';
import { listWalletAccountSummaries } from '~lib/vault/record';
import { getAddress } from '~web3/evm/viem';

/**
 * 连接弹窗「确认」路径：�?UI 所选地址�?**vault 内已存在账户** 交集校验，防止授权到未托管地址�?
 *
 * @param selectedRaw 弹窗提交�?checksummed 或任意合�?hex 地址字符�?
 * @returns `ok: true` �?`address` 为规范化 checksummed 地址
 */
export async function resolveConnectApprovalAddress(
  selectedRaw: string | undefined
): Promise<{ ok: true; address: `0x${string}` } | { ok: false }> {
  const metas = await listWalletAccountSummaries();
  if (metas.length === 0) {
    extLogWarn('connect_approval_address', { result: 'no_local_accounts' });
    return { ok: false };
  }
  if (!selectedRaw) {
    extLogWarn('connect_approval_address', { result: 'missing_selection' });
    return { ok: false };
  }
  try {
    const a = getAddress(selectedRaw as `0x${string}`);
    if (!metas.some((m) => m.address.toLowerCase() === a.toLowerCase())) {
      extLogWarn('connect_approval_address', { result: 'address_not_in_vault' });
      return { ok: false };
    }
    return { ok: true, address: a };
  } catch {
    extLogWarn('connect_approval_address', { result: 'invalid_address' });
    return { ok: false };
  }
}
