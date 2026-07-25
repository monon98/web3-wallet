import { useState } from 'react';

/**
 * 扩展 **DevTools** 面板占位页（Plasmo `devtools` 入口）；当前无业务逻辑，仅便于确认扩展已挂载。
 */
function IndexDevtools() {
  const [data, setData] = useState('');

  return (
    <div style={{ padding: 16 }}>
      <h2>Web3 wallet · devtools</h2>
      <input onChange={(e) => setData(e.target.value)} value={data} />
    </div>
  );
}

export default IndexDevtools;
