import { v4 as uuid } from "uuid";
import { putItem, scanAll, updateItem, T, getItem } from "../db";

// ── Types ────────────────────────────────────────────────────────

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  created_at: string;
}

// ── Create referral ──────────────────────────────────────────────

export async function createReferral(
  referrerId: string,
  referredUserId: string,
): Promise<Referral> {
  const referral: Referral = {
    id: uuid(),
    referrer_id: referrerId,
    referred_user_id: referredUserId,
    created_at: new Date().toISOString(),
  };

  await putItem(T.referrals, referral);

  // Increment referral_count on referrer's profile
  const profile = await getItem<any>(T.profiles, { id: referrerId });
  if (profile) {
    await updateItem(T.profiles, { id: referrerId }, {
      referral_count: (profile.referral_count ?? 0) + 1,
    });
  }

  return referral;
}

// ── Get referral stats ───────────────────────────────────────────

export async function getReferralStats(userId: string): Promise<{
  totalReferred: number;
  totalRewardEarned: number;
}> {
  const all = await scanAll<Referral>(T.referrals, "referrer_id = :uid", {
    ":uid": userId,
  });
  return {
    totalReferred: all.length,
    totalRewardEarned: all.length * 500, // 500 $SIZE per referral
  };
}

// ── Get referral list ────────────────────────────────────────────

export async function getReferrals(userId: string): Promise<{
  referredUserId: string;
  createdAt: string;
}[]> {
  const all = await scanAll<Referral>(T.referrals, "referrer_id = :uid", {
    ":uid": userId,
  });
  return all.map((r) => ({
    referredUserId: r.referred_user_id,
    createdAt: r.created_at,
  }));
}

// ── Get today's referral count (for rewards engine) ──────────────

export async function getTodayReferralCount(userId: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const all = await scanAll<Referral>(T.referrals, "referrer_id = :uid", {
    ":uid": userId,
  });
  return all.filter((r) => r.created_at.startsWith(today)).length;
}
