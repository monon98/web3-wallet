# 四端区块链 Monorepo

架构、信任边界与接口契约以 [docs/engineering/TECHNICAL-SOLUTION.md](docs/engineering/TECHNICAL-SOLUTION.md) 为准；文档分层索引见 [docs/README.md](docs/README.md)。

## 布局

| 路径                                       | 说明                                                                |
| ------------------------------------------ | ------------------------------------------------------------------- |
| [apps/extension/](apps/extension/)         | 浏览器扩展（Plasmo MV3），pnpm 包名 `web3-wallet`                   |
| [packages/shared/](packages/shared/)       | Bridge / HTTP 的 Zod 与 TS 类型                                     |
| [packages/contracts/](packages/contracts/) | Foundry 合约（`forge build` / `forge test`）                        |
| [apps/web/](apps/web/)                     | Web（Next.js App Router、viem、TanStack Query），包名 `@plugin/web` |
| [apps/server/](apps/server/)               | 服务端（Fastify），包名 `@plugin/server`                            |

## 要求

- Node.js 20+（**服务端** `apps/server` 的 `engines` 建议 22+，与 CI 一致）
- [pnpm](https://pnpm.io/) 9（见根目录 `packageManager` 字段）
- 合约开发需安装 [Foundry](https://book.getfoundry.sh/)

## 常用命令

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm dev:extension
pnpm dev:web
pnpm dev:server
```

合约（在已安装 Foundry 的前提下）：

```bash
cd packages/contracts
forge install --no-commit foundry-rs/forge-std
forge test
```

首次克隆后若 `packages/contracts/lib` 为空，需执行上面的 `forge install` 拉取 `forge-std`。

## 环境变量

参见根目录 [.env.example](.env.example)。
