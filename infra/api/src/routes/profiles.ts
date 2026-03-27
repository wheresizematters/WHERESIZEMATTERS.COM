import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth";
import * as svc from "../services/profiles";

const r = Router();

r.get("/me", requireAuth, async (req, res) => {
  const profile = await svc.getProfile(req.userId!);
  res.json(profile);
});

r.patch("/me", requireAuth, async (req, res) => {
  const updated = await svc.updateProfile(req.userId!, req.body);
  res.json(updated);
});

r.delete("/me", requireAuth, async (req, res) => {
  try {
    const result = await svc.deleteProfile(req.userId!);
    res.json(result);
  } catch (err: any) {
    console.error("Delete profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.get("/leaderboard", async (req, res) => {
  const { country, ageRange } = req.query as any;
  const verifiedOnly = req.query.verifiedOnly !== 'false';
  const entries = await svc.getLeaderboard({ country, ageRange, verifiedOnly });
  res.json(entries);
});

r.get("/leaderboard/nearby", async (req, res) => {
  const { lat, lng, radius } = req.query as any;
  const entries = await svc.getLeaderboardNearby(
    parseFloat(lat), parseFloat(lng), parseFloat(radius ?? "25")
  );
  res.json(entries);
});

r.get("/search", async (req, res) => {
  const { q } = req.query as any;
  const results = await svc.searchUsers(q ?? "");
  res.json(results);
});

r.get("/count", async (_req, res) => {
  const count = await svc.getTotalUserCount();
  res.json({ count });
});

r.get("/percentile/:size", async (req, res) => {
  const pct = await svc.getUserPercentile(parseFloat(req.params.size));
  res.json({ percentile: pct });
});

r.get("/:userId", async (req, res) => {
  const profile = await svc.getProfile(req.params.userId);
  if (!profile) return res.status(404).json({ error: "Not found" });
  res.json(profile);
});

r.get("/:userId/rank", async (req, res) => {
  const result = await svc.getUserRank(req.params.userId);
  res.json(result);
});

r.post("/:userId/coins", requireAuth, async (req, res) => {
  try {
    // Admin check — only admins can award coins
    const caller = await svc.getProfile(req.userId!);
    if (!caller?.is_admin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const { amount } = req.body;
    await svc.awardCoins(req.params.userId, amount);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Award coins error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default r;
