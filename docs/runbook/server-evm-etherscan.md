# Runbook：服务端（EVM / Etherscan）

本文档由团队在排障后**按需追加**；描述中勿包含真实 API Key、私钥或助记词。

**索引**：[issues-and-solutions.md](./issues-and-solutions.md)

**相关工程备忘**（多地址原生币与代币、Multicall、本仓 Etherscan 批量行为）：[evm-batch-balances.md](../engineering/evm-batch-balances.md)

---

## Etherscan PRO 端点频率限制（`addresstokenbalance`）

- **现象**：多地址 ERC-20 持仓查询易触发供应商约 **2 次/秒** 限制。
- **处理**：服务端对 PRO 端点**串行**调用，并可通过环境变量 `ETHERSCAN_PRO_MIN_INTERVAL_MS`（默认约 `550`）拉大间隔；详见 [TECHNICAL-SOLUTION.md §5.2、§5.4](../engineering/TECHNICAL-SOLUTION.md)。

## Etherscan 不可达 / 服务端未加载 `.env`（ERC-20 降级）

- **现象**：`/balances/evm` 中 EVM 原生余额正常，但 ERC-20 列显示「代币不可用 / 旧缓存」；`GET /api/v1/balances/status` 显示 `etherscanConfigured` 或 `etherscanCooldownRemainingMs` 异常；服务端日志出现 `fetch failed: Connect Timeout Error (attempted address: api.etherscan.io:443)` 或 `etherscan_not_configured`。
- **根因**：
  1. 早期服务端不会自动读取 `.env`，`ETHERSCAN_API_KEY` 只在启动进程的环境变量中生效；
  2. 部分网络无法直连 `api.etherscan.io`（连接超时），与密钥是否有效无关；
  3. 统一查询把 ERC-20 失败降级为**行内错误**，所以整页不再 5xx，问题只体现在代币列。
- **处理**：
  1. 重启服务端，确认已加载 `.env`（cwd `.env` 或仓库根 `.env`；`GET /api/v1/balances/status` 应为 `etherscanConfigured: true`，或按需只保留 RPC）；
  2. 配置可用的 `SERVER_RPC_URL`，且与所选 `chainId` 一致（服务端用 `eth_chainId` 校验）。原生余额会优先走 RPC，不再等待 Etherscan；
  3. ERC-20 持仓仍依赖 Etherscan：将 `ETHERSCAN_API_URL` 指向可用的自建 / 受控代理，或改用 `balance-reader` / 自建索引；首次网络失败后服务端在 60s 内直接返回 `etherscan_unreachable`；
  4. 统一查询会缓存 token 持仓（新鲜 60s / stale 30min）；不可达时行内返回 `tokenError: "etherscan_unreachable"`、`tokenStale: true` 与 `tokenCachedAt`，可调 `ETHERSCAN_TOKEN_CACHE_TTL_MS` / `ETHERSCAN_TOKEN_STALE_TTL_MS`；
  5. 验证：`POST /api/v1/balances/query` 的 `evm.source` 为 `"rpc"`，原生余额存在；ERC-20 行带明确 `tokenError` 而非整页失败。
- **易错点**：不要把 `SERVER_RPC_URL` 填成 `https://api.etherscan.io/v2/api`——Etherscan REST API 不是 JSON-RPC，会导致 RPC 兜底与 `/api/v1/evm/rpc` 均失败。

## JSON-RPC 转发安全

- **现象**：开放任意 JSON-RPC 方法会带来滥用风险。
- **处理**：`POST /api/v1/evm/rpc` 使用**方法白名单**并限制批量条数；见技术方案 §5.2。
