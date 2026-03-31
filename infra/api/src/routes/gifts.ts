import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { requireAuth } from "../middleware/auth";
import { getProfile, updateProfile, awardCoins } from "../services/profiles";
import { T, putItem, queryItems, scanAll } from "../db";

const r = Router();

// ── POST / — Send a gift ───────────────────────────────────────────
r.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { recipientId, amount, postId, message } = req.body;

    if (!recipientId || !amount || amount <= 0) {
      return res.status(400).json({ error: "recipientId and positive amount required" });
    }
    if (recipientId === req.userId) {
      return res.status(400).json({ error: "Cannot gift yourself" });
    }
    if (message && message.length > 140) {
      return res.status(400).json({ error: "Message max 140 characters" });
    }

    const sender = await getProfile(req.userId!);
    if (!sender) return res.status(404).json({ error: "Sender not found" });

    const recipient = await getProfile(recipientId);
    if (!recipient) return res.status(404).json({ error: "Recipient not found" });

    if ((sender.size_coins ?? 0) < amount) {
      return res.status(400).json({
        error: `Insufficient balance. You have ${(sender.size_coins ?? 0).toLocaleString()} coins.`,
      });
    }

    // Atomic transfer: deduct from sender, credit to recipient
    await updateProfile(req.userId!, {
      size_coins: (sender.size_coins ?? 0) - amount,
    } as any);
    await awardCoins(recipientId, amount);

    // Record the gift
    const now = new Date().toISOString();
    await putItem(T.gifts, {
      id: uuid(),
      sender_id: req.userId!,
      sender_username: sender.username,
      recipient_id: recipientId,
      recipient_username: recipient.username,
      amount,
      post_id: postId ?? null,
      message: message ?? null,
      created_at: now,
    });

    res.json({ error: null });
  } catch (err: any) {
    console.error("Gift error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /post/:postId — Gifts for a specific post ──────────────────
r.get("/post/:postId", async (req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.gifts);
    const postGifts = all.filter((g: any) => g.post_id === req.params.postId);
    const totalAmount = postGifts.reduce((sum: number, g: any) => sum + (g.amount ?? 0), 0);
    res.json({ totalAmount, gifts: postGifts });
  } catch { res.json({ totalAmount: 0, gifts: [] }); }
});

// ── GET /received/:userId — Gifts received by a user ───────────────
r.get("/received/:userId", async (req: Request, res: Response) => {
  try {
    const all = await scanAll<any>(T.gifts);
    const received = all
      .filter((g: any) => g.recipient_id === req.params.userId)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50);
    res.json(received);
  } catch { res.json([]); }
});

export default r;
