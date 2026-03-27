import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth";
import * as svc from "../services/posts";

const r = Router();

r.get("/", optionalAuth, async (req, res) => {
  try {
    const posts = await svc.getPosts(req.userId);
    res.json(posts);
  } catch (err: any) {
    console.error("Get posts error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.post("/", requireAuth, async (req, res) => {
  try {
    const { type, content, pollOptions, mediaUrl, tag, title } = req.body;
    const result = await svc.createPost(req.userId!, type, content, pollOptions, mediaUrl, tag, title);
    res.json(result);
  } catch (err: any) {
    console.error("Create post error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.get("/:postId", async (req, res) => {
  try {
    const post = await svc.getPost(req.params.postId);
    if (!post) return res.status(404).json({ error: "Not found" });
    res.json(post);
  } catch (err: any) {
    console.error("Get post error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.delete("/:postId", requireAuth, async (req, res) => {
  try {
    const result = await svc.deletePost(req.params.postId, req.userId!);
    res.json(result);
  } catch (err: any) {
    console.error("Delete post error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.get("/user/:userId", async (req, res) => {
  try {
    const posts = await svc.getUserPosts(req.params.userId);
    res.json(posts);
  } catch (err: any) {
    console.error("Get user posts error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.get("/user/:userId/count", async (req, res) => {
  try {
    const count = await svc.getUserPostCount(req.params.userId);
    res.json({ count });
  } catch (err: any) {
    console.error("Get user post count error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Voting
r.post("/:postId/vote", requireAuth, async (req, res) => {
  try {
    const { vote } = req.body;
    const result = await svc.voteOnPost(req.params.postId, req.userId!, vote);
    res.json(result);
  } catch (err: any) {
    console.error("Vote error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.post("/poll/:optionId/vote", requireAuth, async (req, res) => {
  try {
    const result = await svc.voteOnPoll(req.params.optionId, req.userId!);
    res.json(result);
  } catch (err: any) {
    console.error("Poll vote error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Comments
r.get("/:postId/comments", async (req, res) => {
  try {
    const comments = await svc.getComments(req.params.postId);
    res.json(comments);
  } catch (err: any) {
    console.error("Get comments error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

r.post("/:postId/comments", requireAuth, async (req, res) => {
  try {
    const { content, media_url } = req.body;
    const result = await svc.createComment(req.params.postId, req.userId!, content, media_url);
    res.json(result);
  } catch (err: any) {
    console.error("Create comment error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default r;
