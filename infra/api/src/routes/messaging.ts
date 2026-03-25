import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as svc from "../services/messaging";

const r = Router();

// ── DM Conversations ───────────────────────────────────────────────

r.get("/conversations", requireAuth, async (req, res) => {
  const convos = await svc.getConversations(req.userId!);
  res.json(convos);
});

r.post("/conversations", requireAuth, async (req, res) => {
  const { otherId } = req.body;
  const result = await svc.getOrCreateConversation(req.userId!, otherId);
  res.json(result);
});

r.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const messages = await svc.getMessages(req.params.id);
  res.json(messages);
});

r.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  const { content, mediaUrl, mediaType } = req.body;
  const result = await svc.sendMessage(req.params.id, req.userId!, content, mediaUrl, mediaType);
  res.json(result);
});

r.post("/conversations/:id/read", requireAuth, async (req, res) => {
  await svc.markConversationRead(req.params.id, req.userId!);
  res.json({ success: true });
});

// ── Group Chats ────────────────────────────────────────────────────

r.post("/groups", requireAuth, async (req, res) => {
  const { name, description, isPrivate, memberIds } = req.body;
  const result = await svc.createGroup(req.userId!, name, description, isPrivate, memberIds);
  res.json(result);
});

r.get("/groups", requireAuth, async (req, res) => {
  const groups = await svc.getUserGroups(req.userId!);
  res.json(groups);
});

r.get("/groups/:id", requireAuth, async (req, res) => {
  const group = await svc.getGroup(req.params.id);
  if (!group) return res.status(404).json({ error: "Not found" });
  res.json(group);
});

r.get("/groups/:id/members", requireAuth, async (req, res) => {
  const members = await svc.getGroupMembers(req.params.id);
  res.json(members);
});

r.post("/groups/:id/members", requireAuth, async (req, res) => {
  const { userId } = req.body;
  const result = await svc.addGroupMember(req.params.id, userId, req.userId!);
  res.json(result);
});

r.delete("/groups/:id/members/:userId", requireAuth, async (req, res) => {
  const result = await svc.removeGroupMember(req.params.id, req.params.userId, req.userId!);
  res.json(result);
});

r.get("/groups/:id/messages", requireAuth, async (req, res) => {
  const messages = await svc.getGroupMessages(req.params.id);
  res.json(messages);
});

r.post("/groups/:id/messages", requireAuth, async (req, res) => {
  const { content, mediaUrl, mediaType } = req.body;
  const result = await svc.sendGroupMessage(req.params.id, req.userId!, content, mediaUrl, mediaType);
  res.json(result);
});

r.post("/groups/:id/read", requireAuth, async (req, res) => {
  await svc.markGroupRead(req.params.id, req.userId!);
  res.json({ success: true });
});

export default r;
