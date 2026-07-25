import * as bip39 from 'bip39';

/**
 * **BIP39** 封装（`bip39`）：侧栏生成/校验助记词；熵与词表由库保证。
 */

export const generateMnemonic = () => {
  return bip39.generateMnemonic();
};

export const validateMnemonic = (mnemonic: string) => {
  return bip39.validateMnemonic(mnemonic);
};

// // 助记词转换为私钥
// export const mnemonicToPrivateKey = (mnemonic: string) => {
//     return bip39.mnemonicToEntropy(mnemonic);
// };

// // 助记词转换为公钥
// export const mnemonicToPublicKey = (mnemonic: string) => {
//     return bip39.mnemonicToPublicKey(mnemonic);
// };

// // 助记词转换为地址
// export const mnemonicToAddress = (mnemonic: string) => {
//     return bip39.mnemonicToAddress(mnemonic);
// };
