import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import * as svc from "../services/verification";
import { updateProfile } from "../services/profiles";

const r = Router();

r.get("/me", requireAuth, async (req, res) => {
  const data = await svc.getVerificationRequest(req.userId!);
  res.json(data);
});

r.post("/verify", requireAuth, async (req, res) => {
  const { imagePath, reportedSize, reportedGirth } = req.body;
  // For now, queue for review (Claude AI verification would go here)
  await svc.upsertVerificationRequest({
    user_id: req.userId!,
    image_path: imagePath,
    reported_size: reportedSize,
    status: "pending",
  });
  res.json({ status: "pending", reason: "queued_for_review" });
});

r.get("/pending", requireAuth, async (req, res) => {
  const data = await svc.getPendingVerifications();
  res.json(data);
});

r.post("/review", requireAuth, async (req, res) => {
  const { requestId, action } = req.body;
  const result = await svc.reviewVerification(requestId, req.userId!, action);
  res.json(result);
});

export default r;
