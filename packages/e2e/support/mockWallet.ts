import { test as base, expect } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Playwright 钱包夹具：向 Web 页面注入 EIP-6963 / EIP-1193 mock provider。
 *
 * 设计：浏览器侧只负责消息转发，真正的签名字在 Node 测试进程内用 viem 完成，
 * 因此既覆盖页面的连接 / 签名 / 交易路径，又不需要把私钥写进页面脚本。
 *
 * 安全：私钥是公开的 Hardhat 测试账号，不含真实资产；仅用于本地 / CI E2E。
 */

const TEST_PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;
const WALLET_NAME = 'E2E Mock Wallet';
const WALLET_UUID = 'e2e-mock-wallet-0000-0000-0000-000000000000';
const WALLET_RDNS = 'dev.e2e.mock-wallet';

const account = privateKeyToAccount(TEST_PRIVATE_KEY);

export const MOCK_WALLET_ADDRESS = account.address;

type WalletRequest = {
  method?: unknown;
  params?: unknown;
};

type WalletRequestResult = unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireHexQuantity(value: unknown, field: string): bigint {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error(`invalid_${field}`);
  }
  return BigInt(value);
}

async function handleWalletRequest(
  request: WalletRequest
): Promise<WalletRequestResult> {
  const method = typeof request.method === 'string' ? request.method : '';
  const params = Array.isArray(request.params) ? request.params : [];

  switch (method) {
    case 'eth_requestAccounts':
    case 'eth_accounts':
      return [account.address];
    case 'eth_chainId':
      return '0x1';
    case 'net_version':
      return '1';
    case 'personal_sign': {
      const message = params[0];
      if (typeof message !== 'string') {
        throw new Error('personal_sign_requires_message');
      }
      return account.signMessage({ message });
    }
    case 'eth_signTransaction': {
      const transaction = params[0];
      if (!isRecord(transaction)) {
        throw new Error('eth_signTransaction_requires_transaction');
      }
      return account.signTransaction({
        type: 'legacy',
        chainId: Number(requireHexQuantity(transaction.chainId, 'chainId')),
        nonce: Number(requireHexQuantity(transaction.nonce, 'nonce')),
        gas: requireHexQuantity(transaction.gas, 'gas'),
        gasPrice: requireHexQuantity(transaction.gasPrice, 'gasPrice'),
        to: transaction.to as `0x${string}`,
        value: requireHexQuantity(transaction.value, 'value')
      });
    }
    default:
      throw new Error(`unsupported_wallet_method:${method}`);
  }
}

export const test = base.extend<{
  mockWallet: { address: `0x${string}` };
}>({
  mockWallet: async ({ page }, use) => {
    await page.exposeFunction('__e2eMockWalletRequest', handleWalletRequest);

    await page.addInitScript(
      ({ name, uuid, rdns }) => {
        const provider = {
          request: (args: WalletRequest): Promise<unknown> => {
            const binding = (
              window as unknown as {
                __e2eMockWalletRequest?: (
                  request: WalletRequest
                ) => Promise<unknown>;
              }
            ).__e2eMockWalletRequest;
            if (typeof binding !== 'function') {
              return Promise.reject(new Error('mock_wallet_binding_missing'));
            }
            return binding(args);
          }
        };

        const info = {
          uuid,
          name,
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
          rdns
        };

        const announce = () => {
          window.dispatchEvent(
            new CustomEvent('eip6963:announceProvider', {
              detail: Object.freeze({ info, provider })
            })
          );
        };

        window.addEventListener('eip6963:requestProvider', announce);
        (window as unknown as { ethereum?: typeof provider }).ethereum =
          provider;
        announce();
      },
      { name: WALLET_NAME, uuid: WALLET_UUID, rdns: WALLET_RDNS }
    );

    await use({ address: account.address });
  }
});

export { expect };
