/**
 * DickCoin — personal memecoin launch + query via Clanker on Base.
 *
 * Each verified user can deploy one DickCoin (ERC-20) through Clanker's
 * Uniswap V4 factory. The coin gets a Circle Jerk (token-gated group chat)
 * automatically.
 */

import { TOKEN_ADDRESS, RPC_URL, BASE_CHAIN_ID_HEX } from './web3';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

// ── Clanker deployment ─────────────────────────────────────────────

export interface DickCoinDeployParams {
  name: string;           // e.g. "JackCoin"
  ticker: string;         // e.g. "$JACK", max 8 chars
  description?: string;   // optional, max 280 chars
  imageUrl: string;       // uploaded to Supabase Storage
  creatorAddress: string; // wallet address on Base
}

export interface DickCoinDeployResult {
  contractAddress: string;
  poolAddress: string;
  txHash: string;
  error: string | null;
}

export interface DickCoin {
  contractAddress: string;
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  userId: string;
  creatorUsername: string;
  poolAddress: string;
  totalVolume: number;
  totalFeesEarned: number;
  holderCount: number;
  hasStaking: boolean;
  createdAt: string;
}

export interface DickCoinHolder {
  holderAddress: string;
  userId: string | null;
  username: string | null;
  balance: string;
  tier: 'DADDY' | 'FINISHER' | 'EDGER' | 'STROKER' | 'CUCK';
  tierNumber: number;
}

/**
 * Deploy a DickCoin via Clanker SDK.
 * This calls the backend which holds the Clanker deployment keys.
 */
export async function launchDickCoin(
  params: DickCoinDeployParams,
  authToken: string,
): Promise<DickCoinDeployResult> {
  if (!API_BASE) return { contractAddress: '', poolAddress: '', txHash: '', error: 'API not configured' };

  const res = await fetch(`${API_BASE}/api/v1/dickcoins/launch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Launch failed' }));
    return { contractAddress: '', poolAddress: '', txHash: '', error: err.error ?? 'Launch failed' };
  }

  return res.json();
}

// ── Queries ────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, token?: string): Promise<T | null> {
  if (!API_BASE) return null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function getDickCoinsByUser(userId: string): Promise<DickCoin[]> {
  return (await apiFetch<DickCoin[]>(`/api/v1/dickcoins/user/${userId}`)) ?? [];
}

export async function getDickCoinInfo(contractAddress: string): Promise<DickCoin | null> {
  return apiFetch<DickCoin>(`/api/v1/dickcoins/${contractAddress}`);
}

export async function getDickCoinHolders(contractAddress: string): Promise<DickCoinHolder[]> {
  return (await apiFetch<DickCoinHolder[]>(`/api/v1/dickcoins/${contractAddress}/holders`)) ?? [];
}

export async function getMyCircleJerks(token: string): Promise<DickCoin[]> {
  return (await apiFetch<DickCoin[]>('/api/v1/dickcoins/my-circle-jerks', token)) ?? [];
}

export async function getTrendingDickCoins(): Promise<DickCoin[]> {
  return (await apiFetch<DickCoin[]>('/api/v1/dickcoins/trending')) ?? [];
}

// ── Tier helpers ───────────────────────────────────────────────────

export const CJ_TIERS = [
  { number: 0, name: 'NONE',     color: '#666' },
  { number: 1, name: 'CUCK',     color: '#6b7280' },
  { number: 2, name: 'STROKER',  color: '#3b82f6' },
  { number: 3, name: 'EDGER',    color: '#8b5cf6' },
  { number: 4, name: 'FINISHER', color: '#ea580c' },
  { number: 5, name: 'DADDY',    color: '#d97706' },
] as const;

export function getTierInfo(tier: string) {
  return CJ_TIERS.find(t => t.name === tier) ?? CJ_TIERS[0];
}

export function canWriteGeneral(tier: string): boolean {
  const t = CJ_TIERS.find(c => c.name === tier);
  return (t?.number ?? 0) >= 2; // Stroker+
}

export function canWriteBukake(tier: string): boolean {
  const t = CJ_TIERS.find(c => c.name === tier);
  return (t?.number ?? 0) >= 4; // Finisher+
}
