import { expect, test, type Page } from '@playwright/test';

/**
 * Web 余额查询关键路径 E2E：EVM / Tron / BTC 三张独立页面分别查询本地假上游。
 *
 * 断言聚焦用户可见结果（原生余额、ERC-20 数量、TRC-20、BTC 已确认余额），
 * 不依赖真实链或第三方 API。
 */

const EVM_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const TRON_ADDRESS = 'TN2W4cc7a4dsYyTLiLMWa9m7jVpdLjGvYs';
const BTC_ADDRESS = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

/**
 * 打开单链余额页并提交查询。
 *
 * 先等待「服务状态」出现客户端探测结果：该区块由 TanStack Query 在 hydration 后请求，
 * 出现即说明 React 已接管页面，避免在 hydration 前输入导致受控 textarea 丢失内容。
 */
async function queryBalance(
  page: Page,
  family: 'evm' | 'tron' | 'btc',
  address: string
): Promise<void> {
  await page.goto(`/balances/${family}`);
  await expect(
    page.getByText('每链最多 20 个地址', { exact: false })
  ).toBeVisible();

  const input = page.locator(`#balances-${family}-addresses`);
  await input.fill(address);
  await expect(input).toHaveValue(address);

  await page.getByRole('button', { name: '查询余额' }).click();
}

test('EVM 余额：原生 RPC 余额 + Etherscan ERC-20', async ({ page }) => {
  await queryBalance(page, 'evm', EVM_ADDRESS);

  await expect(page.getByText('EVM 查询结果')).toBeVisible();
  await expect(page.getByText('EVM 链 1')).toBeVisible();
  await expect(page.getByText('服务端 RPC', { exact: true })).toBeVisible();
  await expect(page.getByText('成功', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '查看代币' }).click();
  await expect(page.getByText('Tether USD')).toBeVisible();
  await expect(page.getByText('2.5', { exact: true })).toBeVisible();
});

test('Tron 余额：TRX + TRC-20', async ({ page }) => {
  await queryBalance(page, 'tron', TRON_ADDRESS);

  await expect(page.getByText('Tron 查询结果')).toBeVisible();
  await expect(page.getByText('Tron（TronGrid）')).toBeVisible();
  await expect(page.getByText('2', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '查看 TRC-20' }).click();
  await expect(page.getByText('1500000', { exact: true })).toBeVisible();
});

test('BTC 余额：已确认余额与交易数', async ({ page }) => {
  await queryBalance(page, 'btc', BTC_ADDRESS);

  await expect(page.getByText('BTC 查询结果')).toBeVisible();
  await expect(page.getByText('Bitcoin 主网（Esplora）')).toBeVisible();
  await expect(page.getByText('0.5', { exact: true })).toBeVisible();
  await expect(page.getByText('3', { exact: true })).toBeVisible();
});
