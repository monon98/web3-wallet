# 子项目：服务端（`apps/server`，`@plugin/server`）

- **本地类型**：`src/types/*.ts`，聚合出口 **`src/types/index.ts`**（`export type * from './…'`）；当前无 `paths` 别名时自 `src` 内相对引用 `./types` 或按需对齐扩展的 `~/types` 约定。
- **栈**：Fastify、TypeScript（详见 [TECHNICAL-SOLUTION.md §4.3](./TECHNICAL-SOLUTION.md)）。
- **EVM 已实现能力（骨架）**：见技术方案 **§5.2**（**JSON-RPC 转发**、Etherscan V2、**`POST /api/v1/evm/balance-reader/query`**、**`POST /api/v1/evm/batch-sender/build`**、**`POST /api/v1/tx/broadcast`**、`GET /api/v1/evm/status`、`GET /api/v1/meta`）；**原生余额**在配置 `SERVER_RPC_URL` 时优先走 RPC（`eth_chainId` 校验链一致，失败回退 Etherscan；响应含 `source`）；环境变量 **§5.4**（含 `EVM_BALANCE_READER_ADDRESSES_JSON`、`EVM_BATCH_SENDER_ADDRESSES_JSON`）。此处「转发」指 JSON-RPC 请求转发，**不是网络代理**。
- **Auth 已实现（MVP）**：`POST /api/v1/auth/challenge`（5 分钟一次性挑战）、`POST /api/v1/auth/verify`（`personal_sign` 校验后签发 24 小时 Bearer 会话）、`GET /api/v1/auth/me`、`POST /api/v1/auth/logout`；challenge / session 当前为**进程内存**，服务重启失效，生产化需持久化 / 限流 / HttpOnly Cookie 与 CSRF（见 [BACKLOG.md](./BACKLOG.md) P4-5）。不保存私钥、助记词或签名原文。
- **交易广播已实现（MVP，EVM only）**：`POST /api/v1/tx/broadcast` 要求 Bearer 会话；校验 raw tx 的 `chainId`、签名者地址与 `SERVER_RPC_URL` 的 `eth_chainId`，再经 `eth_sendRawTransaction` 广播；不接收 / 不记录私钥或助记词。Tron / BTC 广播尚未实现。
- **配置加载**：启动时按 **cwd `.env` → 仓库根 `.env`** 顺序加载（Node `process.loadEnvFile`；已存在的进程环境变量优先；实现见 `src/loadEnv.ts`）。
- **Tron 已实现能力（骨架）**：**TronGrid** 数据源（`SERVER_TRON_API_URL` / `SERVER_TRON_API_KEY` / `SERVER_TRON_MIN_INTERVAL_MS`）；`GET /api/v1/tron/status`、`GET /api/v1/tron/explorer/account`、`POST /api/v1/tron/explorer/accounts`（**串行 + 节流**，单次 ≤ 20 地址）；见技术方案 **§5.2** / **§5.4**。
- **BTC 已实现能力（骨架）**：**Esplora** 数据源（`SERVER_BTC_API_URL` / `SERVER_BTC_MIN_INTERVAL_MS`）；`GET /api/v1/btc/status`、`GET /api/v1/btc/explorer/address`、`POST /api/v1/btc/explorer/addresses`（**串行 + 节流**，单次 ≤ 20 地址，主网地址校验）；见技术方案 **§5.2** / **§5.4**。
- **多地址余额 / 代币批量查询**（链上 Multicall 与 Etherscan 差异、eth_call 与 gas 说明）：[evm-batch-balances.md](./evm-batch-balances.md)。
- **日志**：关闭 Fastify 默认「incoming / completed」双条；`onResponse` 单行 access；默认双写控制台与运行目录下 **`logs/server.log`**（每行 JSON）；`LOG_TO_FILE` / `LOG_FILE` 见 `.env.example`。
- **OpenAPI（仅开发）**：`NODE_ENV !== 'production'` 时注册 `@fastify/swagger` + `@fastify/swagger-ui`；**JSON** `GET /documentation/json`，**Swagger UI** `GET /documentation`。生产环境不暴露。本地可用 **`SERVER_SWAGGER=0`** 关闭。实现见 `apps/server/src/swagger/devSwagger.ts`。
- **产品对照**：[prd-server.md](../product/prd-server.md)；整体见 [PRODUCT-OVERVIEW.md](../product/PRODUCT-OVERVIEW.md) §A5；Tron/BTC 与批量查询路线见技术方案 §4.3、§9。
