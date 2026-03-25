import { v4 as uuid } from "uuid";
import { T, getItem, putItem, updateItem, deleteItem, queryItems, scanAll } from "../db";

export interface VerificationRequest {
  id: string;
  user_id: string;
  image_path: string;
  reported_size: number;
  ai_est_size: number | null;
  ai_confidence: "low" | "medium" | "high" | null;
  ai_notes: string | null;
  status: "pending" | "auto_verified" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export async function getVerificationRequest(userId: string): Promise<VerificationRequest | null> {
  const results = await queryItems<VerificationRequest>(
    T.verifications,
    "user_id = :uid",
    { ":uid": userId },
    { indexName: "user-verification-index", limit: 1 },
  );
  return results[0] ?? null;
}

export async function upsertVerificationRequest(req: Partial<VerificationRequest> & { user_id: string }): Promise<void> {
  const existing = await getVerificationRequest(req.user_id);
  if (existing) {
    await updateItem(T.verifications, { id: existing.id }, req);
  } else {
    await putItem(T.verifications, { id: uuid(), created_at: new Date().toISOString(), ...req });
  }
}

export async function getPendingVerifications(): Promise<VerificationRequest[]> {
  return scanAll<VerificationRequest>(
    T.verifications,
    "#s = :pending",
    { ":pending": "pending" },
  );
}

export async function reviewVerification(
  requestId: string,
  reviewerId: string,
  action: "approve" | "reject",
): Promise<{ error: string | null }> {
  const req = await getItem<VerificationRequest>(T.verifications, { id: requestId });
  if (!req) return { error: "Not found" };

  await updateItem(T.verifications, { id: requestId }, {
    status: action === "approve" ? "approved" : "rejected",
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewerId,
  });

  if (action === "approve") {
    await updateItem(T.profiles, { id: req.user_id }, { is_verified: true });
  }

  return { error: null };
}
