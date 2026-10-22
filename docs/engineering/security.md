# 安全自检（P4-2）

> **状态**：2026-10-22 完成首轮自检。覆盖当前已实现的扩展 / Web / 服务端边界；生产级 Cookie 会话仍见 [BACKLOG.md](./BACKLOG.md) P4-5。
>
> **适用范围**：`apps/extension`、`apps/web`、`apps/server` 与根依赖锁定。接口语义以 [TECHNICAL-SOLUTION.md](./TECHNICAL-SOLUTION.md) §5 为准。

## 1. 信任边界

| 层         | 持有 / 不持有                                                                 | 说明                                                                |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 扩展       | **唯一**可解密助记词 / 私钥并签名的端                                         | 敏感能力经 background / vault 收敛；桥接响应不返回私钥 / 助记词明文 |
| Web        | 不持有私钥、助记词；只持有服务端签发的 Bearer token（`sessionStorage`）       | 只提交公开地址与已签名 raw tx；不接触扩展本地密钥                   |
| 服务端     | 不持有用户私钥 / 助记词；只保存 challenge、公开地址、会话与链上公开数据       | 不接收签名原文以外的密钥材料，不把 raw tx / token 写入日志          |
| 第三方数据 | Etherscan / TronGrid / Esplora 只接收公开地址与查询参数，不接收会话或密钥材料 | API Key 仅经服务端环境变量或请求头使用                              |

## 2. 检查清单

| 项目             | 结论             | 实现 / 证据                                                                                                                                                                                                                                     |
| ---------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 密钥边界         | 通过             | 扩展 vault 负责本地加密存储与解密签名；Web / 服务端路由不出现私钥 / 助记词字段；桥接响应不包含明文密钥材料                                                                                                                                      |
| 日志脱敏         | 通过             | Pino `redact` 覆盖 authorization、cookie、token、privateKey、mnemonic、signature、raw / signed transaction 与 `*.url`；access log 只记录**路由模板**，不记录地址查询串                                                                          |
| CORS             | 通过             | `SERVER_CORS_ORIGINS` 白名单；开发默认仅 `http://localhost:3000` / `127.0.0.1:3000`；生产未配置时不放行跨域；auth challenge / verify 对非白名单 `Origin` 直接 403；测试覆盖                                                                     |
| CSRF             | 不适用 / 有边界  | 当前 Bearer 放在 `Authorization`，浏览器不会自动携带，传统 CSRF 不成立；P4-5 若改 HttpOnly Cookie，必须同时补 CSRF token、`SameSite` 与 CORS 策略                                                                                               |
| 会话安全         | 通过（MVP）      | challenge 一次性 5 分钟；session token 为 32 字节随机值，服务端只存 SHA-256 摘要，24 小时过期；challenge / session Map 有上限与过期清理                                                                                                         |
| 限流             | 通过（单实例）   | 余额查询匿名 30 / 登录 120 次/分钟；auth challenge / verify 默认 20 次/分钟/IP；固定 60s 窗口、桶数量上限；多实例需 Redis（P4-4 / P4-5）                                                                                                        |
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
| `SERVER_BALANCE_RATE_LIMIT_PER_MINUTE`      | 匿名余额查询每 IP 每分钟限额             | 默认 `30`                                                                                                               |
| `SERVER_BALANCE_AUTH_RATE_LIMIT_PER_MINUTE` | 登录余额查询每会话每分钟限额             | 默认 `120`                                                                                                              |

完整变量表见技术方案 **§5.4** 与 [.env.example](../../.env.example)。

## 4. 已知边界与后续

- **会话仍为进程内存**：服务重启失效、多实例不共享；Web 仍使用 `sessionStorage`。迁移到 HttpOnly Cookie / Redis 时同步补 CSRF 与持久化（P4-5）。
- **CORS 是浏览器读取边界**：非浏览器客户端不受 CORS 限制；对敏感写接口仍依赖 Bearer / 签名校验，不以 CORS 代替鉴权。
- **全量依赖审计残余**：`pnpm audit` 的高危项集中在 Plasmo / Parcel / 构建工具链；`pnpm audit --prod` 已清零。构建机仍应视为受控环境，升级 Plasmo 时复跑全量审计。
- **Web CSP / XSS**：当前未配置严格 CSP；Bearer token 在 `sessionStorage`，XSS 可读取。Web 上线前应补 CSP 与依赖升级策略（P4-5）。
- **E2E 未覆盖**：当前安全测试为服务端集成测试；浏览器端登录 / 签名 / 广播仍由 P4-1 补 E2E。

## 5. 复检命令

```powershell
pnpm audit --prod
pnpm --filter @plugin/server test
pnpm typecheck
pnpm lint
```

服务端安全回归测试位于 `apps/server/test/authSecurity.test.ts`，覆盖 CORS 放行 / 拒绝、非白名单 Origin 的 challenge 拒绝、auth 限流、安全响应头与 `no-store`。
