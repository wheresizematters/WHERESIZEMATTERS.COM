/**
 * SIZE. Rewards Distribution Engine
 *
 * ALL rewards are deterministic based on trading volume.
 * No fixed pools — everything flows from real fees.
 *
 * ═══════════════════════════════════════════════════════════════
 *  FLOW:
 *
 *  1. Trading happens on Uniswap (via Clanker)
 *  2. Fee collector bot claims ETH fees daily
 *  3. DickCoinFactory splits: 90% creator / 9.9% protocol / 0.1% gas
 *  4. Protocol's 8% split further:
 *     └─ 75% → SizeStaking (deposited as $SIZE, distributed to stakers)
 *     └─ 25% → SizeRewards (epoch-based, distributed to top 10 + active users)
 *
 *  5. SizeRewards epoch distribution:
 *     └─ 75% of epoch pool → TOP 10 on leaderboard (by rank weight)
 *     └─ 25% of epoch pool → ALL active users (by activity score)
 *
 * ═══════════════════════════════════════════════════════════════
 *
 *  Top 10 rank weights:
 *    #1: 200 | #2: 150 | #3: 120 | #4: 100 | #5: 80
 *    #6: 60  | #7: 50  | #8: 40  | #9: 35  | #10: 30
 *
 *  Activity scoring (per day):
 *    Verified: 10pts | Post: 3pts (max 5) | Upvote received: 5pts (max 20)
 *    Referral: 8pts | Message: 1pt (max 10) | Daily login: 1pt
 *
 *  All config adjustable without redeploying contracts.
 * ═══════════════════════════════════════════════════════════════
 */

import { scanAll, putItem, T } from "../db";
import { getLeaderboard } from "./profiles";
import { getTodayReferralCount } from "./referrals";
import { v4 as uuid } from "uuid";

// ── Configuration ────────────────────────────────────────────────

export const REWARDS_CONFIG = {
  // Protocol fee split (of the 9.9% protocol receives from DickCoin trades)
  stakingSharePct: 70,      // 70% of $SIZE fees → stakers
  epochSharePct: 30,        // 30% of $SIZE fees → leaderboard + active users

  // Epoch distribution split (of the 30%)
  dickCoinLeaderboardPct: 20,     // 20% → top DickCoins by market cap
  cloutLeaderboardPct: 3,         // 3% → top X Clout by followers
  netWorthLeaderboardPct: 3,      // 3% → top Net Worth
  sizeLeaderboardPct: 3,          // 3% → top Dick Size
  activitySharePct: 1,            // 1% → daily active user rewards

  // Rank weights for top 10 (index 0 = #1)
  rankWeights: [200, 150, 120, 100, 80, 60, 50, 40, 35, 30],

  // Activity scoring
  activityScoring: {
    verified: 10,
    post: 3,
    upvoteReceived: 5,
    referral: 8,
    message: 1,
    dailyLogin: 1,
  },

  maxPostsPerDay: 5,
  maxUpvotesPerDay: 20,
  maxMessagesPerDay: 10,
};

// ── Types ────────────────────────────────────────────────────────

export interface UserWeight {
  userId: string;
  username: string;
  weight: number;
  source: 'top10' | 'activity' | 'both';
  breakdown: {
    rankWeight?: number;
    activityScore?: number;
    rank?: number;
  };
}

export interface DailyFeeSnapshot {
  id: string;
  date: string;
  totalFeesEth: number;           // total ETH fees collected today
  protocolFeesEth: number;        // 9.9% protocol share
  stakingPoolEth: number;         // 75% of protocol → stakers
  epochPoolEth: number;           // 25% of protocol → epoch rewards
  epochPoolSizeTokens: number;    // converted to $SIZE at market price
  ethPriceUsd: number;
  sizePriceUsd: number;
  distributed: boolean;
  distributedAt: string | null;
}

export interface EpochDistribution {
  timestamp: string;
  totalPool: number;
  topTenPool: number;
  activityPool: number;
  topTenUsers: UserWeight[];
  activityUsers: UserWeight[];
  allWeights: { userId: string; weight: number }[];
  totalWeight: number;
  feeSnapshot: DailyFeeSnapshot | null;
}

// ── Fee tracking ─────────────────────────────────────────────────

export async function recordDailyFees(
  totalFeesEth: number,
  ethPriceUsd: number,
  sizePriceUsd: number,
): Promise<DailyFeeSnapshot> {
  const today = new Date().toISOString().split("T")[0];

  // Protocol gets 8% of total trading fees
  const protocolFeesEth = totalFeesEth * 0.099;

  // Split protocol fees
  const stakingPoolEth = protocolFeesEth * (REWARDS_CONFIG.stakingSharePct / 100);
  const epochPoolEth = protocolFeesEth * (REWARDS_CONFIG.epochSharePct / 100);

  // Convert epoch pool to $SIZE tokens at market rate
  const epochPoolUsd = epochPoolEth * ethPriceUsd;
  const epochPoolSizeTokens = sizePriceUsd > 0 ? epochPoolUsd / sizePriceUsd : 0;

  const snapshot: DailyFeeSnapshot = {
    id: `fees-${today}`,
    date: today,
    totalFeesEth,
    protocolFeesEth,
    stakingPoolEth,
    epochPoolEth,
    epochPoolSizeTokens: Math.round(epochPoolSizeTokens),
    ethPriceUsd,
    sizePriceUsd,
    distributed: false,
    distributedAt: null,
  };

  await putItem(T.analytics, snapshot);
  return snapshot;
}

// ── Core distribution calculation ────────────────────────────────

export async function calculateEpochDistribution(
  dailyPoolSize: number,
  feeSnapshot?: DailyFeeSnapshot | null,
): Promise<EpochDistribution> {
  const { dickCoinLeaderboardPct, cloutLeaderboardPct, netWorthLeaderboardPct, sizeLeaderboardPct, activitySharePct, rankWeights } = REWARDS_CONFIG;

  // 4 leaderboard pools + 1 activity pool (totals 30%)
  const dickCoinPool = (dailyPoolSize * dickCoinLeaderboardPct) / 30;
  const cloutPool = (dailyPoolSize * cloutLeaderboardPct) / 30;
  const netWorthPool = (dailyPoolSize * netWorthLeaderboardPct) / 30;
  const sizePool = (dailyPoolSize * sizeLeaderboardPct) / 30;
  const activityPool = (dailyPoolSize * activitySharePct) / 30;

  // Get top 10 for SIZE leaderboard (verified users by size)
  const sizeLeaderboard = await getLeaderboard({ verifiedOnly: true });
  const sizeTop10 = sizeLeaderboard.slice(0, 10);

  // Distribute each pool to its top 10 using rank weights
  const totalRankWeight = rankWeights.slice(0, 10).reduce((a, b) => a + b, 0);
  const weightMap: Record<string, number> = {};

  function distributePool(entries: { id: string; username: string }[], pool: number) {
    const top = entries.slice(0, 10);
    const tw = rankWeights.slice(0, top.length).reduce((a, b) => a + b, 0);
    for (let i = 0; i < top.length; i++) {
      const share = tw > 0 ? (rankWeights[i] / tw) * pool : 0;
      weightMap[top[i].id] = (weightMap[top[i].id] ?? 0) + share;
    }
  }

  // Size leaderboard (3%)
  distributePool(sizeTop10, sizePool);

  // DickCoin leaderboard (20%) — top coins by volume, reward creators
  // For now use the same leaderboard entries; in production query DickCoin creators
  distributePool(sizeTop10, dickCoinPool);

  // Clout leaderboard (3%) — top X followers
  // For now use size leaderboard; in production query followers leaderboard
  distributePool(sizeTop10, cloutPool);

  // Net Worth leaderboard (3%)
  distributePool(sizeTop10, netWorthPool);

  const topTenUsers: UserWeight[] = sizeTop10.map((entry, i) => ({
    userId: entry.id,
    username: entry.username,
    weight: rankWeights[i] ?? 0,
    source: 'top10' as const,
    breakdown: { rankWeight: rankWeights[i], rank: i + 1 },
  }));

  // Activity scoring (1%)
  const activityUsers = await calculateActivityScores();
  const totalActivityScore = activityUsers.reduce((sum, u) => sum + u.weight, 0);
  for (const u of activityUsers) {
    const share = totalActivityScore > 0 ? (u.weight / totalActivityScore) * activityPool : 0;
    weightMap[u.userId] = (weightMap[u.userId] ?? 0) + share;
  }

  const allWeights = Object.entries(weightMap)
    .filter(([, w]) => w > 0)
    .map(([userId, weight]) => ({ userId, weight: Math.round(weight * 1e18) }));

  const totalWeight = allWeights.reduce((sum, w) => sum + w.weight, 0);

  return {
    timestamp: new Date().toISOString(),
    totalPool: dailyPoolSize,
    topTenPool,
    activityPool,
    topTenUsers,
    activityUsers,
    allWeights,
    totalWeight,
    feeSnapshot: feeSnapshot ?? null,
  };
}

// ── Activity scoring ─────────────────────────────────────────────

async function calculateActivityScores(): Promise<UserWeight[]> {
  const { activityScoring, maxPostsPerDay, maxUpvotesPerDay, maxMessagesPerDay } = REWARDS_CONFIG;
  const today = new Date().toISOString().split("T")[0];

  const profiles = await scanAll<any>(T.profiles);
  const allPosts = await scanAll<any>(T.posts);
  const todayPosts = allPosts.filter((p: any) => p.created_at?.startsWith(today));
  const allVotes = await scanAll<any>(T.post_votes);
  const todayUpvotes = allVotes.filter((v: any) => v.created_at?.startsWith(today) && v.vote === 1);
  const allMessages = await scanAll<any>(T.messages);
  const todayMessages = allMessages.filter((m: any) => m.created_at?.startsWith(today));

  const scores: UserWeight[] = [];

  for (const profile of profiles) {
    let score = 0;
    const userId = profile.id;

    score += activityScoring.dailyLogin;
    if (profile.is_verified) score += activityScoring.verified;

    const userPosts = todayPosts.filter((p: any) => p.user_id === userId);
    score += Math.min(userPosts.length, maxPostsPerDay) * activityScoring.post;

    const userPostIds = new Set(allPosts.filter((p: any) => p.user_id === userId).map((p: any) => p.id));
    const upvotesReceived = todayUpvotes.filter((v: any) => userPostIds.has(v.post_id));
    score += Math.min(upvotesReceived.length, maxUpvotesPerDay) * activityScoring.upvoteReceived;

    const userMessages = todayMessages.filter((m: any) => m.sender_id === userId);
    score += Math.min(userMessages.length, maxMessagesPerDay) * activityScoring.message;

    // Referral scoring
    const referralCount = await getTodayReferralCount(userId);
    score += referralCount * activityScoring.referral;

    if (score > 0) {
      scores.push({
        userId,
        username: profile.username,
        weight: score,
        source: 'activity',
        breakdown: { activityScore: score },
      });
    }
  }

  return scores;
}

// ── Preview distribution ─────────────────────────────────────────

export async function previewDistribution(dailyPoolSize: number) {
  const dist = await calculateEpochDistribution(dailyPoolSize);

  const topTenSummary = dist.topTenUsers.map(u => {
    const userWeight = dist.allWeights.find(w => w.userId === u.userId)?.weight ?? 0;
    const estimatedReward = dist.totalWeight > 0 ? (userWeight / dist.totalWeight) * dailyPoolSize : 0;
    return {
      rank: u.breakdown.rank,
      username: u.username,
      rankWeight: u.breakdown.rankWeight,
      estimatedReward: Math.round(estimatedReward * 100) / 100,
    };
  });

  const topActivityUsers = dist.activityUsers
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20)
    .map(u => {
      const userWeight = dist.allWeights.find(w => w.userId === u.userId)?.weight ?? 0;
      const estimatedReward = dist.totalWeight > 0 ? (userWeight / dist.totalWeight) * dailyPoolSize : 0;
      return {
        username: u.username,
        activityScore: u.weight,
        estimatedReward: Math.round(estimatedReward * 100) / 100,
      };
    });

  return {
    config: REWARDS_CONFIG,
    pool: {
      total: dailyPoolSize,
      topTen: dist.topTenPool,
      activity: dist.activityPool,
    },
    topTen: topTenSummary,
    topActivity: topActivityUsers,
    totalRecipients: dist.allWeights.length,
    totalWeight: dist.totalWeight,
    note: "Pool size is deterministic — derived from actual trading volume fees.",
    formula: {
      step1: "Total trading fees (ETH) collected from all DickCoin trades",
      step2: "DickCoinFactory splits: 90% creator / 9.9% protocol / 0.1% gas",
      step3: `Protocol's 9.9% split: ${REWARDS_CONFIG.stakingSharePct}% → stakers, ${REWARDS_CONFIG.epochSharePct}% → epoch rewards`,
      step4: `Epoch pool split: ${REWARDS_CONFIG.topTenSharePct}% → top 10 by rank, ${REWARDS_CONFIG.activitySharePct}% → active users`,
      step5: "Rank weights: #1=200, #2=150, #3=120 ... #10=30",
      step6: "Activity: verified=10, post=3, upvote=5, referral=8, msg=1, login=1",
    },
  };
}

// ── Simulate: show what rewards would be for a given volume ──────

export async function simulateFromVolume(dailyVolumeEth: number, ethPrice: number, sizePrice: number) {
  // Total fees = volume × fee rate (typically 1% on our swap)
  const totalFeesEth = dailyVolumeEth * 0.01;

  // Protocol gets 8%
  const protocolFeesEth = totalFeesEth * 0.099;

  // Staking pool = 75% of protocol fees
  const stakingPoolEth = protocolFeesEth * (REWARDS_CONFIG.stakingSharePct / 100);
  const stakingPoolUsd = stakingPoolEth * ethPrice;
  const stakingPoolSize = sizePrice > 0 ? stakingPoolUsd / sizePrice : 0;

  // Epoch rewards pool = 25% of protocol fees
  const epochPoolEth = protocolFeesEth * (REWARDS_CONFIG.epochSharePct / 100);
  const epochPoolUsd = epochPoolEth * ethPrice;
  const epochPoolSize = sizePrice > 0 ? epochPoolUsd / sizePrice : 0;

  // Get distribution preview
  const distribution = await previewDistribution(Math.round(epochPoolSize));

  return {
    input: {
      dailyVolumeEth,
      ethPriceUsd: ethPrice,
      sizePriceUsd: sizePrice,
    },
    fees: {
      totalFeesEth: Math.round(totalFeesEth * 10000) / 10000,
      totalFeesUsd: Math.round(totalFeesEth * ethPrice * 100) / 100,
      protocolFeesEth: Math.round(protocolFeesEth * 10000) / 10000,
      protocolFeesUsd: Math.round(protocolFeesEth * ethPrice * 100) / 100,
    },
    stakingRewards: {
      ethAmount: Math.round(stakingPoolEth * 10000) / 10000,
      usdAmount: Math.round(stakingPoolUsd * 100) / 100,
      sizeTokens: Math.round(stakingPoolSize),
      note: `${REWARDS_CONFIG.stakingSharePct}% of protocol fees → deposited to SizeStaking contract`,
    },
    epochRewards: {
      ethAmount: Math.round(epochPoolEth * 10000) / 10000,
      usdAmount: Math.round(epochPoolUsd * 100) / 100,
      sizeTokens: Math.round(epochPoolSize),
      note: `${REWARDS_CONFIG.epochSharePct}% of protocol fees → distributed via SizeRewards epochs`,
    },
    distribution,
  };
}
