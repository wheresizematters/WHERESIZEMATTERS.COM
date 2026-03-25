import { T, putItem, deleteItem, getItem, queryItems } from "../db";

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return;
  const now = new Date().toISOString();
  // Mutual follow
  await putItem(T.follows, { follower_id: followerId, following_id: followingId, created_at: now });
  await putItem(T.follows, { follower_id: followingId, following_id: followerId, created_at: now });
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await deleteItem(T.follows, { follower_id: followerId, following_id: followingId });
  await deleteItem(T.follows, { follower_id: followingId, following_id: followerId });
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const item = await getItem(T.follows, { follower_id: followerId, following_id: followingId });
  return !!item;
}

export async function getFollowers(userId: string): Promise<string[]> {
  const results = await queryItems<Follow>(
    T.follows,
    "following_id = :uid",
    { ":uid": userId },
    { indexName: "following-index" },
  );
  return results.map((f) => f.follower_id);
}

export async function getFollowing(userId: string): Promise<string[]> {
  const results = await queryItems<Follow>(
    T.follows,
    "follower_id = :uid",
    { ":uid": userId },
  );
  return results.map((f) => f.following_id);
}
