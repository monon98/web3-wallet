/**
 * **地址生成标签页**（`tabs/generateAccounts`）用的链目标、BTC 脚本类型与导出格式枚举。
 * 与 `~web3/evm/addressGenerator`、`~web3/tvm/tvmAddressGenerator`、`~web3/btc/btcAddressGenerator` 的入参对齐；不含助记词/私钥等敏感字段。
 */

/** 生成目标链 */
export type AddressGenerationChain = 'evm' | 'tvm' | 'btc';

/** Bitcoin 主网常用脚本类型（对应 BIP44/49/84/86 路径前缀） */
export type BtcAddressScriptKind = 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh' | 'p2tr';

/** Bitcoin 主网 / 测试网（路径 coin type：主网 `0'`，测试网 `1'`） */
export type BtcNetworkKind = 'mainnet' | 'testnet';

/** 表格导出编码 */
export type AddressTableExportFormat = 'csv' | 'json';

/** JSON 导出外形：`flat` 为纯数组；`envelope` 带元数据便于其他程序消费 */
export type AddressJsonExportShape = 'flat' | 'envelope';

/** JSON 导出可选字段（未勾选则不出现在对象中） */
export type AddressJsonFieldKey =
  | 'chain'
  | 'path'
  | 'addressMain'
  | 'addressExtra'
  | 'btcScriptKind'
  | 'btcNetwork'
  | 'privateKeyHex'
  | 'privateKeyWif';
