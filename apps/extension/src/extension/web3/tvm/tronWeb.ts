import TronWeb from 'tronweb';

export type TronWebAddressApi = {
  fromPrivateKey: (privateKeyNo0x: string) => string | false;
  toHex: (base58: string) => string;
};

type TronWebStaticApi = {
  createAccount?: () => Promise<{
    privateKey: string;
    address: { base58: string; hex: string };
  }>;
  address?: TronWebAddressApi;
  utils?: { address?: TronWebAddressApi };
};

/**
 * TVM(Tron) 三方库封装：统一收口 `tronweb` 的静态 API（生成账户、地址转换）。
 * 业务代码应仅从 `~web3/tvm/tronWeb` 引用，避免散落的三方库 import。
 */

export function tronWebAddressApi(): TronWebAddressApi {
  const tw = TronWeb as unknown as TronWebStaticApi;
  const addr = tw.address ?? tw.utils?.address;
  if (!addr?.fromPrivateKey || !addr?.toHex) {
    throw new Error('tronweb_address_api_unavailable');
  }
  return addr;
}

export function tronWebCreateAccount(): NonNullable<TronWebStaticApi['createAccount']> {
  const tw = TronWeb as unknown as TronWebStaticApi;
  if (typeof tw.createAccount !== 'function') {
    throw new Error('tronweb_create_account_unavailable');
  }
  return tw.createAccount.bind(tw);
}
