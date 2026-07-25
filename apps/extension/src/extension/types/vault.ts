/**
 * **Vault 持久化形状**（`chrome.storage.local` 账户包）：EVM 与 TVM 分库存储，密文字段与 `utils/vault/record`、`utils/vault/tvmRecord`、`utils/vault/crypto` 一致。
 *
 * `*Summary` 类型为 UI 列表用脱敏视图（无 cipher）。
 */

// --- EVM（`record.ts` / `signing.ts`）---

export type WalletAccountStored = {
  id: string;
  label: string;
  walletKind: 'mnemonic' | 'privateKey';
  saltB64: string;
  ivB64: string;
  cipherB64: string;
  address: `0x${string}`;
};

export type AccountsBundleV1 = {
  version: 1;
  accounts: WalletAccountStored[];
};

export type WalletAccountSummary = {
  id: string;
  label: string;
  walletKind: 'mnemonic' | 'privateKey';
  address: `0x${string}`;
};

// --- TVM / Tron（`tvmRecord.ts`）---

export type TvmAccountStored = {
  id: string;
  label: string;
  walletKind: 'privateKey';
  saltB64: string;
  ivB64: string;
  cipherB64: string;
  /** Base58Check 地址（用户常见展示形态，例如 `T...`） */
  addressBase58: string;
  /** Hex 地址（`41...`，用于与 TronWeb API 对齐） */
  addressHex: string;
};

export type TvmAccountsBundleV1 = {
  version: 1;
  accounts: TvmAccountStored[];
};

export type TvmAccountSummary = {
  id: string;
  label: string;
  walletKind: 'privateKey';
  addressBase58: string;
  addressHex: string;
};
