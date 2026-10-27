# 待实现事项（执行清单）

> **状态**：`[ ]` 待办 · `[~]` 进行中 · `[x]` 已完成 · `[!]` 阻塞（需产品 / 技术决策）
>
> **维护规则**：完成一项后，同步更新本文件、[TECHNICAL-SOLUTION.md](./TECHNICAL-SOLUTION.md) §0 修订记录与对应子项目文档；不要只改本文件。
>
> **事实来源**：[TECHNICAL-SOLUTION.md](./TECHNICAL-SOLUTION.md) §5 / §8 / §9 / §10、各 `docs/product/prd-*.md`。
>
> **最后更新**：2026-10-25

## 执行顺序

`P0（已完成）→ P1（已完成）→ P2 → P3 → P4`

P0 已打通「钱包登录 → 签名 → 服务端广播」的最小业务闭环；P1 已把余额查询从联调能力升级为统一 API + 按链独立页面；P4-2 已完成首轮安全自检（CORS 白名单、auth 限流、日志脱敏、运行时依赖审计清零）；P4-5 已完成 HttpOnly Cookie + CSRF + 文件持久化；P2-2 已完成会话级解锁 / 自动锁定；P2-3 已完成自定义 RPC 链；P2-6 已完成已连接站点搜索 / 分组 / 导出；P4-3 已完成安装 / 升级安全引导与商店物料，实际商店提交待发布账号；P4-4 已完成 Prometheus 指标与上游可用性 / 限流观测，多实例共享限流 / 缓存 / 会话仍待 Redis / DB；P4-1 已完成 Web 关键路径 E2E（Playwright + 真实 Fastify + 假上游），扩展 E2E 待补；P2 / P3 其余项仍依赖产品范围与合约主线决策。

---

## P0：登录与交易主闭环（已完成 MVP）

| ID   | 事项                                                     | 状态 | 验收口径                                                                                                                                                |
| ---- | -------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | 服务端 Auth：challenge / verify / me / logout + 会话存储 | [x]  | `POST /api/v1/auth/challenge`、`POST /api/v1/auth/verify`、`GET /api/v1/auth/me`、`POST /api/v1/auth/logout` 可用；签名校验失败返回 401；会话带过期时间 |
| P0-2 | 服务端交易广播：`POST /api/v1/tx/broadcast`              | [x]  | 仅接收已签名 raw tx；校验登录会话、发送方地址、tx chainId 与 `SERVER_RPC_URL` 链一致；返回 tx hash                                                      |
| P0-3 | Web 登录 + 广播联调页（`/account`）                      | [x]  | 连接扩展 → 获取 challenge → `personal_sign` → 建立会话 → `eth_signTransaction` → 服务端广播 → 展示 hash / 错误                                          |

> **本轮执行记录（2026-10-20）**：P0-1 / P0-2 / P0-3 已落地。验证方式：server / web `typecheck` + `lint`；`next build`；浏览器联调 `/account`（连接、challenge、签名失败提示、会话恢复、签名交易、广播错误提示）；服务端 `personal_sign` 校验与 tx 广播成功路径用本地 mock RPC 测试。真实链上广播仍需有余额的测试账户与匹配的 `SERVER_RPC_URL`。

说明：

- 会话已按 P4-5 改为 **HttpOnly Cookie + CSRF**（Web 不再使用 `sessionStorage`）；无 Origin 的 API 客户端仍可拿 Bearer token。
- 会话默认文件持久化（`SERVER_SESSION_STORE=file`，生产默认）；challenge 仍为进程内存；多实例共享需 Redis / DB（后续）。
- 交易广播当前只支持 **EVM**；Tron / BTC 广播需单独设计（见 P2 / 待拍板）。

---

## P1：余额查询产品化与批量能力

| ID   | 事项                                                               | 状态 | 验收口径                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-1 | ERC-20 数据源健壮性（Etherscan-only → 代理 / 备用索引 / 明确降级） | [x]  | 保留 Etherscan-only 但增加 `ETHERSCAN_API_URL` 代理入口、token 缓存（新鲜 60s / stale 30min）与 60s 冷却；不可达时原生余额不受影响，行内 `etherscan_unreachable` + 可操作提示                                                     |
| P1-2 | 统一多链批量查询 API + 鉴权 / 限流 / QPS / 缓存                    | [x]  | `POST /api/v1/balances/query` + `GET /api/v1/balances/status`；每链 ≤20、三组并行；匿名 30 / 登录 120 次/分钟、缓存 15s / stale 5min；Tron / BTC 串行节流沿用                                                                     |
| P1-3 | `/balances` 升级为链选择入口 + 三链独立查询页                      | [x]  | `/balances` 为链选择卡片；`/balances/evm`、`/balances/tron`、`/balances/btc` 各自只展示当前链表单 / 结果并只提交一个 group；地址去重 / 校验、每链 20 条限制、请求取消、分页 / CSV 导出、空态 / 部分失败提示；原始 JSON 收进调试区 |
| P1-4 | 余额查询 E2E 与回归                                                | [x]  | `pnpm --filter @plugin/server test` 覆盖 EVM 原生 / ERC-20、Tron、BTC 成功 / 部分失败 / 全链不可达、非法地址、鉴权、限流、ERC-20 stale；CI 已增加 Test server                                                                     |

> **本轮执行记录（2026-10-22）**：P1-1 ~ P1-4 已落地。验证方式：`@plugin/shared` 重建；server `typecheck` / `lint` / `test`（9 项集成测试）；web `typecheck` / `lint` / `next build`；浏览器手工验证 `/balances` 入口及 `/balances/evm`、`/balances/tron`、`/balances/btc` 三张独立页（单链查询、取消、分页、CSV、空态 / 部分失败与 ERC-20 不可达提示；本地 Etherscan 网络不可达时 EVM 原生余额仍正常返回）。
>
> **仍存边界**：ERC-20 仍**只依赖 Etherscan**，无备用索引器；缓存 / 限流为**进程内存**，多实例需 Redis 等共享实现；Web 端 E2E 与真实链上大批量回归归入 P4-1 / 后续。

---

## P2：插件多链与钱包能力

| ID   | 事项                                               | 状态 | 验收口径                                                                 |
| ---- | -------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| P2-1 | 多钱包档案（创建 / 切换 / 删除，档案内 HD 多账户） | [ ]  | 档案隔离、命名与上限明确；切换后站点会话与默认账户行为一致               |
| P2-2 | 会话级解锁 / 自动锁定                              | [x]  | 解锁态有 TTL；签名不再每次输入口令；锁定后敏感操作重新验证               |
| P2-3 | 自定义 RPC 链                                      | [x]  | 可添加 / 编辑 / 删除链；只读 RPC 与切链校验；不破坏内置链                |
| P2-4 | Tron DApp：`tronweb` + TronLink 风格注入与签名     | [ ]  | 注入目标与 TIP-1193 / TronLink 约定一致；账户请求、消息 / 交易签名可联调 |
| P2-5 | BTC 钱包与签名                                     | [ ]  | 当前仅有地址派生；补齐持有、签名与 DApp 交互边界                         |
| P2-6 | 已连接站点搜索 / 分组 / 导出                       | [x]  | 站点多时可用；不泄露密钥材料                                             |
| P2-7 | 生产级 DApp 全量验收                               | [ ]  | 主流 DApp 连接、签名、交易、切链路径回归                                 |

> **P2-2 执行记录（2026-10-23）**：解密后的 viem 账户仅缓存在 background 内存（`vault/unlockSession.ts`），按签名地址隔离；空闲 TTL 默认 **15 分钟**，可在侧栏「DApp 全局设置 → 账户解锁」调整为 **1–120 分钟**，成功签名 / 广播后重新计时；支持「立即锁定全部」。EVM 的 `personal_sign` / `eth_sign`、EIP-712、`eth_sendTransaction` / `eth_signTransaction` 在解锁态下免重复输入口令，仍保留每个审批弹窗的确认；锁定、TTL 过期、账户已从 vault 删除或 Service Worker 休眠后，下一次签名必须重新输入口令。解锁态不写 `chrome.storage`，不进入 content script / 网页。验证：扩展 `typecheck` / `lint` / `plasmo build`；浏览器手工回归待 P4-1。
>
> **P2-3 执行记录（2026-10-23）**：侧栏「DApp 全局设置 → 网络与自定义 RPC」支持切换内置链、新增 / 编辑 / 删除最多 **20** 个本地自定义 EVM 网络（存储键 `web3_wallet_custom_evm_chains_v1`）。保存时校验 Chain ID 不与内置链 / 已有自定义链重复；新增网络或修改 RPC URL 时调用 `eth_chainId` 确认链一致；RPC URL 仅允许 HTTPS 或 `localhost` / `127.0.0.1` 的 HTTP，拒绝内嵌凭据与 fragment。自定义链进入 `eth_getBalance` / `eth_blockNumber` / `eth_sendRawTransaction` 与 `eth_sendTransaction` / `eth_signTransaction` 的当前链路径；`wallet_switchEthereumChain` 可切换到已配置自定义链，`wallet_addEthereumChain` **不自动添加**未知链（DApp 传入的 `rpcUrls` 不作为信任来源，返回 4902）。RPC URL 不写日志，侧栏仅显示 host。验证：扩展 `typecheck` / `lint` / `plasmo build`；浏览器手工回归待 P4-1。
>
> **P2-6 执行记录（2026-10-25）**：侧栏「DApp 全局设置 → 已连接网站」新增搜索、分组与 CSV 导出。搜索不区分大小写，支持 origin / 公开地址及空格分隔组合词；分组可选不分组、按暴露地址、按授权范围（持久 / 定时 / 仅当前标签）。导出仅针对当前筛选结果，字段限定为站点 origin、公开 EVM 地址、授权范围、标签页 ID 与 ISO 过期时间，并做 CSV 公式注入防护与 UTF-8 BOM；不读取或输出私钥、助记词、口令、RPC URL 等其他配置。视图逻辑集中在 `connectedSitesView.ts`，侧栏只负责交互与展示。验证：扩展 `typecheck` / `lint` / `plasmo build`；临时 Node 脚本覆盖筛选、分组、范围文案与 CSV 内容；浏览器手工回归待 P4-1。

---

## P3：合约与业务主线

| ID   | 事项                                                     | 状态 | 验收口径                                                   |
| ---- | -------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| P3-1 | 业务主线合约（Token / NFT / 质押等至少一条清晰用户故事） | [ ]  | 合约行为、测试与产品验收口径一致；先定主线再做实现         |
| P3-2 | 部署与地址登记流程（脚本 → 地址表 → shared / 配置）      | [ ]  | 可重复部署；地址按 chainId / 环境注入；服务端与 Web 可消费 |
| P3-3 | Tron TVM 合约                                            | [!]  | 另立项；需先确认 Tron 业务范围与资源模型                   |

---

## P4：质量、安全与发布

| ID   | 事项                                              | 状态 | 验收口径                                                                                            |
| ---- | ------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| P4-1 | Web / 扩展 E2E                                    | [~]  | 覆盖登录、签名、广播、余额查询关键路径；CI 可运行（Web 阶段已完成，扩展阶段待补）                   |
| P4-2 | 安全自检清单                                      | [x]  | 密钥边界、日志脱敏、CORS、CSRF、会话 / 限流、依赖审计逐项通过；清单见 [security.md](./security.md)  |
| P4-3 | 商店物料与首次运行引导                            | [x]  | 商店页、隐私说明、备份与安全提示、安装 / 升级引导（仓库侧完成；实际提交待发布账号）                 |
| P4-4 | 监控与运维                                        | [x]  | 错误率、上游限流、RPC / Etherscan / TronGrid / Esplora 可用性可观测（进程内指标；多实例共享待后续） |
| P4-5 | 会话安全生产化（HttpOnly Cookie / CSRF / 持久化） | [x]  | 不依赖 `sessionStorage`；跨站部署安全策略明确                                                       |

> **P4-5 执行记录（2026-10-22）**：浏览器 `verify` 写 `wallet_session` HttpOnly Cookie（默认 `SameSite=Lax`、生产 `Secure`）；`/auth/me` 返回 CSRF token，`/tx/broadcast` 与 `/auth/logout` 校验 `x-csrf-token`；无 Origin 的 API 客户端仍走 Bearer。会话支持 `SERVER_SESSION_STORE=file` 原子落盘（默认 `logs/sessions.json`），生产缺 `SESSION_SECRET` 启动失败。CORS 改为允许凭据并放行 `x-csrf-token`。Web `/account` 与 `/balances` 已移除 `sessionStorage`。验证：server 17 项测试、`pnpm typecheck` / `lint` / `build`。跨站部署需同时设置 `SERVER_COOKIE_SAMESITE=none`、`SERVER_COOKIE_SECURE=1` 与 HTTPS；多实例共享（会话 / 限流 / 缓存）仍待 Redis / DB（后续）。
>
> **P4-3 执行记录（2026-10-25）**：新增扩展页 `tabs/welcome.tsx` 与后台启动辅助 `utils/extension/onboarding.ts`。`chrome.runtime.onInstalled` 在**首次安装或版本变化**时打开「安全与使用指南」：安装前台打开、升级后台打开；同版本重载不重复弹页（状态键 `web3_wallet_onboarding_launch_v1`，仅存最近版本号）。引导页覆盖离线备份、逐笔签名核对、本地口令解密、自定义 RPC 信任边界、隐私说明与 manifest 权限用途；侧栏概览新增常驻入口。商店侧新增 [extension-store-listing.md](../product/extension-store-listing.md)（商品文案、截图脚本、隐私实践答复、发布检查清单）与 [extension-privacy-policy.md](../product/extension-privacy-policy.md)（本地数据、RPC / DApp 通信、保留与删除）；`package.json` 更新商店名称与简短描述。验证：扩展 `typecheck` / `lint` / `plasmo build`。**实际商店提交仍需**公开隐私政策 URL、支持链接、商店账号与 4–5 张无敏感数据的截图；当前 `host_permissions` 含 `https://*/*` 以支持自定义 RPC，后续可评估 optional host permissions。
>
> **P4-4 执行记录（2026-10-25）**：新增 `GET /metrics`（Prometheus text format），仅在配置 `SERVER_METRICS_TOKEN` 时启用，要求 `Authorization: Bearer <token>`（常量时间比较）；未配置返回 404。指标覆盖 HTTP 请求 / 4xx / 5xx / 耗时、本地 auth / 余额限流拒绝，以及 RPC / Etherscan / TronGrid / Esplora 的成功 / 失败 / 上游限流 / 最近成败时间戳 / Etherscan 冷却剩余时间；标签只含路由模板、方法、状态码与上游名，不含地址、URL、API Key 或请求体。实现见 `src/observability/metrics.ts`、`prometheusText.ts`、`src/routes/metrics.ts`；HTTP 采集在 `app.ts` 的 `onResponse`，上游封装覆盖 `rpcForward` / `etherscanV2` / `tronGrid` / `esplora` / `balanceReaderQuery`。验证：server `typecheck` / `lint` / `test`（23 项）。**边界**：指标为进程内存、单实例；多实例共享限流 / 缓存 / 会话仍需 Redis / DB，告警规则与仪表盘由部署侧配置。
>
> **P4-1 执行记录（2026-10-28，Web 阶段）**：新增 `packages/e2e`（`@plugin/e2e`），Playwright 启动三个本地进程——Next dev（`127.0.0.1:3100`）、真实 Fastify（`127.0.0.1:8788`）与假上游（`127.0.0.1:8799`，EVM JSON-RPC / Etherscan / TronGrid / Esplora）。`support/mockWallet.ts` 注入 EIP-6963 / EIP-1193 mock provider，页面只转发请求，签名在 Node 侧用公开 Hardhat 测试账户完成。用例覆盖 `/account` 连接 → challenge → `personal_sign` → HttpOnly Cookie 会话 → `eth_signTransaction` → 服务端广播 → 刷新恢复会话，以及 EVM 原生 + ERC-20、Tron TRX + TRC-20、BTC 已确认余额。余额用例先等待客户端「服务状态」探测完成再输入，规避 hydration 前填写受控 textarea 的竞态。根命令 `pnpm test:e2e`；CI 新增独立 `e2e` job（安装 Chromium 后执行）。验证：`@plugin/e2e` `typecheck` / `lint`、4 项 E2E 连续两次通过。**扩展 E2E 尚未实现**（需加载构建产物、钱包初始化与审批页交互），故 P4-1 保持进行中。

---

## 待拍板 / 调研

| ID  | 事项                                     | 状态 | 说明                                                                                                       |
| --- | ---------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------- |
| D-1 | EVM 目标链、测试网 / 主网、RPC 供应商    | [!]  | 影响 `SERVER_RPC_URL`、Web 默认链与合约地址表                                                              |
| D-2 | Tron 网络与 API Key 策略                 | [!]  | 主网 / 测试网、TronGrid 配额与限流                                                                         |
| D-3 | BTC 是否提供代广播及合规边界             | [!]  | 当前仅只读地址余额；广播能力与合规需确认                                                                   |
| D-4 | 批量查询限额 / QPS / 缓存 / 是否登录可见 | [x]  | 已拍板：每链 ≤20；匿名 30 / 登录 120 次/分钟；缓存 15s + stale 5min；匿名可用、登录限额更高（实现见 P1-2） |
| D-5 | ERC-4337 调研                            | [ ]  | UserOperation / Bundler / Paymaster 在资金分散 / 归集场景的可行性；结论前不绑定实现                        |

---

## 相关文档

- 技术与接口：[TECHNICAL-SOLUTION.md](./TECHNICAL-SOLUTION.md) §5.2 / §8 / §9 / §10
- 服务端：[server.md](./server.md)、[prd-server.md](../product/prd-server.md)
- Web：[web.md](./web.md)、[prd-web.md](../product/prd-web.md)
- 扩展：[extension.md](./extension.md)、[prd-extension.md](../product/prd-extension.md)
- 合约：[contracts.md](./contracts.md)、[prd-contracts.md](../product/prd-contracts.md)
- 排障：[runbook/issues-and-solutions.md](../runbook/issues-and-solutions.md)
