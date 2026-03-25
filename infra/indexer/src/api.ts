import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import {
  getPosition,
  getEventsByWallet,
  getActivityScore,
  getPositionCount,
  getTierCounts,
  getAllPositions,
} from "./db";
import { TIER_NAMES } from "./types";

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

const walletLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req) => req.params.walletAddress?.toLowerCase() ?? req.ip ?? "unknown",
  message: { error: "Too many requests for this wallet" },
});

app.use("/api/v1", generalLimiter);

// ── Health ─────────────────────────────────────────────────────────

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Staking position ───────────────────────────────────────────────

app.get("/api/v1/staking/:walletAddress", walletLimiter, async (req, res) => {
  try {
    const wallet = req.params.walletAddress.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/i.test(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const position = await getPosition(wallet);
    const activity = await getActivityScore(wallet);

    if (!position || position.staked_amount === "0") {
      return res.json({
        stakedAmount: "0",
        tier: 0,
        tierName: "None",
        boost: 0,
        pendingRewards: "0",
        activityMultiplier: activity?.activity_multiplier ?? 1.0,
        effectiveAPY: 0,
        estimatedDailyReward: "0",
      });
    }

    const tierAPYs = [0, 8, 18, 40, 80];
    const baseAPY = tierAPYs[position.tier] ?? 0;
    const activityMul = activity?.activity_multiplier ?? 1.0;
    const effectiveAPY = Math.round(baseAPY * activityMul * 100) / 100;

    // Rough daily estimate: (staked * APY) / 365
    const stakedNum = Number(BigInt(position.staked_amount)) / 1e18;
    const dailyReward = Math.round((stakedNum * effectiveAPY) / 36500);

    res.json({
      stakedAmount: position.staked_amount,
      tier: position.tier,
      tierName: TIER_NAMES[position.tier] ?? "None",
      boost: [0, 1, 2, 5, 12][position.tier] ?? 0,
      pendingRewards: position.pending_rewards,
      activityMultiplier: activityMul,
      effectiveAPY,
      estimatedDailyReward: dailyReward.toString(),
    });
  } catch (err: any) {
    console.error("[api] Error fetching position:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── Staking history ────────────────────────────────────────────────

app.get("/api/v1/staking/:walletAddress/history", walletLimiter, async (req, res) => {
  try {
    const wallet = req.params.walletAddress.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/i.test(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const events = await getEventsByWallet(wallet, 50);
    res.json({
      events: events.map((e) => ({
        type: e.event_type,
        amount: e.amount,
        timestamp: e.timestamp,
        txHash: e.tx_hash,
        tier: e.tier_at_time,
      })),
    });
  } catch (err: any) {
    console.error("[api] Error fetching history:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── Activity score ─────────────────────────────────────────────────

app.get("/api/v1/staking/:walletAddress/activity", walletLimiter, async (req, res) => {
  try {
    const wallet = req.params.walletAddress.toLowerCase();
    const score = await getActivityScore(wallet);

    if (!score) {
      return res.json({
        loginStreak: 0,
        postsThisWeek: 0,
        isVerified: false,
        referralCount: 0,
        activityMultiplier: 1.0,
      });
    }

    res.json({
      loginStreak: score.login_streak,
      postsThisWeek: score.posts_this_week,
      isVerified: score.is_verified,
      referralCount: score.referral_count,
      activityMultiplier: score.activity_multiplier,
    });
  } catch (err: any) {
    console.error("[api] Error fetching activity:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── Global stats ───────────────────────────────────────────────────

app.get("/api/v1/staking/stats", async (_req, res) => {
  try {
    const positions = await getAllPositions();
    const tierCounts = await getTierCounts();
    const totalStakers = positions.filter((p) => p.staked_amount !== "0").length;
    const totalStaked = positions.reduce(
      (sum, p) => sum + BigInt(p.staked_amount || "0"),
      0n
    );

    res.json({
      totalStaked: totalStaked.toString(),
      totalStakers,
      tiers: tierCounts,
    });
  } catch (err: any) {
    console.error("[api] Error fetching stats:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default app;
