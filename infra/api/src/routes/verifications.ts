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

    // In production, this would:
    // 1. Fetch $SIZE token price from Uniswap V4 pool via Chainstack RPC
    // 2. Calculate how many $SIZE tokens = $10 USD
    // 3. Check user's on-chain $SIZE balance >= required amount
    // 4. Execute ERC-20 transfer from user to protocol wallet
    //    (user signs the tx on frontend, backend verifies the tx hash)
    // 5. Mark as verified after tx confirmation

    // For now: check $SIZE coin balance (off-chain) as proxy
    const VERIFICATION_COST_COINS = 10000; // placeholder until on-chain pricing
    if ((profile.size_coins ?? 0) < VERIFICATION_COST_COINS) {
      return res.status(400).json({
        error: `Insufficient $SIZE. Need ${VERIFICATION_COST_COINS.toLocaleString()} coins (~$10 worth). You have ${(profile.size_coins ?? 0).toLocaleString()}.`,
      });
    }

    // Deduct coins and verify
    await updateProfile(req.userId!, {
      size_coins: (profile.size_coins ?? 0) - VERIFICATION_COST_COINS,
      is_verified: true,
    } as any);

    res.json({ status: "verified", message: "Verified! $SIZE burned and sent to protocol." });
  } catch (err: any) {
    console.error("Token verify error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default r;
