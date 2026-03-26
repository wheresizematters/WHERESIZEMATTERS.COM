import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import * as svc from "../services/verification";
import { updateProfile } from "../services/profiles";

const r = Router();

r.get("/me", requireAuth, async (req, res) => {
  const data = await svc.getVerificationRequest(req.userId!);
  res.json(data);
});

r.post("/verify", requireAuth, async (req: Request, res: Response) => {
  const { imagePath, reportedSize, reportedGirth } = req.body;
  const VISION_URL = process.env.VISION_API_URL ?? "https://rqi1lteg1birca-8080.proxy.runpod.net";

  try {
    // Get a signed URL for the image
    const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
    const bucket = process.env.S3_MEDIA_BUCKET ?? "size-media-845654871945";
    const signedUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: imagePath }), { expiresIn: 300 });

    // Call the abliterated vision model on RunPod
    const prompt = `You are a measurement verification AI for a social app. Analyze this photo carefully.

The user claims their size is ${reportedSize} inches${reportedGirth ? ` with ${reportedGirth} inch girth` : ''}.

Look for a reference object (ruler, credit card, dollar bill, measuring tape) in the photo.
Estimate the actual measurement based on the reference object.

Respond in this exact JSON format:
{
  "estimated_size": <number or null if can't determine>,
  "confidence": "high" | "medium" | "low",
  "reference_object_found": true | false,
  "reference_object_type": "<what you see>",
  "matches_claim": true | false,
  "notes": "<brief explanation>"
}`;

    const visionRes = await fetch(`${VISION_URL}/v1/vision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, image_url: signedUrl }),
    });

    if (visionRes.ok) {
      const visionData = await visionRes.json();
      const response = visionData.response ?? visionData.choices?.[0]?.message?.content ?? "";

      // Try to parse the JSON response
      let analysis: any = {};
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
      } catch {}

      const confidence = analysis.confidence ?? "low";
      const matchesClaim = analysis.matches_claim ?? false;
      const estimatedSize = analysis.estimated_size ?? null;

      // Auto-verify if high confidence and matches claim (within 0.5 inch tolerance)
      const withinTolerance = estimatedSize && Math.abs(estimatedSize - reportedSize) <= 0.5;
      const autoVerify = confidence === "high" && (matchesClaim || withinTolerance);

      await svc.upsertVerificationRequest({
        user_id: req.userId!,
        image_path: imagePath,
        reported_size: reportedSize,
        ai_est_size: estimatedSize,
        ai_confidence: confidence,
        ai_notes: analysis.notes ?? response.slice(0, 200),
        status: autoVerify ? "auto_verified" : "pending",
      });

      if (autoVerify) {
        await updateProfile(req.userId!, { is_verified: true } as any);
        return res.json({ status: "auto_verified", reason: "AI verified your measurement" });
      }

      return res.json({ status: "pending", reason: `AI confidence: ${confidence}. Queued for admin review.` });
    }

    // Vision API not available — fall back to manual review
    await svc.upsertVerificationRequest({
      user_id: req.userId!,
      image_path: imagePath,
      reported_size: reportedSize,
      status: "pending",
    });
    res.json({ status: "pending", reason: "queued_for_review" });

  } catch (err: any) {
    console.error("Verification error:", err.message);
    // Fallback to manual review on any error
    await svc.upsertVerificationRequest({
      user_id: req.userId!,
      image_path: imagePath,
      reported_size: reportedSize,
      status: "pending",
    });
    res.json({ status: "pending", reason: "queued_for_review" });
  }
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

// ── Token-based premium ────────────────────────────────────────────
// Pay $10 of $SIZE for 1 month premium. 50% burned, 50% to protocol.
r.post("/token-premium", requireAuth, async (req: Request, res: Response) => {
  try {
    const { getProfile: getProf, updateProfile: updProf } = require("../services/profiles");
    const profile = await getProf(req.userId!);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    if (profile.is_premium) return res.json({ status: "active", message: "Already premium" });

    const PREMIUM_COST = 10000; // $10 worth of coins (2x = $10 not $20 for premium)
    if ((profile.size_coins ?? 0) < PREMIUM_COST) {
      return res.status(400).json({
        error: `Need ${PREMIUM_COST.toLocaleString()} coins (~$10 of $SIZE). You have ${(profile.size_coins ?? 0).toLocaleString()}.`,
      });
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await updProf(req.userId!, {
      size_coins: (profile.size_coins ?? 0) - PREMIUM_COST,
      is_premium: true,
      premium_expires_at: expiresAt,
    } as any);

    res.json({ status: "active", message: "Premium activated! 50% burned, 50% to protocol." });
  } catch (err: any) {
    console.error("Token premium error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
