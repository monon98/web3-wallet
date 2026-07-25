> **归档说明**：早期「类 MetaMask 插件」单端规范，技术栈（Vite / ethers 等）与当前仓库 **Plasmo + viem** 及 [四端技术方案](../engineering/TECHNICAL-SOLUTION.md) 不一致，仅供参考。

# MetaMask 类似插件项目规范文档

## 1. 项目概述

本项目旨在实现一个类似 MetaMask 的浏览器扩展插件，用于管理加密货币钱包、签名交易和与去中心化应用（DApps）交互。同时提供一个测试网页用于验证插件功能。

## 2. 技术栈

### 2.1 核心技术

- **前端框架**: React
- **构建工具**: Vite
- **包管理工具**: pnpm
- **加密库**: ethereumjs-wallet, web3.js, ethers.js
- **存储**: chrome.storage.local (用于安全存储)
- **开发工具**: ESLint, Prettier
- **测试工具**: Jest

### 2.2 浏览器兼容性

- Chrome
- Firefox
- Edge
- Opera
- Brave

## 3. 项目结构

```
├── src/
│   ├── extension/          # 扩展插件代码
│   │   ├── manifest.json   # 扩展配置文件
│   │   ├── background.js   # 后台脚本
│   │   ├── popup.html      # 弹出页面
│   │   ├── popup.jsx       # 弹出页面React组件
│   │   ├── content.js      # 内容脚本
│   │   └── inpage.js       # 注入到网页的脚本
│   ├── demo/               # 测试网页
│   │   ├── index.html      # 测试页面
│   │   └── App.jsx         # 测试页面React组件
│   ├── common/             # 公共代码
│   │   ├── utils.js        # 工具函数
│   │   └── crypto.js       # 加密相关功能
│   └── components/         # React组件
│       ├── WalletCreate.jsx    # 钱包创建组件
│       ├── AccountList.jsx     # 账户列表组件
│       └── TransactionSign.jsx # 交易签名组件
├── public/                 # 静态资源
├── vite.config.js          # Vite配置
├── package.json            # 项目配置
├── .eslintrc.js            # ESLint配置
├── .prettierrc             # Prettier配置
└── README.md               # 项目说明
```

## 4. 核心功能

### 4.1 钱包管理

- 创建新钱包
- 导入现有钱包
- 导出钱包（私钥/助记词）
- 钱包加密存储

### 4.2 账户管理

- 多账户支持
- 账户切换
- 账户信息展示

### 4.3 交易签名

- 交易请求处理
- 交易详情展示
- 交易签名确认
- 交易状态跟踪

### 4.4 网页通信

- 与网页应用的通信接口
- 注入 web3 提供者
- 处理网页请求

## 5. 开发流程

### 5.1 环境设置

1. 安装 pnpm: `npm install -g pnpm`
2. 安装依赖: `pnpm install`
3. 开发模式: `pnpm run dev`
4. 构建: `pnpm run build`

### 5.2 扩展开发

1. 在 Chrome 中打开扩展管理页面: `chrome://extensions`
2. 启用开发者模式
3. 点击 "加载已解压的扩展程序"
4. 选择 `dist/extension` 目录

### 5.3 测试网页

1. 构建项目: `pnpm run build`
2. 启动本地服务器: `pnpm run serve`
3. 访问测试网页: `http://localhost:5173/demo`

## 6. 代码规范

### 6.1 命名规范

- 组件名: PascalCase (如 `WalletCreate`)
- 函数名: camelCase (如 `createWallet`)
- 变量名: camelCase (如 `walletAddress`)
- 常量名: UPPER_SNAKE_CASE (如 `MAX_RETRY_COUNT`)

### 6.2 代码风格

- 使用 ESLint 进行代码检查
- 使用 Prettier 进行代码格式化
- 缩进: 2 个空格
- 行末不使用分号
- 使用单引号

### 6.3 注释规范

- 组件和函数需要添加 JSDoc 注释
- 复杂逻辑需要添加内联注释
- 代码变更需要添加变更说明

## 7. 安全考虑

### 7.1 私钥存储

- 使用 chrome.storage.local 存储加密后的私钥
- 不将私钥暴露给网页应用
- 使用密码加密存储

### 7.2 通信安全

- 验证消息来源
- 使用加密通信
- 限制敏感操作的权限

### 7.3 输入验证

- 验证所有用户输入
- 防止注入攻击
- 验证交易数据

## 8. 部署

### 8.1 构建

- 生产构建: `pnpm run build`
- 构建产物位于 `dist/` 目录

### 8.2 发布

- 打包扩展: `pnpm run package`
- 生成的 `.zip` 文件可用于发布到 Chrome Web Store

## 9. 测试

### 9.1 单元测试

- 使用 Jest 进行单元测试
- 测试命令: `pnpm run test`

### 9.2 集成测试

- 测试扩展与网页的交互
- 测试交易签名流程

### 9.3 手动测试

- 测试所有功能流程
- 测试不同浏览器兼容性
- 测试边界情况

## 10. 文档

### 10.1 项目文档

- README.md: 项目概览和使用说明
- API.md: API 文档
- CHANGELOG.md: 版本变更记录

### 10.2 开发文档

- 开发指南
- 贡献指南
- 代码规范

## 11. 注意事项

- 本项目仅用于学习和开发目的
- 不要在生产环境中使用未经审计的代码
- 保护好私钥和助记词
- 定期更新依赖以修复安全漏洞
