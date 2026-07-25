import { encodeFunctionData, getAddress, isAddress } from 'viem';

/** 与 `packages/contracts/src/evm/BatchSender.sol`（`BatchSender`）一致 */
export const evmBatchSenderAbi = [
  {
    type: 'function',
    name: 'batchSendEth',
    stateMutability: 'payable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'batchSendErc20TransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' }
    ],
    outputs: []
  }
] as const;

export class BatchSenderError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'BatchSenderError';
  }
}

export function getBatchSenderAddressForChain(
  chainId: number
): `0x${string}` | undefined {
  const raw = process.env.EVM_BATCH_SENDER_ADDRESSES_JSON?.trim();
  if (!raw) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }
  const v = (parsed as Record<string, unknown>)[String(chainId)];
  if (typeof v !== 'string' || !isAddress(v)) {
    return undefined;
  }
  return getAddress(v);
}

export type BatchSenderBuildResult = {
  chainId: number;
  batchSenderAddress: `0x${string}`;
  /** 作为交易的 to 字段 */
  to: `0x${string}`;
  /** calldata（可由扩展/前端签名） */
  data: `0x${string}`;
  /** ETH value（wei 十进制字符串） */
  valueWei: string;
};

function normalizeAddresses(list: string[], code: string): `0x${string}`[] {
  const out: `0x${string}`[] = [];
  for (const a of list) {
    if (!isAddress(a)) {
      throw new BatchSenderError(code, 400);
    }
    out.push(getAddress(a));
  }
  return out;
}

function parseUints(list: string[], code: string): bigint[] {
  const out: bigint[] = [];
  for (const s of list) {
    if (typeof s !== 'string' || s.trim() === '') {
      throw new BatchSenderError(code, 400);
    }
    if (!/^\d+$/.test(s.trim())) {
      throw new BatchSenderError(code, 400);
    }
    out.push(BigInt(s.trim()));
  }
  return out;
}

export function buildBatchSendEth(params: {
  chainId: number;
  recipients: string[];
  /** wei 十进制字符串 */
  amountsWei: string[];
}): BatchSenderBuildResult {
  const batchSenderAddress = getBatchSenderAddressForChain(params.chainId);
  if (!batchSenderAddress) {
    throw new BatchSenderError('batch_sender_not_configured', 503);
  }

  if (params.recipients.length !== params.amountsWei.length) {
    throw new BatchSenderError('length_mismatch', 400);
  }

  const recipients = normalizeAddresses(params.recipients, 'invalid_recipient');
  const amounts = parseUints(params.amountsWei, 'invalid_amount');

  let total = 0n;
  for (const a of amounts) total += a;

  const data = encodeFunctionData({
    abi: evmBatchSenderAbi,
    functionName: 'batchSendEth',
    args: [recipients, amounts]
  });

  return {
    chainId: params.chainId,
    batchSenderAddress,
    to: batchSenderAddress,
    data,
    valueWei: total.toString()
  };
}

export function buildBatchSendErc20TransferFrom(params: {
  chainId: number;
  tokenAddress: string;
  recipients: string[];
  /** token 最小单位十进制字符串 */
  amounts: string[];
}): BatchSenderBuildResult {
  const batchSenderAddress = getBatchSenderAddressForChain(params.chainId);
  if (!batchSenderAddress) {
    throw new BatchSenderError('batch_sender_not_configured', 503);
  }

  if (!isAddress(params.tokenAddress)) {
    throw new BatchSenderError('invalid_token_address', 400);
  }

  if (params.recipients.length !== params.amounts.length) {
    throw new BatchSenderError('length_mismatch', 400);
  }

  const token = getAddress(params.tokenAddress);
  const recipients = normalizeAddresses(params.recipients, 'invalid_recipient');
  const amounts = parseUints(params.amounts, 'invalid_amount');

  const data = encodeFunctionData({
    abi: evmBatchSenderAbi,
    functionName: 'batchSendErc20TransferFrom',
    args: [token, recipients, amounts]
  });

  return {
    chainId: params.chainId,
    batchSenderAddress,
    to: batchSenderAddress,
    data,
    valueWei: '0'
  };
}
