import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { requireAuth } from "../middleware/auth";
import { getProfile } from "../services/profiles";
import { T, getItem, putItem, queryItems } from "../db";

const r = Router();

// ── GET /:coinAddress/messages — Circle Jerk messages ──────────────
r.get("/:coinAddress/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const { channel } = req.query as { channel?: string };
    const messages = await queryItems<any>(
      T.group_messages,
      "group_id = :gid",
      { ":gid": req.params.coinAddress },
      { limit: 60, scanForward: false },
    );

    // Filter by channel if specified
    const filtered = channel
      ? messages.filter((m: any) => m.channel === channel)
      : messages;

    res.json(filtered);
  } catch { res.json([]); }
});

// ── POST /:coinAddress/messages — Send Circle Jerk message ─────────
r.post("/:coinAddress/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const profile = await getProfile(req.userId!);
    if (!profile) return res.status(401).json({ error: "Not authenticated" });

    // Check membership
    const membership = await getItem<any>(T.group_members, {
      group_id: req.params.coinAddress,
      user_id: req.userId!,
    });
    if (!membership) return res.status(403).json({ error: "Not a member of this Circle Jerk" });

    const { content, channel } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content required" });

    const now = new Date().toISOString();
    await putItem(T.group_messages, {
      id: uuid(),
      group_id: req.params.coinAddress,
      sender_id: req.userId!,
      senderUsername: profile.username,
      senderTier: membership.role === "owner" ? "DADDY" : "STROKER",
      channel: channel ?? "GENERAL",
      content: content.trim(),
      createdAt: now,
    });

    // Update group last activity
    const group = await getItem<any>(T.groups, { id: req.params.coinAddress });
    if (group) {
      await putItem(T.groups, {
        ...group,
        lastActivity: now,
        last_message_preview: content.trim().slice(0, 60),
      });
    }

    res.json({ error: null });
  } catch (err: any) {
    console.error("Circle Jerk message error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default r;
