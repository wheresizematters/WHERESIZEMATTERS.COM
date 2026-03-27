/**
 * Daily Rewards Distribution
 * Run via cron: 0 0 * * * cd /opt/size-app/infra/api && npx tsx scripts/daily-rewards.ts
 *
 * This script:
 * 1. Calculates today's activity scores for all users
 * 2. Gets top 10 leaderboard
 * 3. Sets user weights on SizeRewards contract
 * 4. Finalizes the epoch
 * 5. Logs results
 */
import "dotenv/config";

import { calculateEpochDistribution, REWARDS_CONFIG } from "../src/services/rewards-engine";
import { putItem, T } from "../src/db";

// ── Config ────────────────────────────────────────────────────────────

// Default daily pool size in $SIZE tokens (used on testnet or when no fee data)
const DEFAULT_POOL_SIZE = 1000;

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().split("T")[0];
  const startTime = Date.now();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  SIZE. Daily Rewards Epoch — ${today}`);
  console.log(`${"═".repeat(60)}\n`);

  // In production, this would be fetched from the fee collector / DailyFeeSnapshot
  // For testnet, use a default pool size
  const poolSize = Number(process.env.DAILY_POOL_SIZE) || DEFAULT_POOL_SIZE;

  console.log(`  Pool size: ${poolSize} $SIZE tokens`);
  console.log(`  Top 10 share: ${REWARDS_CONFIG.topTenSharePct}% (${(poolSize * REWARDS_CONFIG.topTenSharePct / 100).toFixed(0)} $SIZE)`);
  console.log(`  Activity share: ${REWARDS_CONFIG.activitySharePct}% (${(poolSize * REWARDS_CONFIG.activitySharePct / 100).toFixed(0)} $SIZE)\n`);

  // Calculate epoch distribution
  const distribution = await calculateEpochDistribution(poolSize);

  // ── Log Top 10 ────────────────────────────────────────────────────
  console.log(`  TOP 10 LEADERBOARD (${distribution.topTenUsers.length} users):`);
  console.log(`  ${"─".repeat(50)}`);

  for (const user of distribution.topTenUsers) {
    const userWeight = distribution.allWeights.find(w => w.userId === user.userId);
    const estimatedReward = userWeight && distribution.totalWeight > 0
      ? (userWeight.weight / distribution.totalWeight) * poolSize
      : 0;
    console.log(
      `  #${String(user.breakdown.rank).padStart(2)} | ${user.username.padEnd(20)} | weight: ${String(user.breakdown.rankWeight).padStart(3)} | ~${estimatedReward.toFixed(2)} $SIZE`,
    );
  }

  // ── Log Activity Users ────────────────────────────────────────────
  const sortedActivity = [...distribution.activityUsers].sort((a, b) => b.weight - a.weight);
  console.log(`\n  ACTIVE USERS (${sortedActivity.length} total):`);
  console.log(`  ${"─".repeat(50)}`);

  for (const user of sortedActivity.slice(0, 20)) {
    const userWeight = distribution.allWeights.find(w => w.userId === user.userId);
    const estimatedReward = userWeight && distribution.totalWeight > 0
      ? (userWeight.weight / distribution.totalWeight) * poolSize
      : 0;
    console.log(
      `  ${user.username.padEnd(20)} | activity: ${String(user.weight).padStart(4)} | ~${estimatedReward.toFixed(2)} $SIZE`,
    );
  }
  if (sortedActivity.length > 20) {
    console.log(`  ... and ${sortedActivity.length - 20} more`);
  }

  // ── Summary ───────────────────────────────────────────────────────
  console.log(`\n  SUMMARY:`);
  console.log(`  ${"─".repeat(50)}`);
  console.log(`  Total recipients: ${distribution.allWeights.length}`);
  console.log(`  Total weight:     ${distribution.totalWeight}`);
  console.log(`  Pool distributed: ${poolSize} $SIZE`);

  // ── Contract interaction (production only) ────────────────────────
  // TODO: In production, call SizeRewards contract:
  //   1. sizeRewards.setWeights(userAddresses[], weights[])
  //   2. sizeRewards.finalizeEpoch()
  // For now on testnet, just log the results.
  console.log(`\n  [TESTNET] Skipping on-chain distribution.`);
  console.log(`  In production, would call SizeRewards.setWeights() + finalizeEpoch()\n`);

  // ── Save to DynamoDB analytics table ──────────────────────────────
  const logEntry = {
    id: `rewards-${today}`,
    type: "daily-rewards",
    date: today,
    poolSize,
    topTenCount: distribution.topTenUsers.length,
    activityUserCount: distribution.activityUsers.length,
    totalRecipients: distribution.allWeights.length,
    totalWeight: distribution.totalWeight,
    topTenPool: distribution.topTenPool,
    activityPool: distribution.activityPool,
    topTenUsers: distribution.topTenUsers.map(u => ({
      userId: u.userId,
      username: u.username,
      rank: u.breakdown.rank,
      rankWeight: u.breakdown.rankWeight,
    })),
    topActivityUsers: sortedActivity.slice(0, 20).map(u => ({
      userId: u.userId,
      username: u.username,
      activityScore: u.weight,
    })),
    allWeights: distribution.allWeights,
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    onChain: false, // flip to true when production contract calls are enabled
  };

  await putItem(T.analytics, logEntry);
  console.log(`  Saved log entry: ${logEntry.id} to ${T.analytics}`);

  const elapsed = Date.now() - startTime;
  console.log(`  Completed in ${elapsed}ms`);
  console.log(`\n${"═".repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Daily rewards epoch FAILED:", err);
    process.exit(1);
  });
