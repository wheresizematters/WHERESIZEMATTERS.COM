const STAKING_API_BASE = process.env.EXPO_PUBLIC_STAKING_API_URL ?? '';

export interface StakingPositionAPI {
  stakedAmount: string;
  tier: number;
  tierName: string;
  boost: number;
  pendingRewards: string;
  activityMultiplier: number;
  effectiveAPY: number;
  estimatedDailyReward: string;
}

export interface StakingEventAPI {
  type: 'staked' | 'unstaked' | 'claimed' | 'deposited';
  amount: string;
  timestamp: number;
  txHash: string;
  tier: number;
}

export interface StakingStatsAPI {
  totalStaked: string;
  totalStakers: number;
  tiers: {
    grower: number;
    shower: number;
    shlong: number;
    whale: number;
  };
}

export interface ActivityScoreAPI {
  loginStreak: number;
  postsThisWeek: number;
  isVerified: boolean;
  referralCount: number;
  activityMultiplier: number;
}

async function apiFetch<T>(path: string): Promise<T | null> {
  if (!STAKING_API_BASE) return null;
  try {
    const res = await fetch(`${STAKING_API_BASE}${path}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function fetchStakingPosition(walletAddress: string) {
  return apiFetch<StakingPositionAPI>(`/api/v1/staking/${walletAddress}`);
}

export function fetchStakingHistory(walletAddress: string) {
  return apiFetch<{ events: StakingEventAPI[] }>(`/api/v1/staking/${walletAddress}/history`);
}

export function fetchStakingStats() {
  return apiFetch<StakingStatsAPI>(`/api/v1/staking/stats`);
}

export function fetchActivityScore(walletAddress: string) {
  return apiFetch<ActivityScoreAPI>(`/api/v1/staking/${walletAddress}/activity`);
}
