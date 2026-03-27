/**
 * SIZE. Rewards Distribution Engine
 *
 * Revenue flow:
 *   Trading fees (ETH) → SizeStaking contract
 *     └─ 75% distributed to stakers proportionally (weighted by tier boost)
 *     └─ 25% to protocol treasury
 *
 *   Daily $SIZE rewards → SizeRewards contract (epoch-based)
 *     └─ 75% to TOP 10 on leaderboard (by rank weight — #1 gets most)
 *     └─ 25% to ACTIVE USERS (by activity score)
 *
 * Activity scoring (per day):
 *   - Verified account:     10 points (one-time per day)
 *   - Posted content:        3 points per post (max 5)
 *   - Got upvoted:           5 points per upvote received (max 20)
 *   - Referred a user:       8 points per referral
 *   - Sent a message:        1 point per message (max 10)
 *   - Daily login:           1 point
 *
 * Top 10 rank weights (higher rank = bigger share of the 75%):
 *   #1: 200 pts | #2: 150 pts | #3: 120 pts | #4: 100 pts | #5: 80 pts
 *   #6: 60 pts  | #7: 50 pts  | #8: 40 pts  | #9: 35 pts  | #10: 30 pts
 *   Total: 865 pts (each user's share = their pts / 865 × 75% of pool)
 *
 * Config is adjustable below without redeploying contracts.
 */

import { scanAll, T } from "../db";
import { getLeaderboard, getProfile } from "./profiles";

// ── Configuration ────────────────────────────────────────────────

export const REWARDS_CONFIG = {
  // Share of daily reward pool going to top 10 vs active users
  topTenSharePct: 75,       // 75% of pool to top 10
  activitySharePct: 25,     // 25% of pool to active users

  // Rank weights for top 10 (index 0 = #1)
  rankWeights: [200, 150, 120, 100, 80, 60, 50, 40, 35, 30],

  // Activity scoring
  activityScoring: {
    verified: 10,           // per day
    post: 3,                // per post, max 5 posts/day = 15 pts
    upvoteReceived: 5,      // per upvote, max 20/day = 100 pts
    referral: 8,            // per referral
    message: 1,             // per message, max 10/day = 10 pts
    dailyLogin: 1,          // just for showing up
  },

  // Daily caps
  maxPostsPerDay: 5,
  maxUpvotesPerDay: 20,
  maxMessagesPerDay: 10,
};

// ── Types ────────────────────────────────────────────────────────

export interface UserWeight {
  userId: string;
  username: string;
  weight: number;       // raw weight points
  source: 'top10' | 'activity' | 'both';
  breakdown: {
    rankWeight?: number;
    activityScore?: number;
    rank?: number;
  };
}

export interface EpochDistribution {
  epoch: number;
  timestamp: string;
  totalPool: number;          // total $SIZE to distribute
  topTenPool: number;         // 75% portion
  activityPool: number;       // 25% portion
  topTenUsers: UserWeight[];
  activityUsers: UserWeight[];
  allWeights: { userId: string; weight: number }[];
  totalWeight: number;
}

// ── Core: Calculate distribution for an epoch ────────────────────

export async function calculateEpochDistribution(
  dailyPoolSize: number,
): Promise<EpochDistribution> {
  const { topTenSharePct, activitySharePct, rankWeights, activityScoring } = REWARDS_CONFIG;

  // Split the pool
  const topTenPool = (dailyPoolSize * topTenSharePct) / 100;
  const activityPool = (dailyPoolSize * activitySharePct) / 100;

  // Get top 10 from leaderboard (verified users by size)
  const leaderboard = await getLeaderboard({ verifiedOnly: true });
  const top10 = leaderboard.slice(0, 10);

  // Calculate top 10 weights
  const totalRankWeight = rankWeights.slice(0, top10.length).reduce((a, b) => a + b, 0);
  const topTenUsers: UserWeight[] = top10.map((entry, i) => ({
    userId: entry.id,
    username: entry.username,
    weight: rankWeights[i] ?? 0,
    source: 'top10' as const,
    breakdown: {
      rankWeight: rankWeights[i],
      rank: i + 1,
    },
  }));

  // Calculate activity scores for ALL users
  const activityUsers = await calculateActivityScores();

  // Combine weights:
  // Top 10 users: their rank weight is scaled to the 75% pool
  // Activity users: their activity weight is scaled to the 25% pool
  // If a top-10 user also has activity, they get both portions

  const weightMap: Record<string, number> = {};

  // Top 10 get their rank-based share of the 75% pool
  for (const u of topTenUsers) {
    const share = totalRankWeight > 0 ? (u.weight / totalRankWeight) * topTenPool : 0;
    weightMap[u.userId] = (weightMap[u.userId] ?? 0) + share;
  }

  // Activity users get their share of the 25% pool
  const totalActivityScore = activityUsers.reduce((sum, u) => sum + u.weight, 0);
  for (const u of activityUsers) {
    const share = totalActivityScore > 0 ? (u.weight / totalActivityScore) * activityPool : 0;
    weightMap[u.userId] = (weightMap[u.userId] ?? 0) + share;
  }

  // Convert to weight array (normalize so total = dailyPoolSize for clean division)
  const allWeights = Object.entries(weightMap)
    .filter(([, w]) => w > 0)
    .map(([userId, weight]) => ({ userId, weight: Math.round(weight * 1e18) }));

  const totalWeight = allWeights.reduce((sum, w) => sum + w.weight, 0);

  return {
    epoch: 0, // Set by caller
    timestamp: new Date().toISOString(),
    totalPool: dailyPoolSize,
    topTenPool,
    activityPool,
    topTenUsers,
    activityUsers,
    allWeights,
    totalWeight,
  };
}

// ── Activity scoring ─────────────────────────────────────────────

async function calculateActivityScores(): Promise<UserWeight[]> {
  const { activityScoring, maxPostsPerDay, maxUpvotesPerDay, maxMessagesPerDay } = REWARDS_CONFIG;
  const today = new Date().toISOString().split("T")[0];

  // Get all profiles
  const profiles = await scanAll<any>(T.profiles);

  // Get today's posts
  const allPosts = await scanAll<any>(T.posts);
  const todayPosts = allPosts.filter((p: any) => p.created_at?.startsWith(today));

  // Get today's post votes (upvotes)
  const allVotes = await scanAll<any>(T.post_votes);
  const todayUpvotes = allVotes.filter((v: any) => v.created_at?.startsWith(today) && v.vote === 1);

  // Get today's messages
  const allMessages = await scanAll<any>(T.messages);
  const todayMessages = allMessages.filter((m: any) => m.created_at?.startsWith(today));

  // Score each user
  const scores: UserWeight[] = [];

  for (const profile of profiles) {
    let score = 0;
    const userId = profile.id;

    // Daily login (if they have any activity today or logged in today)
    score += activityScoring.dailyLogin;

    // Verified bonus
    if (profile.is_verified) {
      score += activityScoring.verified;
    }

    // Posts today
    const userPosts = todayPosts.filter((p: any) => p.user_id === userId);
    score += Math.min(userPosts.length, maxPostsPerDay) * activityScoring.post;

    // Upvotes received today
    const userPostIds = new Set(allPosts.filter((p: any) => p.user_id === userId).map((p: any) => p.id));
    const upvotesReceived = todayUpvotes.filter((v: any) => userPostIds.has(v.post_id));
    score += Math.min(upvotesReceived.length, maxUpvotesPerDay) * activityScoring.upvoteReceived;

    // Messages sent today
    const userMessages = todayMessages.filter((m: any) => m.sender_id === userId);
    score += Math.min(userMessages.length, maxMessagesPerDay) * activityScoring.message;

    if (score > 0) {
      scores.push({
        userId,
        username: profile.username,
        weight: score,
        source: 'activity',
        breakdown: {
          activityScore: score,
        },
      });
    }
  }

  return scores;
}

// ── Preview: show what the distribution would look like ──────────

export async function previewDistribution(dailyPoolSize: number) {
  const dist = await calculateEpochDistribution(dailyPoolSize);

  // Format for display
  const topTenSummary = dist.topTenUsers.map(u => ({
    rank: u.breakdown.rank,
    username: u.username,
    rankWeight: u.breakdown.rankWeight,
    estimatedReward: dist.totalWeight > 0
      ? (dist.allWeights.find(w => w.userId === u.userId)?.weight ?? 0) / dist.totalWeight * dailyPoolSize
      : 0,
  }));

  const topActivityUsers = dist.activityUsers
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20)
    .map(u => ({
      username: u.username,
      activityScore: u.weight,
      estimatedReward: dist.totalWeight > 0
        ? (dist.allWeights.find(w => w.userId === u.userId)?.weight ?? 0) / dist.totalWeight * dailyPoolSize
        : 0,
    }));

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
  };
}
