import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import * as svc from "../services/verification";
import { updateProfile } from "../services/profiles";

const r = Router();

r.get("/me", requireAuth, async (req, res) => {
  const data = await svc.getVerificationRequest(req.userId!);
  res.json(data);
});

r.post("/verify", requireAuth, async (req, res) => {
  const { imagePath, reportedSize, reportedGirth } = req.body;
  // For now, queue for review (Claude AI verification would go here)
  await svc.upsertVerificationRequest({
    user_id: req.userId!,
    image_path: imagePath,
    reported_size: reportedSize,
    status: "pending",
  });
  res.json({ status: "pending", reason: "queued_for_review" });
});

r.get("/pending", requireAuth, async (req, res) => {
  const data = await svc.getPendingVerifications();
  res.json(data);
});

r.post("/review", requireAuth, async (req, res) => {
  const { requestId, action } = req.body;
  const result = await svc.reviewVerification(requestId, req.userId!, action);
  res.json(result);
});

// ── Token-based verification ───────────────────────────────────────
// User burns $10 worth of $SIZE to get verified instantly.
// In production: check on-chain $SIZE balance, calculate USD value
// via pool price, execute transfer to protocol wallet.
r.post("/token-verify", requireAuth, async (req: Request, res: Response) => {
  try {
    const { getProfile: getProf } = require("../services/profiles");
    const profile = await getProf(req.userId!);

    if (!profile) return res.status(404).json({ error: "Profile not found" });
    if (profile.is_verified) return res.json({ status: "verified", message: "Already verified" });
    if (!profile.wallet_address) return res.status(400).json({ error: "Connect your wallet first" });

    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Wallet address required" });

    // Token verification costs $20 worth of $SIZE (2x cash price)
    // 50% is burned (removed from circulation permanently)
    // 50% is sold to ETH and sent to protocol treasury
    //
    // In production:
    // 1. Fetch $SIZE/ETH price from Uniswap V4 pool
    // 2. Calculate tokens = $20 USD at current price
    // 3. User signs ERC-20 transfer on frontend
    // 4. 50% sent to burn address (0x000...dead)
    // 5. 50% sent to protocol wallet (sold for ETH via swap)
    // 6. Backend verifies tx hash, marks verified

    // Off-chain proxy: deduct coins at 2x rate
    const VERIFICATION_COST_COINS = 20000; // $20 worth (2x the $10 cash price)
    if ((profile.size_coins ?? 0) < VERIFICATION_COST_COINS) {
      return res.status(400).json({
        error: `Insufficient $SIZE. Need ${VERIFICATION_COST_COINS.toLocaleString()} coins (~$20 worth). You have ${(profile.size_coins ?? 0).toLocaleString()}. Token verification is 2x cash price — 50% burned, 50% to protocol.`,
      });
    }

    // Deduct coins: 50% burned (gone forever), 50% to protocol
    // In production the burn happens on-chain to a dead address
    await updateProfile(req.userId!, {
      size_coins: (profile.size_coins ?? 0) - VERIFICATION_COST_COINS,
      is_verified: true,
    } as any);

    res.json({ status: "verified", message: "Verified! $20 of $SIZE — 50% burned, 50% to protocol." });
  } catch (err: any) {
    console.error("Token verify error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default r;
