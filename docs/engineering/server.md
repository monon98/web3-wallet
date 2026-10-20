# 子项目：服务端（`apps/server`，`@plugin/server`）

- **本地类型**：`src/types/*.ts`，聚合出口 **`src/types/index.ts`**（`export type * from './…'`）；当前无 `paths` 别名时自 `src` 内相对引用 `./types` 或按需对齐扩展的 `~/types` 约定。
- **栈**：Fastify、TypeScript（详见 [TECHNICAL-SOLUTION.md §4.3](./TECHNICAL-SOLUTION.md)）。
- **EVM 已实现能力（骨架）**：见技术方案 **§5.2**（RPC 代理、Etherscan V2、**`POST /api/v1/evm/balance-reader/query`**、**`POST /api/v1/evm/batch-sender/build`**、`GET /api/v1/evm/status`、`GET /api/v1/meta`）；环境变量 **§5.4**（含 `EVM_BALANCE_READER_ADDRESSES_JSON`、`EVM_BATCH_SENDER_ADDRESSES_JSON`）。
- **Tron 已实现能力（骨架）**：**TronGrid** 数据源（`SERVER_TRON_API_URL` / `SERVER_TRON_API_KEY` / `SERVER_TRON_MIN_INTERVAL_MS`）；`GET /api/v1/tron/status`、`GET /api/v1/tron/explorer/account`、`POST /api/v1/tron/explorer/accounts`（**串行 + 节流**，单次 ≤ 20 地址）；见技术方案 **§5.2** / **§5.4**。
- **BTC 已实现能力（骨架）**：**Esplora** 数据源（`SERVER_BTC_API_URL` / `SERVER_BTC_MIN_INTERVAL_MS`）；`GET /api/v1/btc/status`、`GET /api/v1/btc/explorer/address`、`POST /api/v1/btc/explorer/addresses`（**串行 + 节流**，单次 ≤ 20 地址，主网地址校验）；见技术方案 **§5.2** / **§5.4**。
- **多地址余额 / 代币批量查询**（链上 Multicall 与 Etherscan 差异、eth_call 与 gas 说明）：[evm-batch-balances.md](./evm-batch-balances.md)。
- **日志**：关闭 Fastify 默认「incoming / completed」双条；`onResponse` 单行 access；默认双写控制台与运行目录下 **`logs/server.log`**（每行 JSON）；`LOG_TO_FILE` / `LOG_FILE` 见 `.env.example`。
- **OpenAPI（仅开发）**：`NODE_ENV !== 'production'` 时注册 `@fastify/swagger` + `@fastify/swagger-ui`；**JSON** `GET /documentation/json`，**Swagger UI** `GET /documentation`。生产环境不暴露。本地可用 **`SERVER_SWAGGER=0`** 关闭。实现见 `apps/server/src/swagger/devSwagger.ts`。
- **产品对照**：[prd-server.md](../product/prd-server.md)；整体见 [PRODUCT-OVERVIEW.md](../product/PRODUCT-OVERVIEW.md) §A5；Tron/BTC 与批量查询路线见技术方案 §4.3、§9。
