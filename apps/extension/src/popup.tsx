import '@assets/style.css';

import { WalletPanel } from '~/components/wallet/walletPanel';

/**
 * 工具栏 **弹出窗** UI：与侧栏共用 `WalletPanel`（账户 / 连接 / 策略）。
 * 根容器 `min-w-0` + 横向裁剪，避免窄宽度下子元素撑出横向滚动条。
 */
export default function PopupPage() {
  return (
    <div className='box-border min-h-0 w-full min-w-0 max-w-full overflow-x-hidden'>
      <WalletPanel />
    </div>
  );
}
