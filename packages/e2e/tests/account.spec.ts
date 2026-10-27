import { expect, test } from '../support/mockWallet';

/**
 * Web `/account` 关键路径 E2E：
 * 连接 mock 钱包 → challenge → personal_sign → HttpOnly Cookie 会话 →
 * eth_signTransaction → Fastify 转发假 RPC 广播。
 *
 * 使用真实 Fastify 进程与本地假上游；不访问真实链、扩展或第三方 API。
 */

const RECIPIENT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

test('连接钱包 → 登录 → 签名交易 → 服务端广播', async ({
  page,
  mockWallet
}) => {
  await page.goto('/account');

  await expect(page.getByText('E2E Mock Wallet')).toBeVisible();
  await page.getByRole('button', { name: '连接钱包' }).click();

  await expect(page.getByText('已连接', { exact: true })).toBeVisible();
  await expect(page.getByText('chainId 1', { exact: true })).toBeVisible();
  await expect(
    page.getByText(mockWallet.address, { exact: true })
  ).toBeVisible();

  await page.getByRole('button', { name: '获取登录消息' }).click();
  await expect(page.locator('#accountChallenge')).toHaveValue(
    /Sign in to Plugin Web\./
  );

  await page.getByRole('button', { name: '用钱包签名' }).click();
  await expect(page.getByText(/^签名：0x[0-9a-f]+$/i)).toBeVisible();

  await page.getByRole('button', { name: '验证并登录' }).click();
  await expect(
    page.getByText('登录成功；现在可以签名并广播交易。')
  ).toBeVisible();
  await expect(page.getByText(/^已登录：/)).toBeVisible();

  await page.locator('#accountTxTo').fill(RECIPIENT);
  await page.locator('#accountTxValue').fill('0.01');
  await page.getByRole('button', { name: '1. 签名交易' }).click();

  await expect(page.locator('#accountSignedTx')).toHaveValue(/^0x[0-9a-f]+$/i);

  await page.getByRole('button', { name: '2. 服务端广播' }).click();
  await expect(page.getByText('服务端已广播交易。')).toBeVisible();
  await expect(page.getByText(/^0x[0-9a-f]{64}$/i)).toBeVisible();

  // P4-5：刷新后从 HttpOnly Cookie 恢复会话，CSRF token 由 /auth/me 重新下发。
  await page.reload();
  await expect(page.getByText(/^已登录：/)).toBeVisible();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();
});
