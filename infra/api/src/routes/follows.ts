import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import * as svc from "../services/follows";

const r = Router();

r.post("/:userId/follow", requireAuth, async (req, res) => {
  await svc.followUser(req.userId!, req.params.userId);
  res.json({ success: true });
});

r.post("/:userId/unfollow", requireAuth, async (req, res) => {
  await svc.unfollowUser(req.userId!, req.params.userId);
  res.json({ success: true });
});

r.get("/:userId/is-following", requireAuth, async (req, res) => {
  const following = await svc.isFollowing(req.userId!, req.params.userId);
  res.json({ following });
});

r.get("/:userId/followers", async (req, res) => {
  const followers = await svc.getFollowers(req.params.userId);
  res.json(followers);
});

r.get("/:userId/following", async (req, res) => {
  const following = await svc.getFollowing(req.params.userId);
  res.json(following);
});

export default r;
