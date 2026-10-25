# 安全自检（P4-2 / P4-5 / P2-2 / P2-3 / P2-6）

> **状态**：2026-10-22 完成首轮自检与 P4-5 会话改造；2026-10-23 补充 P2-2 扩展解锁态与 P2-3 自定义 RPC 链；2026-10-25 补充 P2-6 已连接站点导出边界。覆盖当前已实现的扩展 / Web / 服务端边界。
>
> **适用范围**：`apps/extension`、`apps/web`、`apps/server` 与根依赖锁定。接口语义以 [TECHNICAL-SOLUTION.md](./TECHNICAL-SOLUTION.md) §5 为准。

## 1. 信任边界

| 层         | 持有 / 不持有                                                                  | 说明                                                                                                            |
| ---------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 扩展       | **唯一**可解密助记词 / 私钥并签名的端；解密账户仅在 background 内存按 TTL 缓存 | 敏感能力经 background / vault 收敛；解锁态不落盘、不进入 content script / 网页；桥接响应不返回私钥 / 助记词明文 |
| Web        | 不持有私钥、助记词；会话 token 在 **HttpOnly Cookie**，页面只保留 CSRF token   | 只提交公开地址与已签名 raw tx；不接触扩展本地密钥                                                               |
| 服务端     | 不持有用户私钥 / 助记词；只保存 challenge、公开地址、会话与链上公开数据        | 不接收签名原文以外的密钥材料，不把 raw tx / token 写入日志                                                      |
| 第三方数据 | Etherscan / TronGrid / Esplora 只接收公开地址与查询参数，不接收会话或密钥材料  | API Key 仅经服务端环境变量或请求头使用                                                                          |
| 自定义 RPC | 用户显式配置的 RPC URL 存于 `chrome.storage.local`；节点可见公开地址与广播交易 | 不接收助记词 / 私钥；DApp 不能自动添加；仅 HTTPS / localhost HTTP；日志不记录 URL                               |

## 2. 检查清单

| 项目             | 结论             | 实现 / 证据                                                                                                                                                                                                                                     |
| ---------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 密钥边界         | 通过             | 扩展 vault 负责本地加密存储与解密签名；Web / 服务端路由不出现私钥 / 助记词字段；桥接响应不包含明文密钥材料                                                                                                                                      |
| 扩展解锁态       | 通过             | P2-2：解密后的 viem 账户仅存 background 内存，按签名地址隔离；默认空闲 15 分钟、可配 1–120 分钟，支持手动全部锁定；不写 `chrome.storage`；每次签名仍须审批弹窗确认；Service Worker 休眠 / 浏览器重启即失效                                      |
| 自定义 RPC 链    | 通过             | P2-3：用户显式添加，最多 20 条；Chain ID 不可与内置链重复；RPC URL 仅 HTTPS 或 localhost / 127.0.0.1 HTTP；新增 / 修改 RPC 时校验 `eth_chainId`；DApp 的 `wallet_addEthereumChain` 不自动落库，未知链返回 4902；RPC URL 不写日志             |
| 站点列表导出     | 通过             | P2-6：搜索 / 分组只读 `siteAuthSessions`；CSV 仅含 origin、公开 EVM 地址、授权范围、标签页 ID 与 ISO 过期时间，带 UTF-8 BOM 并防公式注入；不导出私钥、助记词、口令、RPC URL 或其他钱包配置                                                  |
| 日志脱敏         | 通过             | Pino `redact` 覆盖 authorization、cookie、`x-csrf-token`、token / csrfToken、privateKey、mnemonic、signature、raw / signed transaction 与 `*.url`；access log 只记录**路由模板**，不记录地址查询串                                              |
| CORS             | 通过             | `SERVER_CORS_ORIGINS` 白名单；开发默认仅 `http://localhost:3000` / `127.0.0.1:3000`；生产未配置时不放行跨域；auth challenge / verify 对非白名单 `Origin` 直接 403；测试覆盖                                                                     |
| CSRF             | 通过             | 浏览器会话改为 HttpOnly Cookie；写接口（tx / logout）要求 `x-csrf-token` = HMAC(SESSION_SECRET, sessionToken)，常量时间比较；`SameSite` 可配（默认 Lax），跨站需 None + Secure；CORS 显式白名单且 `credentials=true`                            |
| 会话安全         | 通过             | challenge 一次性 5 分钟；session token 为 32 字节随机值，服务端只存 SHA-256 摘要，24 小时过期；Cookie `HttpOnly` + `SameSite` + 生产 `Secure`；会话可文件持久化，重启不丢；token 不进 Web 存储                                                  |
| 限流             | 通过（单实例）   | 余额查询匿名 30 / 登录 120 次/分钟；auth challenge / verify 默认 20 次/分钟/IP；固定 60s 窗口、桶数量上限；多实例需 Redis（P4-4）                                                                                                               |
| 安全响应头       | 通过             | 所有 API 响应补 `x-content-type-options: nosniff`、`x-frame-options: DENY`、`referrer-policy: no-referrer`、`permissions-policy`；auth 响应 `cache-control: no-store`                                                                           |
| 代理与客户端 IP  | 通过（默认安全） | 默认 `trustProxy=false`；仅在 `SERVER_TRUST_PROXY=1` 且位于可信反向代理后，才使用 `X-Forwarded-For` 作为限流 IP                                                                                                                                 |
| 请求 ID          | 通过             | 客户端 `x-request-id` 仅接受 `[A-Za-z0-9._-]{1,64}`，否则生成 UUID，避免日志注入 / 超长字段                                                                                                                                                     |
| 依赖审计         | 通过（运行时）   | `pnpm audit --prod` **0 漏洞**；Next **16.4.2**、Fastify **5.12.7**、`@fastify/*` 已升级；`axios` / `fast-uri` / `ws` / `follow-redirects` / `sass` / `@parcel/watcher` 等通过 `pnpm.overrides` 锁定到修复版本；Plasmo 归入扩展 devDependencies |
| 依赖审计（全量） | 有残余           | `pnpm audit` 仍会报告 Plasmo / 构建链的 devDependency 告警（`brace-expansion`、`vite`、`js-yaml`、`sharp` 等），不进入扩展运行时产物；见 §4                                                                                                     |

## 3. 关键配置

| 变量                                        | 作用                                     | 默认 / 要求                                                                                                             |
| ------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `SERVER_CORS_ORIGINS`                       | Web 跨域白名单，逗号分隔的完整 Origin    | 开发默认 `http://localhost:3000,http://127.0.0.1:3000`；生产必须显式配置（同源反代部署也需列入实际 Origin）；不支持 `*` |
| `SERVER_TRUST_PROXY`                        | 是否信任反向代理的 `X-Forwarded-For`     | 默认关闭；仅可信代理后设为 `1`                                                                                          |
| `SERVER_AUTH_RATE_LIMIT_PER_MINUTE`         | auth challenge / verify 每 IP 每分钟限额 | 默认 `20`                                                                                                               |
| `SESSION_SECRET`                            | CSRF token HMAC 密钥                     | 生产**必填**长随机值；缺失则启动失败，开发使用进程级随机 fallback                                                       |
| `SERVER_SESSION_STORE`                      | 会话存储模式                             | `memory` / `file`；开发默认 memory，生产默认 file                                                                       |
| `SERVER_SESSION_FILE`                       | 文件模式路径                             | 默认 `logs/sessions.json`（相对服务端运行目录）；文件权限尽量 0600                                                      |
| `SERVER_COOKIE_SAMESITE`                    | 会话 Cookie SameSite                     | 默认 `lax`；跨站部署设 `none`                                                                                           |
| `SERVER_COOKIE_SECURE`                      | 会话 Cookie Secure                       | 开发默认 `false`，生产默认 `true`；`SameSite=None` 时必须为 `true`                                                      |
| `SERVER_BALANCE_RATE_LIMIT_PER_MINUTE`      | 匿名余额查询每 IP 每分钟限额             | 默认 `30`                                                                                                               |
| `SERVER_BALANCE_AUTH_RATE_LIMIT_PER_MINUTE` | 登录余额查询每会话每分钟限额             | 默认 `120`                                                                                                              |

完整变量表见技术方案 **§5.4** 与 [.env.example](../../.env.example)。

## 4. 已知边界与后续

- **扩展解锁态生命周期受 MV3 限制**：P2-2 的解锁账户只存在 background 内存，Service Worker 被回收或浏览器重启后必须重新输入口令；当前不提供跨 Service Worker 的持久解锁，避免把明文账户或口令写入 `chrome.storage`。
- **解锁期间同扩展页面可发起签名**：解锁态只替代“重复输入口令”，不会跳过审批弹窗；但若扩展页面被 XSS 控制，攻击者可代用户点击确认。扩展页 CSP / 来源校验仍属于后续加固范围。
- **自定义 RPC 是用户信任决策**：P2-3 的 `eth_chainId` 校验只能发现 RPC 配置不一致，不能证明节点诚实；错误或恶意节点可能返回错误数据、拒绝服务或记录公开地址 / 广播交易。RPC URL 可能含 API key，保存在本机 `chrome.storage.local`，列表仅展示 host，日志不记录 URL。
- **站点导出是用户主动数据外带**：P2-6 的 CSV 只含站点来源、公开 EVM 地址、授权范围、标签页 ID 与过期时间，不含密钥材料或 RPC 配置；文件下载后脱离扩展保护，用户应自行保管。
- **会话持久化仍是单实例文件**：`SERVER_SESSION_STORE=file` 解决重启失效，但多实例不能共用本地文件；横向扩展前需接 Redis / DB（P4-4）。
- **CORS 是浏览器读取边界**：非浏览器客户端不受 CORS 限制；敏感写接口仍依赖会话 + CSRF + 签名校验，不以 CORS 代替鉴权。
- **全量依赖审计残余**：`pnpm audit` 的高危项集中在 Plasmo / Parcel / 构建工具链；`pnpm audit --prod` 已清零。构建机仍应视为受控环境，升级 Plasmo 时复跑全量审计。
- **Web CSP / XSS**：当前未配置严格 CSP；Cookie 为 HttpOnly，XSS 不能直接读 token，但仍可代用户发起请求。Web 上线前应补 CSP 与依赖升级策略。
- **E2E 未覆盖**：当前安全测试为服务端集成测试；浏览器端登录 / 签名 / 广播仍由 P4-1 补 E2E。

## 5. 复检命令

```powershell
pnpm audit --prod
pnpm --filter @plugin/server test
pnpm typecheck
pnpm lint
```

服务端安全回归测试位于 `apps/server/test/authSecurity.test.ts`，覆盖 CORS 凭据 / 放行 / 拒绝、非白名单 Origin 的 challenge 拒绝、HttpOnly Cookie 登录、CSRF 拒绝与注销、auth 限流、安全响应头与 `no-store`；`sessionStore.test.ts` 覆盖会话文件加载 / 写入 / 删除，另含 Bearer API 客户端兼容用例。当前服务端测试共 17 项。
