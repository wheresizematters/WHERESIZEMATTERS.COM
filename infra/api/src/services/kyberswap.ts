/**
 * KyberSwap Aggregator — swap any token on Base via V4 Clanker pools.
 *
 * Flow: get route → build calldata → sign & send tx
 * Works for ALL Uniswap V4 Clanker tokens (the hook is permissionless).
 */

const BASE_CHAIN_ID = 8453;
const KYBER_API = "https://aggregator-api.kyberswap.com/base/api/v1";
const NATIVE_ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const WETH_BASE = "0x4200000000000000000000000000000000000006";

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  amountOutUsd: string;
  gas: string;
  priceImpact: number;
  routeSummary: any;
}

export interface SwapTx {
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
}

/**
 * Step 1: Get the best swap route from KyberSwap.
 */
export async function getSwapRoute(
  tokenIn: string,
  tokenOut: string,
  amountIn: string, // in wei
  sender: string,
): Promise<{ quote: SwapQuote; routeSummary: any }> {
  const params = new URLSearchParams({
    tokenIn,
    tokenOut,
    amountIn,
    saveGas: "0",
    gasInclude: "1",
    source: "SIZE",
  });

  const res = await fetch(`${KYBER_API}/routes?${params}`, {
    headers: { "x-client-id": "SIZE" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KyberSwap route failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json.code !== 0 || !json.data?.routeSummary) {
    throw new Error(`No route found: ${json.message ?? "insufficient liquidity"}`);
  }

  const rs = json.data.routeSummary;
  return {
    quote: {
      amountIn: rs.amountIn,
      amountOut: rs.amountOut,
      amountOutUsd: rs.amountOutUsd ?? "0",
      gas: rs.gas ?? "0",
      priceImpact: parseFloat(rs.extra?.priceImpact ?? "0"),
      routeSummary: rs,
    },
    routeSummary: rs,
  };
}

/**
 * Step 2: Build the actual transaction calldata.
 */
export async function buildSwapTx(
  routeSummary: any,
  sender: string,
  recipient: string,
  slippageBps: number = 100, // 1% default
): Promise<SwapTx> {
  const res = await fetch(`${KYBER_API}/route/build`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": "SIZE",
    },
    body: JSON.stringify({
      routeSummary,
      sender,
      recipient,
      slippageTolerance: slippageBps, // in bps
      source: "SIZE",
      skipSimulateTx: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KyberSwap build failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json.code !== 0 || !json.data) {
    throw new Error(`Build failed: ${json.message ?? "unknown"}`);
  }

  return {
    to: json.data.routerAddress,
    data: json.data.data,
    value: json.data.value ?? "0",
    gas: json.data.gas ?? "300000",
    gasPrice: json.data.gasPrice ?? "0",
  };
}

/**
 * Full flow: get quote + build tx in one call.
 */
export async function getSwapQuoteAndTx(opts: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  sender: string;
  recipient?: string;
  slippageBps?: number;
}): Promise<{ quote: SwapQuote; tx: SwapTx }> {
  const { quote, routeSummary } = await getSwapRoute(
    opts.tokenIn,
    opts.tokenOut,
    opts.amountIn,
    opts.sender,
  );

  const tx = await buildSwapTx(
    routeSummary,
    opts.sender,
    opts.recipient ?? opts.sender,
    opts.slippageBps ?? 100,
  );

  return { quote, tx };
}

export { NATIVE_ETH, WETH_BASE, BASE_CHAIN_ID };
