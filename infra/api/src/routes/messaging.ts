import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as svc from "../services/messaging";

const r = Router();

// ── DM Conversations ───────────────────────────────────────────────

r.get("/conversations", requireAuth, async (req, res) => {
  try {
    const convos = await svc.getConversations(req.userId!);
    res.json(convos);
  } catch (err: any) {
    console.error("Get conversations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.post("/conversations", requireAuth, async (req, res) => {
  try {
    const { otherId } = req.body;
    const result = await svc.getOrCreateConversation(req.userId!, otherId);
    res.json(result);
  } catch (err: any) {
    console.error("Create conversation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const messages = await svc.getMessages(req.params.id);
    res.json(messages);
  } catch (err: any) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const { content, mediaUrl, mediaType } = req.body;
    const result = await svc.sendMessage(req.params.id, req.userId!, content, mediaUrl, mediaType);
    res.json(result);
  } catch (err: any) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.post("/conversations/:id/read", requireAuth, async (req, res) => {
  try {
    await svc.markConversationRead(req.params.id, req.userId!);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Group Chats ────────────────────────────────────────────────────

r.post("/groups", requireAuth, async (req, res) => {
  try {
    const { name, description, isPrivate, memberIds } = req.body;
    const result = await svc.createGroup(req.userId!, name, description, isPrivate, memberIds);
    res.json(result);
  } catch (err: any) {
    console.error("Create group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.get("/groups", requireAuth, async (req, res) => {
  try {
    const groups = await svc.getUserGroups(req.userId!);
    res.json(groups);
  } catch (err: any) {
    console.error("Get groups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.get("/groups/:id", requireAuth, async (req, res) => {
  try {
    const group = await svc.getGroup(req.params.id);
    if (!group) return res.status(404).json({ error: "Not found" });
    res.json(group);
  } catch (err: any) {
    console.error("Get group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.get("/groups/:id/members", requireAuth, async (req, res) => {
  try {
    const members = await svc.getGroupMembers(req.params.id);
    res.json(members);
  } catch (err: any) {
    console.error("Get group members error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.post("/groups/:id/members", requireAuth, async (req, res) => {
  try {
    const { userId } = req.body;
    const result = await svc.addGroupMember(req.params.id, userId, req.userId!);
    res.json(result);
  } catch (err: any) {
    console.error("Add group member error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.delete("/groups/:id/members/:userId", requireAuth, async (req, res) => {
  try {
    const result = await svc.removeGroupMember(req.params.id, req.params.userId, req.userId!);
    res.json(result);
  } catch (err: any) {
    console.error("Remove group member error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.get("/groups/:id/messages", requireAuth, async (req, res) => {
  try {
    const messages = await svc.getGroupMessages(req.params.id);
    res.json(messages);
  } catch (err: any) {
    console.error("Get group messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.post("/groups/:id/messages", requireAuth, async (req, res) => {
  try {
    const { content, mediaUrl, mediaType } = req.body;
    const result = await svc.sendGroupMessage(req.params.id, req.userId!, content, mediaUrl, mediaType);
    res.json(result);
  } catch (err: any) {
    console.error("Send group message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.post("/groups/:id/read", requireAuth, async (req, res) => {
  try {
    await svc.markGroupRead(req.params.id, req.userId!);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Mark group read error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default r;
