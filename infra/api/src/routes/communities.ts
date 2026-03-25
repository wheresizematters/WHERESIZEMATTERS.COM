import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth";
import * as svc from "../services/communities";

const r = Router();

r.get("/", async (_req, res) => {
  const communities = await svc.listCommunities();
  res.json(communities);
});

r.post("/", requireAuth, async (req, res) => {
  const { name, description, isPrivate, slug, tags, rules, minTier, minSize } = req.body;
  const result = await svc.createCommunity(req.userId!, name, description, {
    isPrivate, slug, tags, rules, minTier, minSize,
  });
  res.json(result);
});

r.get("/my", requireAuth, async (req, res) => {
  const communities = await svc.getUserCommunities(req.userId!);
  res.json(communities);
});

r.get("/slug/:slug", async (req, res) => {
  const community = await svc.getCommunityBySlug(req.params.slug);
  if (!community) return res.status(404).json({ error: "Not found" });
  res.json(community);
});

r.get("/:id", async (req, res) => {
  const community = await svc.getCommunity(req.params.id);
  if (!community) return res.status(404).json({ error: "Not found" });
  res.json(community);
});

r.patch("/:id", requireAuth, async (req, res) => {
  const result = await svc.updateCommunity(req.params.id, req.userId!, req.body);
  res.json(result);
});

// Members
r.get("/:id/members", async (req, res) => {
  const members = await svc.getCommunityMembers(req.params.id);
  res.json(members);
});

r.post("/:id/join", requireAuth, async (req, res) => {
  const result = await svc.joinCommunity(req.params.id, req.userId!);
  res.json(result);
});

r.post("/:id/leave", requireAuth, async (req, res) => {
  await svc.leaveCommunity(req.params.id, req.userId!);
  res.json({ success: true });
});

r.post("/:id/members/:userId/approve", requireAuth, async (req, res) => {
  const result = await svc.approveMember(req.params.id, req.params.userId, req.userId!);
  res.json(result);
});

r.post("/:id/members/:userId/ban", requireAuth, async (req, res) => {
  const result = await svc.banMember(req.params.id, req.params.userId, req.userId!);
  res.json(result);
});

// Posts
r.get("/:id/posts", async (req, res) => {
  const posts = await svc.getCommunityPosts(req.params.id);
  res.json(posts);
});

r.post("/:id/posts", requireAuth, async (req, res) => {
  const { title, content, mediaUrl, tag } = req.body;
  const result = await svc.createCommunityPost(req.params.id, req.userId!, title, content, mediaUrl, tag);
  res.json(result);
});

export default r;
