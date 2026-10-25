/**
 * **扩展本地自定义 EVM 网络**（P2-3）：由用户在侧栏添加，持久化在
 * `chrome.storage.local`，仅扩展 background / 扩展页读取。
 *
 * 与 `@plugin/shared` 的 `WALLET_BUILTIN_EVM_CHAINS` 分开维护：内置链不可被覆盖，
 * 自定义链也不进入 Web / 服务端的共享链清单。
 */

/** 自定义 EVM 链配置；`chainId` 取 EIP-155 十进制值，`rpcUrl` 已规范化为 HTTP(S) URL。 */
export type CustomEvmChain = {
  /** EIP-155 chainId；保存前已校验为安全正整数，且不能与内置链重复。 */
  chainId: number;
  /** 展示名称，例如 `Local Anvil`。 */
  name: string;
  /** 原生币符号，例如 `ETH`；原生币精度固定按 18 位处理。 */
  nativeSymbol: string;
  /**
   * 用户配置的 JSON-RPC HTTP(S) URL。
   * 仅允许 HTTPS，或 `localhost` / `127.0.0.1` 的 HTTP；可能包含节点访问 key，禁止写入日志。
   */
  rpcUrl: string;
};
