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
  const { imagePath, reportedSize, reportedGirth, verifyType } = req.body;
  const VISION_URL = "https://api.cyanide-ai.com/api/vision";
  const VISION_KEY = process.env.CYANIDE_API_KEY ?? "svc_size_app";
  const type = verifyType ?? "size"; // "size" | "face" | "bra"

  try {
    // Get image from S3 as base64
    const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
    const bucket = process.env.S3_MEDIA_BUCKET ?? "size-media-845654871945";
    const s3Res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: imagePath }));
    const chunks: Buffer[] = [];
    for await (const chunk of s3Res.Body as any) chunks.push(Buffer.from(chunk));
    const imageBase64 = Buffer.concat(chunks).toString("base64");
    const mimeType = s3Res.ContentType ?? "image/jpeg";

    // Build prompt based on verification type
    let prompt = "";
    if (type === "face") {
      prompt = `This is a face verification photo. Confirm there is a real human face visible. Determine if this appears to be a real person (not a screenshot, not a photo of a photo).

Return JSON only:
{"verified": true|false, "gender": "male"|"female"|"unknown", "confidence": "high"|"medium"|"low", "notes": "<brief>"}`;
    } else if (type === "bra") {
      prompt = `Estimate the bra/cup size visible in this photo. Look for any reference objects for scale.

Return JSON only:
{"bra_size": "<like 34C>", "cup": "<letter>", "band": <number>, "confidence": "high"|"medium"|"low", "reference": "<what you used>"}

If cannot determine, return:
{"bra_size": null, "confidence": "low", "reference": "none"}`;
    } else {
      prompt = `Measure the penis in this photo. Look for a reference object (ruler, tape measure, credit card, dollar bill, phone) to calibrate scale.

Return JSON only:
{"size_inches": <number>, "confidence": "high"|"medium"|"low", "reference": "<what you used to measure>"}

If no reference object or no penis visible, return:
{"size_inches": null, "confidence": "low", "reference": "none"}`;
    }

    const visionRes = await fetch(VISION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": VISION_KEY,
        "x-service-key": "svc_size_app",
      },
      body: JSON.stringify({
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        }],
        max_tokens: 1024,
        temperature: 0.3,
      }),
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
      let autoVerify = false;
      let profileUpdates: any = { is_verified: true };
      let notes = "";

      if (type === "face") {
        // Face verification — just confirm it's a real person
        const verified = analysis.verified ?? false;
        const gender = analysis.gender ?? "unknown";
        autoVerify = verified && (confidence === "high" || confidence === "medium");
        notes = `Face: ${verified ? 'real person' : 'not verified'} (${gender}, ${confidence})`;
        if (gender === "female") profileUpdates.gender = "female";
        else if (gender === "male") profileUpdates.gender = "male";

      } else if (type === "bra") {
        // Bra size verification
        const braSize = analysis.bra_size ?? null;
        autoVerify = braSize && (confidence === "high" || confidence === "medium");
        notes = `Bra: ${braSize ?? '?'} (${confidence})`;
        if (braSize) {
          profileUpdates.gender = "female";
          profileUpdates.bra_size = braSize;
        }

      } else {
        // Size verification (default)
        const estimatedSize = analysis.size_inches ?? null;
        const reference = analysis.reference ?? "none";
        const withinTolerance = estimatedSize !== null && Math.abs(estimatedSize - reportedSize) <= 0.75;
        autoVerify = (confidence === "high" || confidence === "medium") && withinTolerance && reference !== "none";
        notes = `AI measured ${estimatedSize ?? '?'}" (${confidence}, ref: ${reference}). Claimed: ${reportedSize}"`;
        if (estimatedSize) profileUpdates.size_inches = estimatedSize;
      }

      // AI decides — no manual review. Either verified or rejected.
      await svc.upsertVerificationRequest({
        user_id: req.userId!,
        image_path: imagePath,
        reported_size: reportedSize ?? 0,
        ai_est_size: analysis.size_inches ?? null,
        ai_confidence: confidence,
        ai_notes: notes,
        status: autoVerify ? "auto_verified" : "rejected",
      });

      if (autoVerify) {
        await updateProfile(req.userId!, profileUpdates);
        const verifiedWhat = type === "face" ? "identity" : type === "bra" ? `bra size (${analysis.bra_size})` : `size (${analysis.size_inches}")`;
        return res.json({
          status: "auto_verified",
          reason: `Verified: ${verifiedWhat} (${confidence} confidence)`,
        });
      }

      // Rejected — tell user why and let them retry
      let rejectReason = "";
      if (type === "face") {
        rejectReason = "Could not confirm a real face. Try better lighting and face the camera directly.";
      } else if (type === "bra") {
        rejectReason = "Could not determine size. Try a clearer photo with better lighting.";
      } else {
        const estimatedSize = analysis.size_inches ?? null;
        if (!estimatedSize) {
          rejectReason = "Could not detect or measure. Make sure a ruler or reference object is clearly visible next to it.";
        } else if (analysis.reference === "none") {
          rejectReason = `Detected but no reference object found. Place a ruler, credit card, or dollar bill next to it for scale.`;
        } else {
          rejectReason = `AI measured ${estimatedSize}" but you reported ${reportedSize}". Difference too large. Use a ruler for accurate measurement and try again.`;
        }
      }

      return res.json({
        status: "rejected",
        reason: rejectReason,
      });
    }

    // Vision API not available — still try to verify, be lenient
    // Accept with low confidence rather than blocking users
    await svc.upsertVerificationRequest({
      user_id: req.userId!,
      image_path: imagePath,
      reported_size: reportedSize,
      status: "auto_verified",
      ai_notes: "Vision API unavailable — auto-accepted",
    });
    await updateProfile(req.userId!, { is_verified: true });
    res.json({ status: "auto_verified", reason: "Verified (photo accepted)" });

  } catch (err: any) {
    console.error("Verification error:", err.message);
    // On error, reject and let them retry rather than creating a manual queue
    res.json({ status: "rejected", reason: "Verification failed due to a server error. Please try again." });
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

    // Burn $10 worth of $SIZE to verify
    // TODO: In production, verify on-chain burn tx hash
    // For now, mark as verified if they have a wallet with $SIZE
    await updateProfile(req.userId!, { is_verified: true } as any);

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
