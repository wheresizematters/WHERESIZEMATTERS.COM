import { createClient } from "@supabase/supabase-js";
import { putActivityScore, getAllPositions } from "./db";
import { ActivityScore } from "./types";

/**
 * Reward engine — syncs Supabase user activity data with wallet addresses
 * and calculates activity multipliers.
 *
 * Activity multiplier (1.0x — 4.0x) applied as bonus on top of base staking yield:
 *   - Login streak: up to 1.5x (30-day streak = max)
 *   - Posts this week: up to 1.3x (7+ posts = max)
 *   - Verified: 1.2x flat bonus
 *   - Referrals: up to 1.4x (10+ referrals = max)
 *
 * Multipliers are multiplicative: 1.5 * 1.3 * 1.2 * 1.4 = 3.276x max
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function syncActivityScores(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn("[reward-engine] Missing Supabase config, skipping activity sync");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const positions = await getAllPositions();

  if (positions.length === 0) {
    console.log("[reward-engine] No staking positions to sync");
    return;
  }

  // Fetch all profiles with wallet addresses
  const wallets = positions.map((p) => p.wallet_address);
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, wallet_address, is_verified, last_daily_coin_at, last_post_coin_at")
    .in("wallet_address", wallets);

  if (error || !profiles) {
    console.error("[reward-engine] Failed to fetch profiles:", error?.message);
    return;
  }

  const now = Date.now();

  for (const profile of profiles) {
    if (!profile.wallet_address) continue;

    // Calculate login streak from last_daily_coin_at
    let loginStreak = 0;
    if (profile.last_daily_coin_at) {
      const lastLogin = new Date(profile.last_daily_coin_at).getTime();
      const daysSinceLogin = (now - lastLogin) / (1000 * 60 * 60 * 24);
      if (daysSinceLogin <= 1.5) {
        // Approximate streak — for a real implementation, track daily in a separate table
        loginStreak = 7; // default to 7 if they logged in today
      }
    }

    // Count posts this week
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: postsThisWeek } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .gte("created_at", weekAgo);

    // Count referrals (follows where this user is the following_id = people who followed them)
    const { count: referralCount } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id);

    // Calculate multiplier
    const loginMul = Math.min(1.0 + (loginStreak / 30) * 0.5, 1.5);
    const postMul = Math.min(1.0 + ((postsThisWeek ?? 0) / 7) * 0.3, 1.3);
    const verifiedMul = profile.is_verified ? 1.2 : 1.0;
    const referralMul = Math.min(1.0 + ((referralCount ?? 0) / 10) * 0.4, 1.4);
    const activityMultiplier = Math.round(loginMul * postMul * verifiedMul * referralMul * 100) / 100;

    const score: ActivityScore = {
      wallet_address: profile.wallet_address.toLowerCase(),
      supabase_user_id: profile.id,
      login_streak: loginStreak,
      posts_this_week: postsThisWeek ?? 0,
      is_verified: profile.is_verified ?? false,
      referral_count: referralCount ?? 0,
      activity_multiplier: activityMultiplier,
      last_synced_at: Math.floor(now / 1000),
    };

    await putActivityScore(score);
  }

  console.log(`[reward-engine] Synced activity scores for ${profiles.length} wallets`);
}
