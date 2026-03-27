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

    // Path traversal protection
    if (objectPath.includes("..") || objectPath.startsWith("/")) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }

    if (!BUCKET) {
      res.status(500).json({ error: "S3_MEDIA_BUCKET not configured" });
      return;
    }

    // Strip bucket prefix from path if caller already included it
    const cleanPath = objectPath.startsWith(bucket + "/") ? objectPath.slice(bucket.length + 1) : objectPath;
    const key = `${bucket}/${cleanPath}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 }); // 10 min
    // Return a proxy URL through our API (S3 blocks public access)
    const publicUrl = `/api/v1/storage/media/${key}`;

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

    // Path traversal protection
    if (objectPath.includes("..") || objectPath.startsWith("/")) {
      res.status(400).json({ error: "Invalid path" });
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

// ── GET /media/* — Proxy S3 media to browser (no public access needed) ──
r.get("/media/*", async (req: Request, res: Response) => {
  try {
    const key = req.params[0];
    if (!key || key.includes("..")) {
      res.status(400).send("Invalid path");
      return;
    }

    if (!BUCKET) {
      res.status(500).send("Storage not configured");
      return;
    }

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const s3Res = await s3.send(command);

    if (!s3Res.Body) {
      res.status(404).send("Not found");
      return;
    }

    // Set proper content type and cache headers
    const contentType = s3Res.ContentType ?? "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    // Stream S3 body to response
    const chunks: Buffer[] = [];
    const stream = s3Res.Body as any;
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    res.send(Buffer.concat(chunks));
  } catch (err: any) {
    if (err.name === "NoSuchKey") {
      res.status(404).send("Not found");
    } else {
      console.error("Media proxy error:", err.name);
      res.status(500).send("Error loading media");
    }
  }
});

export default r;
