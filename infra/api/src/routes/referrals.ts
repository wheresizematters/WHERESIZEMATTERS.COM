import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { getReferralStats, getReferrals } from "../services/referrals";

const r = Router();

// ── GET /stats — my referral stats ───────────────────────────────
r.get("/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await getReferralStats(req.userId!);
    res.json(stats);
  } catch (err: any) {
    console.error("Referral stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /list — users I've referred (hydrated with profiles) ─────
r.get("/list", requireAuth, async (req: Request, res: Response) => {
  try {
    const { getProfile } = require("../services/profiles");
    const referrals = await getReferrals(req.userId!);
    const hydrated = await Promise.all(
      referrals.map(async (ref) => {
        const profile = await getProfile(ref.referredUserId);
        return {
          userId: ref.referredUserId,
          username: profile?.username ?? "unknown",
          avatarUrl: profile?.avatar_url ?? null,
          isVerified: !!profile?.is_verified,
          joinedAt: ref.createdAt,
        };
      }),
    );
    // Sort newest first
    hydrated.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
    res.json({ referrals: hydrated });
  } catch (err: any) {
    console.error("Referral list error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default r;
