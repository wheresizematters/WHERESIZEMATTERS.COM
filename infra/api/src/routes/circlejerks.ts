import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { requireAuth } from "../middleware/auth";
import { getProfile } from "../services/profiles";
import { T, getItem, putItem, deleteItem, updateItem, queryItems, scanAll } from "../db";

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

// ── Helper: check if user is creator/owner ─────────────────────────
async function isOwner(coinAddress: string, userId: string): Promise<boolean> {
  const membership = await getItem<any>(T.group_members, { group_id: coinAddress, user_id: userId });
  return membership?.role === "owner";
}

// ── DELETE message (creator/owner only) ────────────────────────────
r.delete("/:coinAddress/messages/:messageId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { coinAddress, messageId } = req.params;
    const msg = await getItem<any>(T.group_messages, { id: messageId });
    if (!msg) return res.status(404).json({ error: "Message not found" });

    // Allow deletion if sender or owner
    const owner = await isOwner(coinAddress, req.userId!);
    if (msg.sender_id !== req.userId! && !owner) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await deleteItem(T.group_messages, { id: messageId });
    res.json({ error: null });
  } catch (err: any) {
    console.error("Delete message error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── PIN/UNPIN message (creator/owner only) ─────────────────────────
r.post("/:coinAddress/messages/:messageId/pin", requireAuth, async (req: Request, res: Response) => {
  try {
    const { coinAddress, messageId } = req.params;
    if (!await isOwner(coinAddress, req.userId!)) {
      return res.status(403).json({ error: "Only the creator can pin messages" });
    }

    const msg = await getItem<any>(T.group_messages, { id: messageId });
    if (!msg) return res.status(404).json({ error: "Message not found" });

    const pinned = !msg.pinned;
    await putItem(T.group_messages, { ...msg, pinned });
    res.json({ pinned });
  } catch (err: any) {
    console.error("Pin message error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── GET members ───────────────────────────────────────────────────
r.get("/:coinAddress/members", requireAuth, async (req: Request, res: Response) => {
  try {
    const members = await queryItems<any>(
      T.group_members,
      "group_id = :gid",
      { ":gid": req.params.coinAddress },
    );
    // Hydrate with profiles
    const hydrated = await Promise.all(members.map(async (m: any) => {
      const profile = await getProfile(m.user_id);
      return {
        userId: m.user_id,
        role: m.role,
        banned: m.banned ?? false,
        joinedAt: m.joined_at ?? m.createdAt,
        username: profile?.username ?? "unknown",
        isVerified: profile?.is_verified ?? false,
        sizeInches: profile?.size_inches ?? 0,
      };
    }));
    res.json(hydrated);
  } catch (err: any) {
    console.error("Get members error:", err);
    res.json([]);
  }
});

// ── BAN/UNBAN member (creator/owner only) ─────────────────────────
r.post("/:coinAddress/members/:userId/ban", requireAuth, async (req: Request, res: Response) => {
  try {
    const { coinAddress, userId } = req.params;
    if (!await isOwner(coinAddress, req.userId!)) {
      return res.status(403).json({ error: "Only the creator can ban members" });
    }
    if (userId === req.userId!) {
      return res.status(400).json({ error: "Cannot ban yourself" });
    }

    const member = await getItem<any>(T.group_members, { group_id: coinAddress, user_id: userId });
    if (!member) return res.status(404).json({ error: "Member not found" });

    const banned = !member.banned;
    await putItem(T.group_members, { ...member, banned });
    res.json({ banned });
  } catch (err: any) {
    console.error("Ban member error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── ADMIT member to inner circle (creator/owner only) ──────────────
r.post("/:coinAddress/members/:userId/admit", requireAuth, async (req: Request, res: Response) => {
  try {
    const { coinAddress, userId } = req.params;
    if (!await isOwner(coinAddress, req.userId!)) {
      return res.status(403).json({ error: "Only the creator can admit members" });
    }

    const member = await getItem<any>(T.group_members, { group_id: coinAddress, user_id: userId });
    if (!member) return res.status(404).json({ error: "Member not found" });

    const admitted = !member.innerCircle;
    await putItem(T.group_members, { ...member, innerCircle: admitted });
    res.json({ innerCircle: admitted });
  } catch (err: any) {
    console.error("Admit member error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── SET member role (creator/owner only) ──────────────────────────
r.post("/:coinAddress/members/:userId/role", requireAuth, async (req: Request, res: Response) => {
  try {
    const { coinAddress, userId } = req.params;
    const { role } = req.body;
    if (!await isOwner(coinAddress, req.userId!)) {
      return res.status(403).json({ error: "Only the creator can set roles" });
    }
    if (userId === req.userId!) {
      return res.status(400).json({ error: "Cannot change your own role" });
    }

    const member = await getItem<any>(T.group_members, { group_id: coinAddress, user_id: userId });
    if (!member) return res.status(404).json({ error: "Member not found" });

    await putItem(T.group_members, { ...member, role });
    res.json({ role });
  } catch (err: any) {
    console.error("Set role error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default r;
