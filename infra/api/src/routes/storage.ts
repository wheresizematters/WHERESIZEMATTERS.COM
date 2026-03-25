import { Router, Request, Response } from "express";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth } from "../middleware/auth";

const r = Router();

const REGION = process.env.AWS_REGION ?? "us-east-1";
const BUCKET = process.env.S3_MEDIA_BUCKET ?? "";

const ALLOWED_BUCKETS = new Set([
  "avatars",
  "verifications",
  "media",
  "message-media",
  "dickcoin-images",
]);

const s3 = new S3Client({ region: REGION });

// ── POST /upload-url ────────────────────────────────────────────────
r.post("/upload-url", requireAuth, async (req: Request, res: Response) => {
  try {
    const { bucket, path: objectPath, contentType } = req.body;

    if (!bucket || !objectPath || !contentType) {
      res.status(400).json({ error: "bucket, path, and contentType are required" });
      return;
    }

    if (!ALLOWED_BUCKETS.has(bucket)) {
      res.status(400).json({ error: `Invalid bucket. Allowed: ${[...ALLOWED_BUCKETS].join(", ")}` });
      return;
    }

    if (!BUCKET) {
      res.status(500).json({ error: "S3_MEDIA_BUCKET not configured" });
      return;
    }

    // Key is prefixed with the logical bucket name
    const key = `${bucket}/${objectPath}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 }); // 10 min
    const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    res.json({ uploadUrl, publicUrl, key });
  } catch (err: any) {
    console.error("Upload URL error:", err);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// ── GET /signed-url ─────────────────────────────────────────────────
r.get("/signed-url", requireAuth, async (req: Request, res: Response) => {
  try {
    const { bucket, path: objectPath } = req.query as { bucket?: string; path?: string };

    if (!bucket || !objectPath) {
      res.status(400).json({ error: "bucket and path query params are required" });
      return;
    }

    if (!ALLOWED_BUCKETS.has(bucket)) {
      res.status(400).json({ error: `Invalid bucket. Allowed: ${[...ALLOWED_BUCKETS].join(", ")}` });
      return;
    }

    if (!BUCKET) {
      res.status(500).json({ error: "S3_MEDIA_BUCKET not configured" });
      return;
    }

    const key = `${bucket}/${objectPath}`;

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min

    res.json({ signedUrl, key });
  } catch (err: any) {
    console.error("Signed URL error:", err);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
});

export default r;
