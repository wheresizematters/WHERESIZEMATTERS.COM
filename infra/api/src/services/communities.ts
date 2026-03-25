import { v4 as uuid } from "uuid";
import { T, getItem, putItem, updateItem, deleteItem, queryItems, scanAll } from "../db";
import { getProfile } from "./profiles";

export interface Community {
  id: string;
  name: string;
  slug: string;               // URL-friendly name
  description: string;
  avatar_url: string | null;
  banner_url: string | null;
  created_by: string;
  member_count: number;
  post_count: number;
  is_private: boolean;         // join requires approval
  tags: string[];              // e.g. ["verified-only", "whales", "memes"]
  rules: string[];             // community rules
  min_tier?: number;           // minimum staking tier to join (0-4)
  min_size?: number;           // minimum verified size to join
  created_at: string;
}

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: "owner" | "moderator" | "member";
  joined_at: string;
  status: "active" | "pending" | "banned";
}

export interface CommunityPost {
  id: string;
  community_id: string;
  user_id: string;
  title: string;
  content: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  tag: string | null;
  score: number;
  comment_count: number;
  pinned: boolean;
  created_at: string;
}

// ── Communities CRUD ────────────────────────────────────────────────

export async function createCommunity(
  creatorId: string,
  name: string,
  description: string,
  opts?: { isPrivate?: boolean; slug?: string; tags?: string[]; rules?: string[]; minTier?: number; minSize?: number },
): Promise<{ id: string; error: string | null }> {
  const id = uuid();
  const slug = opts?.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  const now = new Date().toISOString();

  // Check slug uniqueness
  const existing = await getCommunityBySlug(slug);
  if (existing) return { id: "", error: "A community with that name already exists" };

  await putItem(T.communities, {
    id,
    name,
    slug,
    description,
    avatar_url: null,
    banner_url: null,
    created_by: creatorId,
    member_count: 1,
    post_count: 0,
    is_private: opts?.isPrivate ?? false,
    tags: opts?.tags ?? [],
    rules: opts?.rules ?? [],
    min_tier: opts?.minTier ?? 0,
    min_size: opts?.minSize ?? 0,
    created_at: now,
  });

  // Creator is owner
  await putItem(T.community_members, {
    community_id: id,
    user_id: creatorId,
    role: "owner",
    joined_at: now,
    status: "active",
  });

  return { id, error: null };
}

export async function getCommunity(communityId: string): Promise<Community | null> {
  return getItem<Community>(T.communities, { id: communityId });
}

export async function getCommunityBySlug(slug: string): Promise<Community | null> {
  const results = await queryItems<Community>(
    T.communities,
    "slug = :s",
    { ":s": slug },
    { indexName: "slug-index", limit: 1 },
  );
  return results[0] ?? null;
}

export async function listCommunities(limit = 50): Promise<Community[]> {
  const all = await scanAll<Community>(T.communities);
  all.sort((a, b) => b.member_count - a.member_count);
  return all.slice(0, limit);
}

export async function updateCommunity(
  communityId: string,
  userId: string,
  updates: Partial<Community>,
): Promise<{ error: string | null }> {
  const membership = await getItem<CommunityMember>(T.community_members, { community_id: communityId, user_id: userId });
  if (!membership || (membership.role !== "owner" && membership.role !== "moderator")) {
    return { error: "Not authorized" };
  }
  // Don't allow updating protected fields
  const { id, created_by, member_count, post_count, created_at, ...safe } = updates as any;
  await updateItem(T.communities, { id: communityId }, safe);
  return { error: null };
}

// ── Membership ─────────────────────────────────────────────────────

export async function joinCommunity(
  communityId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const community = await getCommunity(communityId);
  if (!community) return { error: "Community not found" };

  // Check existing membership
  const existing = await getItem<CommunityMember>(T.community_members, { community_id: communityId, user_id: userId });
  if (existing && existing.status === "active") return { error: null }; // already a member
  if (existing && existing.status === "banned") return { error: "You are banned from this community" };

  // Check eligibility
  if (community.min_tier && community.min_tier > 0) {
    const profile = await getProfile(userId);
    if (profile && profile.staking_tier < community.min_tier) {
      return { error: `Requires staking tier ${community.min_tier}+` };
    }
  }
  if (community.min_size && community.min_size > 0) {
    const profile = await getProfile(userId);
    if (profile && (!profile.is_verified || profile.size_inches < community.min_size)) {
      return { error: `Requires verified size of ${community.min_size}"+` };
    }
  }

  const status = community.is_private ? "pending" : "active";

  await putItem(T.community_members, {
    community_id: communityId,
    user_id: userId,
    role: "member",
    joined_at: new Date().toISOString(),
    status,
  });

  if (status === "active") {
    await updateItem(T.communities, { id: communityId }, {
      member_count: community.member_count + 1,
    });
  }

  return { error: null };
}

export async function leaveCommunity(communityId: string, userId: string): Promise<void> {
  await deleteItem(T.community_members, { community_id: communityId, user_id: userId });
  const community = await getCommunity(communityId);
  if (community) {
    await updateItem(T.communities, { id: communityId }, {
      member_count: Math.max(0, community.member_count - 1),
    });
  }
}

export async function approveMember(
  communityId: string,
  userId: string,
  approvedBy: string,
): Promise<{ error: string | null }> {
  const approver = await getItem<CommunityMember>(T.community_members, { community_id: communityId, user_id: approvedBy });
  if (!approver || approver.role === "member") return { error: "Not authorized" };

  await updateItem(T.community_members, { community_id: communityId, user_id: userId }, { status: "active" });
  const community = await getCommunity(communityId);
  if (community) {
    await updateItem(T.communities, { id: communityId }, { member_count: community.member_count + 1 });
  }
  return { error: null };
}

export async function banMember(
  communityId: string,
  userId: string,
  bannedBy: string,
): Promise<{ error: string | null }> {
  const banner = await getItem<CommunityMember>(T.community_members, { community_id: communityId, user_id: bannedBy });
  if (!banner || banner.role === "member") return { error: "Not authorized" };

  await updateItem(T.community_members, { community_id: communityId, user_id: userId }, { status: "banned" });
  return { error: null };
}

export async function getCommunityMembers(communityId: string): Promise<any[]> {
  const members = await queryItems<CommunityMember>(
    T.community_members,
    "community_id = :cid",
    { ":cid": communityId },
  );
  return Promise.all(
    members.filter((m) => m.status === "active").map(async (m) => {
      const profile = await getProfile(m.user_id);
      return { ...m, profile };
    })
  );
}

export async function getUserCommunities(userId: string): Promise<any[]> {
  const memberships = await queryItems<CommunityMember>(
    T.community_members,
    "user_id = :uid",
    { ":uid": userId },
    { indexName: "user-communities-index" },
  );

  return Promise.all(
    memberships.filter((m) => m.status === "active").map(async (m) => {
      const community = await getCommunity(m.community_id);
      return { ...community, membership: m };
    })
  );
}

// ── Community Posts ────────────────────────────────────────────────

export async function createCommunityPost(
  communityId: string,
  userId: string,
  title: string,
  content: string,
  mediaUrl?: string,
  tag?: string,
): Promise<{ id: string; error: string | null }> {
  // Verify membership
  const membership = await getItem<CommunityMember>(T.community_members, { community_id: communityId, user_id: userId });
  if (!membership || membership.status !== "active") return { id: "", error: "Not a member" };

  const id = uuid();
  await putItem(T.community_posts, {
    id,
    community_id: communityId,
    user_id: userId,
    title,
    content,
    media_url: mediaUrl ?? null,
    media_type: mediaUrl ? (mediaUrl.includes("mp4") ? "video" : "image") : null,
    tag: tag ?? null,
    score: 0,
    comment_count: 0,
    pinned: false,
    created_at: new Date().toISOString(),
  });

  const community = await getCommunity(communityId);
  if (community) {
    await updateItem(T.communities, { id: communityId }, { post_count: community.post_count + 1 });
  }

  return { id, error: null };
}

export async function getCommunityPosts(communityId: string, limit = 30): Promise<any[]> {
  const posts = await queryItems<CommunityPost>(
    T.community_posts,
    "community_id = :cid",
    { ":cid": communityId },
    { limit },
  );

  posts.sort((a, b) => {
    // Pinned first, then by score
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return Promise.all(
    posts.map(async (p) => {
      const author = await getProfile(p.user_id);
      return {
        ...p,
        author: author ? {
          id: author.id, username: author.username,
          size_inches: author.size_inches, is_verified: author.is_verified,
        } : null,
      };
    })
  );
}
