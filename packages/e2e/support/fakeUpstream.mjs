import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

/**
 * E2E 专用假上游：同时模拟 EVM JSON-RPC、Etherscan、TronGrid 与 Esplora。
 *
 * 调用方：`packages/e2e/playwright.config.ts` 启动本进程，并通过环境变量把
 * `SERVER_RPC_URL` / `ETHERSCAN_API_URL` / `SERVER_TRON_API_URL` / `SERVER_BTC_API_URL`
 * 指向这里。所有返回值固定，避免 E2E 访问真实链或第三方 API。
 *
 * 安全边界：只使用公开测试地址与固定假数据，不接收、不记录任何私钥 / 助记词 / 真实 API Key。
 */

const HOST = '127.0.0.1';
const PORT = Number(process.env.E2E_UPSTREAM_PORT ?? '8799');
const EVM_CHAIN_ID_HEX = '0x1';
const NATIVE_BALANCE_WEI = '0xde0b6b3a7640000'; // 1 ETH
const GAS_PRICE_HEX = '0x3b9aca00'; // 1 gwei
const GAS_LIMIT_HEX = '0x5208'; // 21000
const USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

function sendJson(res, body, status = 200) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : undefined;
}

function handleRpcCall(call) {
  const id = call?.id ?? null;
  const method = call?.method;
  let result;
  switch (method) {
    case 'eth_chainId':
      result = EVM_CHAIN_ID_HEX;
      break;
    case 'eth_getBalance':
      result = NATIVE_BALANCE_WEI;
      break;
    case 'eth_getTransactionCount':
      result = '0x0';
      break;
    case 'eth_estimateGas':
      result = GAS_LIMIT_HEX;
      break;
    case 'eth_gasPrice':
      result = GAS_PRICE_HEX;
      break;
    case 'eth_blockNumber':
      result = '0x1';
      break;
    case 'eth_sendRawTransaction': {
      // 返回稳定 32 字节哈希，便于测试断言；不把 raw tx 写日志。
      const rawTx = typeof call?.params?.[0] === 'string' ? call.params[0] : '';
      result = `0x${createHash('sha256').update(rawTx).digest('hex')}`;
      break;
    }
    case 'eth_getTransactionReceipt':
      result = null;
      break;
    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `method_not_found: ${String(method)}` }
      };
  }
  return { jsonrpc: '2.0', id, result };
}

function etherscanTokenResponse() {
  return {
    status: '1',
    message: 'OK',
    result: [
      {
        TokenAddress: USDT_CONTRACT,
        TokenName: 'Tether USD',
        TokenSymbol: 'USDT',
        TokenQuantity: '2500000',
        TokenDivisor: '1000000'
      }
    ]
  };
}

function tronAccountResponse() {
  return {
    success: true,
    data: [
      {
        // 2 TRX（sun，6 位小数）
        balance: 2_000_000,
        trc20: [{ [TRON_USDT_CONTRACT]: '1500000' }]
      }
    ]
  };
}

function btcAddressResponse() {
  return {
    chain_stats: {
      funded_txo_sum: 50_000_000,
      spent_txo_sum: 0,
      tx_count: 3
    },
    mempool_stats: {
      funded_txo_sum: 0,
      spent_txo_sum: 0,
      tx_count: 0
    }
  };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/rpc') {
      const body = await readJsonBody(req);
      const response = Array.isArray(body)
        ? body.map(handleRpcCall)
        : handleRpcCall(body);
      sendJson(res, response);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/etherscan') {
      sendJson(res, etherscanTokenResponse());
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/tron/v1/accounts/')) {
      sendJson(res, tronAccountResponse());
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/btc/address/')) {
      sendJson(res, btcAddressResponse());
      return;
    }

    sendJson(res, { error: 'not_found', path: url.pathname }, 404);
  } catch {
    // 测试辅助进程不输出请求内容，避免任何潜在敏感数据进入日志。
    sendJson(res, { error: 'invalid_request' }, 400);
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `e2e fake upstream listening on http://${HOST}:${PORT}\n`
  );
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
