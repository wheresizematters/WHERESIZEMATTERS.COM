/**
 * DickCoin — personal memecoin launch + query via Clanker on Base.
 *
 * Each verified user can deploy one DickCoin (ERC-20) through Clanker's
 * Uniswap V4 factory. The coin gets a Circle Jerk (token-gated group chat)
 * automatically. The creator can customize role names and token thresholds.
 */

import { getToken, getApiUrl } from './supabase';

const API_BASE = getApiUrl();

// ── Types ──────────────────────────────────────────────────────────

export interface CircleJerkRole {
  tier: number;          // 1-5
  name: string;          // custom name, e.g. "Intern", "Partner", "CEO"
  minTokens: string;     // minimum tokens required (BigInt as string)
  canWriteGeneral: boolean;
  canWriteBukake: boolean;
  color: string;
}

export interface CircleJerkConfig {
  roles: CircleJerkRole[];
  generalChannelName: string;   // default "General"
  bukakeChannelName: string;    // default "Inner Circle" (creator can rename)
}

export const DEFAULT_ROLES: CircleJerkRole[] = [
  { tier: 1, name: 'Cuck',     minTokens: '1',           canWriteGeneral: false, canWriteBukake: false, color: '#6b7280' },
  { tier: 2, name: 'Stroker',  minTokens: '1000',        canWriteGeneral: true,  canWriteBukake: false, color: '#3b82f6' },
  { tier: 3, name: 'Edger',    minTokens: '10000',       canWriteGeneral: true,  canWriteBukake: false, color: '#8b5cf6' },
  { tier: 4, name: 'Finisher', minTokens: '100000',      canWriteGeneral: true,  canWriteBukake: true,  color: '#ea580c' },
  { tier: 5, name: 'Daddy',    minTokens: '1000000',     canWriteGeneral: true,  canWriteBukake: true,  color: '#d97706' },
];

export const DEFAULT_CONFIG: CircleJerkConfig = {
  roles: DEFAULT_ROLES,
  generalChannelName: 'General',
  bukakeChannelName: 'Inner Circle',
};

export interface DickCoinDeployParams {
  name: string;
  ticker: string;
  description?: string;
  imageUrl: string;
  creatorAddress: string;
  circleJerkConfig?: CircleJerkConfig; // optional — uses defaults if not set
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
  circleJerkConfig: CircleJerkConfig;
  createdAt: string;
}

export interface DickCoinHolder {
  holderAddress: string;
  userId: string | null;
  username: string | null;
  balance: string;
  tier: number;       // 1-5
  tierName: string;    // custom role name
}

// ── API helpers ────────────────────────────────────────────────────

async function apiFetch<T>(path: string, authToken?: string): Promise<T | null> {
  if (!API_BASE) return null;
  const token = authToken ?? getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function apiPost<T>(path: string, body: any, authToken?: string): Promise<T | null> {
  if (!API_BASE) return null;
  const token = authToken ?? getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error ?? 'Request failed' } as any;
    }
    return res.json();
  } catch { return null; }
}

// ── Launch ─────────────────────────────────────────────────────────

export async function launchDickCoin(
  params: DickCoinDeployParams,
  authToken: string,
): Promise<DickCoinDeployResult> {
  const result = await apiPost<DickCoinDeployResult>('/api/v1/dickcoins/launch', {
    ...params,
    circleJerkConfig: params.circleJerkConfig ?? DEFAULT_CONFIG,
  }, authToken);
  return result ?? { contractAddress: '', poolAddress: '', txHash: '', error: 'API unavailable' };
}

// ── Queries ────────────────────────────────────────────────────────

export async function getDickCoinsByUser(userId: string): Promise<DickCoin[]> {
  return (await apiFetch<DickCoin[]>(`/api/v1/dickcoins/user/${userId}`)) ?? [];
}

export async function getDickCoinInfo(contractAddress: string): Promise<DickCoin | null> {
  return apiFetch<DickCoin>(`/api/v1/dickcoins/${contractAddress}`);
}

export async function getDickCoinHolders(contractAddress: string): Promise<DickCoinHolder[]> {
  return (await apiFetch<DickCoinHolder[]>(`/api/v1/dickcoins/${contractAddress}/holders`)) ?? [];
}

export async function getMyCircleJerks(token?: string): Promise<DickCoin[]> {
  return (await apiFetch<DickCoin[]>('/api/v1/dickcoins/my-circle-jerks', token)) ?? [];
}

export async function getTrendingDickCoins(): Promise<DickCoin[]> {
  return (await apiFetch<DickCoin[]>('/api/v1/dickcoins/trending')) ?? [];
}

// ── Circle Jerk Config Management ──────────────────────────────────

export async function updateCircleJerkConfig(
  contractAddress: string,
  config: CircleJerkConfig,
): Promise<{ error: string | null }> {
  const result = await apiPost<{ error: string | null }>(
    `/api/v1/dickcoins/${contractAddress}/config`,
    { circleJerkConfig: config },
  );
  return result ?? { error: 'API unavailable' };
}

// ── Tier resolution (uses the coin's custom config) ────────────────

export function resolveHolderTier(
  balance: string,
  config: CircleJerkConfig,
  isCreator: boolean,
): { tier: number; name: string; color: string; canWriteGeneral: boolean; canWriteBukake: boolean } {
  const roles = [...config.roles].sort((a, b) => b.tier - a.tier); // highest first
  const bal = BigInt(balance || '0');

  // Creator is always highest tier
  if (isCreator && roles.length > 0) {
    const top = roles[0];
    return { tier: top.tier, name: top.name, color: top.color, canWriteGeneral: true, canWriteBukake: true };
  }

  for (const role of roles) {
    if (bal >= BigInt(role.minTokens)) {
      return { tier: role.tier, name: role.name, color: role.color, canWriteGeneral: role.canWriteGeneral, canWriteBukake: role.canWriteBukake };
    }
  }

  return { tier: 0, name: 'None', color: '#666', canWriteGeneral: false, canWriteBukake: false };
}

// Legacy compat
export const CJ_TIERS = DEFAULT_ROLES.map(r => ({ number: r.tier, name: r.name, color: r.color }));
export function getTierInfo(tier: string) {
  return CJ_TIERS.find(t => t.name === tier) ?? { number: 0, name: 'None', color: '#666' };
}
export function canWriteGeneral(tier: string): boolean {
  const r = DEFAULT_ROLES.find(r => r.name === tier);
  return r?.canWriteGeneral ?? false;
}
export function canWriteBukake(tier: string): boolean {
  const r = DEFAULT_ROLES.find(r => r.name === tier);
  return r?.canWriteBukake ?? false;
}
