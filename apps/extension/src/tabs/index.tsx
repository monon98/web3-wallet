import '~/assets/style.css';

/**
 * Plasmo **新标签页**默认入口（`tabs/index.html`）：演示导航，链上能力见侧栏 / DApp 桥接。
 */
function Newtab() {
  const navigate = (url: string) => {
    chrome.tabs.create({ url });
  };

  return (
    <div className='p-6 bg-blue-500 text-white text-center rounded-xl'>
      <h1>Tabs</h1>
      <p>Welcome to the tabs</p>
      <button onClick={() => navigate('tabs/generateAccounts.html')}>生成账户</button>
    </div>
  );
}

export default Newtab;
