import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { getProfile, updateProfile } from "../services/profiles";
import { T, putItem, getItem } from "../db";

const r = Router();

const LAOZHANG_KEY = process.env.LAOZHANG_API_KEY ?? "sk-w2wfcbQLBlP4m76z0a2e9eC20e0e47Cf8d4b2d6803D36621";
const LAOZHANG_URL = "https://api.laozhang.ai/v1/images/generations";
const MAX_GENERATIONS = 4; // 1 initial + 3 regenerations
const UNVERIFIED_COST_COINS = 500; // $SIZE coins per generation for unverified

// Track generation counts per user per session
// In production this should be in DynamoDB, but for MVP use in-memory
const generationCounts: Record<string, number> = {};

r.post("/generate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { coinName, ticker, description } = req.body;
    if (!coinName || !ticker) {
      return res.status(400).json({ error: "coinName and ticker required" });
    }

    const profile = await getProfile(req.userId!);
    if (!profile) return res.status(401).json({ error: "Not authenticated" });

    // Track generations
    const countKey = `${req.userId!}:${ticker}`;
    const count = generationCounts[countKey] ?? 0;
    if (count >= MAX_GENERATIONS) {
      return res.status(429).json({
        error: `Maximum ${MAX_GENERATIONS} generations reached for this coin. Use one of your previous logos.`,
        remaining: 0,
      });
    }

    // Charge unverified users
    if (!profile.is_verified) {
      if ((profile.size_coins ?? 0) < UNVERIFIED_COST_COINS) {
        return res.status(400).json({
          error: `Logo generation costs ${UNVERIFIED_COST_COINS} $SIZE coins for unverified users. You have ${(profile.size_coins ?? 0).toLocaleString()}. Get verified for free generations.`,
        });
      }
      // Deduct coins
      await updateProfile(req.userId!, {
        size_coins: (profile.size_coins ?? 0) - UNVERIFIED_COST_COINS,
      } as any);
    }

    // Build prompt
    const prompt = `Create a clean, professional cryptocurrency token logo for a coin called "${coinName}" (ticker: $${ticker}). ${description ? `The coin is about: ${description}. ` : ""}Design a circular logo icon suitable for a crypto token. Modern, bold, minimal design. Dark background with vibrant colors. No text in the logo. Square 1:1 format.`;

    // Call DALL-E via LaoZhang proxy
    const aiRes = await fetch(LAOZHANG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LAOZHANG_KEY}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      console.error("Logo gen API error:", aiRes.status, errText);
      // Refund coins if charged
      if (!profile.is_verified) {
        await updateProfile(req.userId!, {
          size_coins: (profile.size_coins ?? 0),
        } as any);
      }
      return res.status(502).json({ error: "Logo generation failed. Try again." });
    }

    const data = await aiRes.json();
    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) {
      return res.status(502).json({ error: "No image returned. Try again." });
    }

    // Download image and upload to S3
    const imageRes = await fetch(imageUrl);
    const imageBuffer = await imageRes.arrayBuffer();

    // Upload to S3 via our storage API (internal)
    const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
    const bucket = process.env.S3_MEDIA_BUCKET ?? "size-media-845654871945";
    const key = `dickcoin-logos/${req.userId!}/${ticker}-${Date.now()}.png`;

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(imageBuffer),
      ContentType: "image/png",
    }));

    // Return proxy URL (not direct S3)
    const logoUrl = `/api/v1/storage/media/${key}`;

    // Increment count
    generationCounts[countKey] = count + 1;
    const remaining = MAX_GENERATIONS - (count + 1);

    res.json({
      logoUrl,
      remaining,
      generationNumber: count + 1,
      maxGenerations: MAX_GENERATIONS,
    });
  } catch (err: any) {
    console.error("Logo generation error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default r;
