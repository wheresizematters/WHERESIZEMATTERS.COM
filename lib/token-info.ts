/**
 * On-chain token info via Chainstack RPC.
 * Fetches market cap, holder data, and pool stats for DickCoins.
 */

import { RPC_URL } from './web3';

// ERC-20 selectors
const SEL_TOTAL_SUPPLY = '0x18160ddd';
const SEL_DECIMALS     = '0x313ce567';
const SEL_NAME         = '0x06fdde03';
const SEL_SYMBOL       = '0x95d89b41';
const SEL_BALANCE_OF   = '0x70a08231';

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_call',
      params: [{ to, data }, 'latest'],
    }),
  });
  const json = await res.json();
  return json.result ?? '0x';
}

function padAddress(addr: string): string {
  return addr.slice(2).toLowerCase().padStart(64, '0');
}

function decodeUint(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex.length > 66 ? '0x' + hex.slice(2, 66) : hex);
}

function decodeString(hex: string): string {
  if (!hex || hex.length < 130) return '';
  try {
    const offset = parseInt(hex.slice(2, 66), 16) * 2;
    const len = parseInt(hex.slice(offset + 2, offset + 66), 16);
    const strHex = hex.slice(offset + 66, offset + 66 + len * 2);
    const bytes: number[] = [];
    for (let i = 0; i < strHex.length; i += 2) bytes.push(parseInt(strHex.substr(i, 2), 16));
    return String.fromCharCode(...bytes);
  } catch { return ''; }
}

// ── Public API ─────────────────────────────────────────────────────

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  totalSupplyFormatted: string;
}

export interface TokenMarketData {
  address: string;
  name: string;
  symbol: string;
  totalSupply: string;
  ethPrice: number;         // ETH/USD
  poolEthBalance: string;   // ETH in the Uniswap pool
  marketCapUsd: number;
  priceUsd: number;
  holderCount: number;
}

export async function getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
  try {
    const [nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all([
      ethCall(tokenAddress, SEL_NAME),
      ethCall(tokenAddress, SEL_SYMBOL),
      ethCall(tokenAddress, SEL_DECIMALS),
      ethCall(tokenAddress, SEL_TOTAL_SUPPLY),
    ]);

    const decimals = Number(decodeUint(decimalsHex));
    const totalSupply = decodeUint(supplyHex);
    const formatted = (Number(totalSupply) / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: 0 });

    return {
      address: tokenAddress,
      name: decodeString(nameHex),
      symbol: decodeString(symbolHex),
      decimals,
      totalSupply: totalSupply.toString(),
      totalSupplyFormatted: formatted,
    };
  } catch {
    return null;
  }
}

export async function getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
  try {
    const result = await ethCall(tokenAddress, SEL_BALANCE_OF + padAddress(walletAddress));
    const raw = decodeUint(result);
    return (Number(raw) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return '0';
  }
}

export async function getEthBalance(walletAddress: string): Promise<string> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_getBalance',
        params: [walletAddress, 'latest'],
      }),
    });
    const json = await res.json();
    const wei = BigInt(json.result ?? '0');
    return (Number(wei) / 1e18).toFixed(4);
  } catch {
    return '0';
  }
}

// Format helpers
export function formatMarketCap(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

export function formatPrice(usd: number): string {
  if (usd < 0.000001) return `$${usd.toExponential(2)}`;
  if (usd < 0.01) return `$${usd.toFixed(6)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
