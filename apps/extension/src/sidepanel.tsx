import '@assets/style.css';

import { WalletPanel } from '~/components/wallet/walletPanel';

/**
 * **侧栏**主页面：`WalletPanel`（概览内含「其他功能」等）；纵向滚动由根布局承担。
 */
export default function SidePanelPage() {
  return (
    <div className='flex min-h-0 min-h-[100dvh] flex-col bg-white'>
      <div className='min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto'>
        <WalletPanel />
      </div>
    </div>
  );
}
