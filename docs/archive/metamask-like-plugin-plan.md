> **归档说明**：早期「类 MetaMask 插件」单端草案，技术栈（Vite / Webpack / ethers 等）与当前仓库 **Plasmo + viem** 及 [四端技术方案](../engineering/TECHNICAL-SOLUTION.md) 不一致，仅供参考。

# MetaMask 类似插件实现计划

## 需求实现细节

### 1. 插件核心功能

- **钱包管理**: 创建、导入、导出钱包

- **账户管理**: 多账户支持，账户切换

- **交易签名**: 交易请求处理，签名确认

- **网页通信**: 与网页应用的通信接口

- **安全存储**: 私钥加密存储

### 2. 技术栈选择

- **前端**: React, HTML, CSS, JavaScript
- **构建工具**: Vite, Babel
- **包管理工具**: pnpm
- **加密库**: ethereumjs-wallet, web3.js, ethers.js
- **存储**: chrome.storage.local (用于安全存储)
- **开发工具**: ESLint, Prettier
- **测试工具**: Jest

### 3. 项目结构

- `/src` - 源代码
  - `/extension` - 扩展插件代码
    - `manifest.json` - 扩展配置

    - `background.js` - 后台脚本

    - `popup.html` - 弹出页面

    - `popup.jsx` - 弹出页面React组件

    - `content.js` - 内容脚本

    - `inpage.js` - 注入到网页的脚本

  - `/demo` - 测试网页
    - `index.html` - 测试页面

    - `App.jsx` - 测试页面React组件

  - `/common` - 公共代码
    - `utils.js` - 工具函数

    - `crypto.js` - 加密相关功能

  - `/components` - React组件
    - `WalletCreate.jsx` - 钱包创建组件

    - `AccountList.jsx` - 账户列表组件

    - `TransactionSign.jsx` - 交易签名组件

## \[ ] 任务 1: 项目初始化与结构搭建

- **优先级**: P0

- **依赖**: 无

- **描述**:
  - 创建项目目录结构

  - 初始化 npm 项目

  - 配置 Webpack 构建工具

  - 安装必要的依赖包

- **成功标准**:
  - 项目目录结构完整

  - npm 依赖安装成功

  - 构建工具配置完成

\*- **测试要求**:

- `programmatic` TR-1.1: 执行 `pnpm install` 无错误
- `programmatic` TR-1.2: 执行 `pnpm run build` 无错误

## \[ ] 任务 2: Chrome 扩展插件开发

- **优先级**: P0

- **依赖**: 任务 1

- **描述**:
  - 创建 Chrome 扩展的 manifest.json 文件

  - 实现背景脚本 (background.js)

  - 实现弹出页面 (popup.html, popup.js)

  - 实现内容脚本 (content.js)

  - 实现消息传递机制

- **成功标准**:
  - 插件可以在 Chrome 中加载

  - 弹出页面可以正常显示

  - 消息传递机制正常工作

- **测试要求**:
  - `programmatic` TR-2.1: 插件可以成功加载到 Chrome 扩展管理页面

  - `human-judgement` TR-2.2: 弹出页面显示正常，交互流畅

## \[ ] 任务 3: 核心功能实现

- **优先级**: P0

- **依赖**: 任务 2

- **描述**:
  - 实现钱包创建和管理功能

  - 实现账户切换功能

  - 实现交易签名功能

  - 实现与网页的通信接口

- **成功标准**:
  - 可以创建新钱包

  - 可以切换账户

  - 可以签名交易

  - 网页可以通过 API 与插件通信

- **测试要求**:
  - `programmatic` TR-3.1: 钱包创建功能正常

  - `programmatic` TR-3.2: 账户切换功能正常

  - `programmatic` TR-3.3: 交易签名功能正常

## \[ ] 任务 4: 测试网页开发

- **优先级**: P1

- **依赖**: 任务 3

- **描述**:
  - 创建测试网页 (index.html)

  - 实现与插件通信的前端代码

  - 提供测试功能的 UI 界面

- **成功标准**:
  - 测试网页可以正常加载

  - 可以调用插件的 API

  - 可以显示插件返回的结果

- **测试要求**:
  - `programmatic` TR-4.1: 测试网页可以正常加载

  - `human-judgement` TR-4.2: 测试界面操作流畅，反馈及时

## \[ ] 任务 5: 功能测试与优化

- **优先级**: P1

- **依赖**: 任务 4

- **描述**:
  - 测试所有功能是否正常工作

  - 优化用户体验

  - 修复可能的 bug

- **成功标准**:
  - 所有功能测试通过

  - 用户体验良好

  - 无明显 bug

- **测试要求**:
  - `programmatic` TR-5.1: 所有功能测试通过

  - `human-judgement` TR-5.2: 用户体验流畅，界面美观

## \[ ] 任务 6: 文档与部署

- **优先级**: P2

- **依赖**: 任务 5

- **描述**:
  - 编写项目文档

  - 提供安装和使用说明

  - 准备部署包

- **成功标准**:
  - 文档完整清晰

  - 安装和使用说明详细

  - 部署包准备就绪

- **测试要求**:
  - `human-judgement` TR-6.1: 文档内容完整，易于理解

  - `programmatic` TR-6.2: 部署包可以正常安装使用
