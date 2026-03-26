import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth";
import * as svc from "../services/posts";

const r = Router();

r.get("/", optionalAuth, async (req, res) => {
  const posts = await svc.getPosts(req.userId);
  res.json(posts);
});

r.post("/", requireAuth, async (req, res) => {
  const { type, content, pollOptions, mediaUrl, tag, title } = req.body;
  const result = await svc.createPost(req.userId!, type, content, pollOptions, mediaUrl, tag, title);
  res.json(result);
});

r.get("/:postId", async (req, res) => {
  const post = await svc.getPost(req.params.postId);
  if (!post) return res.status(404).json({ error: "Not found" });
  res.json(post);
});

r.delete("/:postId", requireAuth, async (req, res) => {
  const result = await svc.deletePost(req.params.postId, req.userId!);
  res.json(result);
});

r.get("/user/:userId", async (req, res) => {
  const posts = await svc.getUserPosts(req.params.userId);
  res.json(posts);
});

r.get("/user/:userId/count", async (req, res) => {
  const count = await svc.getUserPostCount(req.params.userId);
  res.json({ count });
});

// Voting
r.post("/:postId/vote", requireAuth, async (req, res) => {
  const { vote } = req.body;
  const result = await svc.voteOnPost(req.params.postId, req.userId!, vote);
  res.json(result);
});

r.post("/poll/:optionId/vote", requireAuth, async (req, res) => {
  const result = await svc.voteOnPoll(req.params.optionId, req.userId!);
  res.json(result);
});

// Comments
r.get("/:postId/comments", async (req, res) => {
  const comments = await svc.getComments(req.params.postId);
  res.json(comments);
});

r.post("/:postId/comments", requireAuth, async (req, res) => {
  const { content, media_url } = req.body;
  const result = await svc.createComment(req.params.postId, req.userId!, content, media_url);
  res.json(result);
});

export default r;
