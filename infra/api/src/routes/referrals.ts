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

// ── GET /list — users I've referred ──────────────────────────────
r.get("/list", requireAuth, async (req: Request, res: Response) => {
  try {
    const referrals = await getReferrals(req.userId!);
    res.json({ referrals });
  } catch (err: any) {
    console.error("Referral list error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default r;
