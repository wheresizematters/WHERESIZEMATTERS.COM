import { v4 as uuid } from "uuid";
import { T, getItem, putItem, updateItem, queryItems, scanAll } from "../db";

export interface Profile {
  id: string;
  username: string;
  email?: string | null;
  password_hash?: string | null;
  auth_provider?: string | null;        // "email" | "x" | "google"
  oauth_provider_id?: string | null;    // external provider user ID
  x_handle?: string | null;
  x_avatar_url?: string | null;
  x_name?: string | null;
  size_inches: number;
  girth_inches?: number | null;
  is_verified: boolean;
  has_set_size: boolean;
  country?: string;
  age_range?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
  header_url?: string;
  notifications_enabled: boolean;
  size_coins: number;
  last_daily_coin_at?: string | null;
  last_post_coin_at?: string | null;
  is_admin: boolean;
  is_premium: boolean;
  premium_expires_at?: string | null;
  wallet_address?: string | null;
  staking_tier: number;
  staking_amount: number;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  created_at: string;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  return getItem<Profile>(T.profiles, { id: userId });
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const results = await queryItems<Profile>(
    T.profiles,
    "username = :u",
    { ":u": username },
    { indexName: "username-index", limit: 1 },
  );
  return results[0] ?? null;
}

export async function getProfileByWallet(wallet: string): Promise<Profile | null> {
  const results = await queryItems<Profile>(
    T.profiles,
    "wallet_address = :w",
    { ":w": wallet.toLowerCase() },
    { indexName: "wallet-index", limit: 1 },
  );
  return results[0] ?? null;
}

export async function createProfile(profile: Profile): Promise<void> {
  await putItem(T.profiles, profile);
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
  await updateItem(T.profiles, { id: userId }, updates);
  return getProfile(userId);
}

export async function awardCoins(userId: string, amount: number): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) return;
  await updateItem(T.profiles, { id: userId }, {
    size_coins: (profile.size_coins ?? 0) + amount,
  });
}

export async function searchUsers(query: string): Promise<Profile[]> {
  if (query.trim().length < 2) return [];
  // DynamoDB doesn't support ILIKE — scan with filter (fine for <100K profiles)
  const all = await scanAll<Profile>(T.profiles);
  const q = query.toLowerCase();
  return all
    .filter((p) => p.username.toLowerCase().includes(q))
    .slice(0, 10);
}

export async function getTotalUserCount(): Promise<number> {
  const all = await scanAll<Profile>(T.profiles);
  return all.length;
}

// ── Leaderboard ────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  size_inches: number;
  country: string;
  is_verified: boolean;
}

export async function getLeaderboard(filter?: {
  country?: string;
  ageRange?: string;
}): Promise<LeaderboardEntry[]> {
  let profiles = await scanAll<Profile>(T.profiles);

  // Only verified users on leaderboard
  profiles = profiles.filter((p) => p.is_verified);

  if (filter?.country) profiles = profiles.filter((p) => p.country === filter.country);
  if (filter?.ageRange) profiles = profiles.filter((p) => p.age_range === filter.ageRange);

  profiles.sort((a, b) => b.size_inches - a.size_inches);

  return profiles.slice(0, 100).map((p, i) => ({
    rank: i + 1,
    id: p.id,
    username: p.username,
    size_inches: p.size_inches,
    country: p.country ?? "",
    is_verified: p.is_verified,
  }));
}

export async function getUserRank(userId: string): Promise<number> {
  const all = await scanAll<Profile>(T.profiles);
  const sorted = all.filter((p) => p.is_verified).sort((a, b) => b.size_inches - a.size_inches);
  const idx = sorted.findIndex((p) => p.id === userId);
  return idx >= 0 ? idx + 1 : 0;
}

export async function getUserPercentile(sizeInches: number): Promise<number> {
  const all = await scanAll<Profile>(T.profiles);
  if (all.length === 0) return 0;
  const smaller = all.filter((p) => p.size_inches < sizeInches).length;
  return Math.round((smaller / all.length) * 100);
}

// ── Auth helpers ──────────────────────────────────────────────────

/** Look up a profile by email using the email-index GSI */
export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const results = await queryItems<Profile>(
    T.profiles,
    "email = :e",
    { ":e": email },
    { indexName: "email-index", limit: 1 },
  );
  return results[0] ?? null;
}

/** Look up a profile by OAuth provider + provider user ID */
export async function getProfileByOAuth(provider: string, providerId: string): Promise<Profile | null> {
  const results = await queryItems<Profile>(
    T.profiles,
    "oauth_provider_id = :pid",
    { ":pid": providerId, ":ap": provider },
    {
      indexName: "oauth-provider-index",
      limit: 1,
      filterExpr: "auth_provider = :ap",
    },
  );
  return results[0] ?? null;
}

/** Create a new profile with email/password auth */
export async function createProfileWithAuth(params: {
  email: string;
  passwordHash: string;
  username: string;
  sizeInches: number;
  ageRange?: string | null;
  girthInches?: number | null;
  authProvider: string;
}): Promise<Profile> {
  const now = new Date().toISOString();
  const profile: Profile = {
    id: uuid(),
    username: params.username,
    email: params.email,
    password_hash: params.passwordHash,
    auth_provider: params.authProvider,
    oauth_provider_id: null,
    x_handle: null,
    x_avatar_url: null,
    x_name: null,
    size_inches: params.sizeInches,
    girth_inches: params.girthInches ?? null,
    is_verified: false,
    has_set_size: true,
    age_range: params.ageRange ?? undefined,
    notifications_enabled: true,
    size_coins: 0,
    is_admin: false,
    is_premium: false,
    staking_tier: 0,
    staking_amount: 0,
    created_at: now,
  };

  await putItem(T.profiles, profile);
  return profile;
}

/** Create a new profile from an OAuth provider (X, Google) */
export async function createOAuthProfile(params: {
  authProvider: string;
  oauthProviderId: string;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  xHandle?: string | null;
  xAvatarUrl?: string | null;
  xName?: string | null;
}): Promise<Profile> {
  const now = new Date().toISOString();

  // Ensure username uniqueness — append random suffix if taken
  let username = params.username;
  const existing = await getProfileByUsername(username);
  if (existing) {
    username = `${username}_${Math.random().toString(36).slice(2, 6)}`;
  }

  const profile: Profile = {
    id: uuid(),
    username,
    email: params.email ?? null,
    password_hash: null,
    auth_provider: params.authProvider,
    oauth_provider_id: params.oauthProviderId,
    x_handle: params.xHandle ?? null,
    x_avatar_url: params.xAvatarUrl ?? null,
    x_name: params.xName ?? null,
    size_inches: 0,
    girth_inches: null,
    is_verified: false,
    has_set_size: false,
    avatar_url: params.avatarUrl ?? undefined,
    notifications_enabled: true,
    size_coins: 0,
    is_admin: false,
    is_premium: false,
    staking_tier: 0,
    staking_amount: 0,
    created_at: now,
  };

  await putItem(T.profiles, profile);
  return profile;
}
