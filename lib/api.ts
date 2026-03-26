import { getToken, getApiUrl } from './supabase';
import { Post, LeaderboardEntry, Conversation, Message, VerificationRequest, Profile, Comment } from './types';

const API = getApiUrl(); // empty string = same-origin (nginx proxies /api/ to backend)
const READY = true; // always ready — either via env var or same-origin proxy

// ── Core fetch helpers ────────────────────────────────────────────

async function api<T = any>(path: string, opts?: { method?: string; body?: any }): Promise<T | null> {
  if (!READY) return null;
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API}${path}`, {
      method: opts?.method ?? 'GET',
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function post<T = any>(path: string, body: any) { return api<T>(path, { method: 'POST', body }); }
function patch<T = any>(path: string, body: any) { return api<T>(path, { method: 'PATCH', body }); }
function del<T = any>(path: string) { return api<T>(path, { method: 'DELETE' }); }

// ── Coins ─────────────────────────────────────────────────────────

export async function awardCoins(userId: string, amount: number): Promise<void> {
  await post(`/api/v1/profiles/${userId}/coins`, { amount });
}

export async function maybeAwardDailyLoginCoins(_userId: string): Promise<boolean> {
  // Handled server-side on profile fetch
  return true;
}

export async function maybeAwardPostCoins(_userId: string): Promise<void> {
  // Handled server-side on post creation
}

// ── Feed ──────────────────────────────────────────────────────────

export async function fetchPosts(userId?: string): Promise<Post[]> {
  return (await api<Post[]>('/api/v1/posts')) ?? [];
}

export async function voteOnPost(postId: string, userId: string, vote: 1 | -1 | 0): Promise<{ error: string | null }> {
  return (await post(`/api/v1/posts/${postId}/vote`, { vote })) ?? { error: null };
}

export async function voteOnPoll(pollOptionId: string, userId: string): Promise<{ error: string | null }> {
  return (await post(`/api/v1/posts/poll/${pollOptionId}/vote`, {})) ?? { error: null };
}

export async function deletePost(postId: string): Promise<{ error: string | null }> {
  return (await del(`/api/v1/posts/${postId}`)) ?? { error: "API unavailable" };
}

export async function createPost(
  userId: string, type: 'discussion' | 'poll', content: string,
  pollOptions?: string[], mediaUrl?: string, tag?: string, title?: string,
): Promise<{ error: string | null }> {
  return (await post('/api/v1/posts', { type, content, pollOptions, mediaUrl, tag, title })) ?? { error: 'API unavailable' };
}

// ── Leaderboard ───────────────────────────────────────────────────

export async function fetchLeaderboard(filter?: { country?: string; ageRange?: string }): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams();
  if (filter?.country) params.set('country', filter.country);
  if (filter?.ageRange) params.set('ageRange', filter.ageRange);
  const qs = params.toString();
  return (await api<LeaderboardEntry[]>(`/api/v1/profiles/leaderboard${qs ? `?${qs}` : ''}`)) ?? [];
}

// ── Search / Compare ──────────────────────────────────────────────

export async function searchUsers(query: string) {
  if (query.trim().length < 2) return [];
  return (await api(`/api/v1/profiles/search?q=${encodeURIComponent(query.trim())}`)) ?? [];
}

export async function fetchUserPercentile(sizeInches: number): Promise<number> {
  const data = await api<{ percentile: number }>(`/api/v1/profiles/percentile/${sizeInches}`);
  return data?.percentile ?? 0;
}

// ── Profile ───────────────────────────────────────────────────────

export async function fetchPublicProfile(userId: string): Promise<Profile | null> {
  return api<Profile>(`/api/v1/profiles/${userId}`);
}

export interface RankResult {
  rank: number;
  provisional: boolean;
  totalVerified: number;
}

export async function fetchUserRank(userId: string): Promise<RankResult> {
  const data = await api<RankResult>(`/api/v1/profiles/${userId}/rank`);
  return data ?? { rank: 0, provisional: false, totalVerified: 0 };
}

export async function fetchPost(postId: string): Promise<Post | null> {
  return api<Post>(`/api/v1/posts/${postId}`);
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  return (await api<Comment[]>(`/api/v1/posts/${postId}/comments`)) ?? [];
}

export async function createComment(postId: string, userId: string, content: string, mediaUrl?: string): Promise<{ error: string | null }> {
  const body: any = { content };
  if (mediaUrl) body.media_url = mediaUrl;
  return (await post(`/api/v1/posts/${postId}/comments`, body)) ?? { error: 'API unavailable' };
}

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  return (await api<Post[]>(`/api/v1/posts/user/${userId}`)) ?? [];
}

export async function fetchUserPostCount(userId: string): Promise<number> {
  const data = await api<{ count: number }>(`/api/v1/posts/user/${userId}/count`);
  return data?.count ?? 0;
}

export async function fetchTotalUserCount(): Promise<number> {
  const data = await api<{ count: number }>('/api/v1/profiles/count');
  return data?.count ?? 0;
}

// ── Nearby Leaderboard ────────────────────────────────────────────

export interface NearbyEntry {
  id: string; username: string; size_inches: number; is_verified: boolean;
  lat: number; lng: number; distance_miles: number; rank: number;
}

export async function fetchLeaderboardByRadius(lat: number, lng: number, radiusMiles: number): Promise<NearbyEntry[]> {
  return (await api<NearbyEntry[]>(`/api/v1/profiles/leaderboard/nearby?lat=${lat}&lng=${lng}&radius=${radiusMiles}`)) ?? [];
}

// ── Messaging ─────────────────────────────────────────────────────

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  return (await api<Conversation[]>('/api/v1/messaging/conversations')) ?? [];
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await post(`/api/v1/messaging/conversations/${conversationId}/read`, {});
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  return (await api<Message[]>(`/api/v1/messaging/conversations/${conversationId}/messages`)) ?? [];
}

export async function sendMessage(
  conversationId: string, senderId: string, content: string,
  mediaPath?: string, mediaType?: 'image' | 'video',
): Promise<{ error: string | null }> {
  return (await post(`/api/v1/messaging/conversations/${conversationId}/messages`, { content, mediaUrl: mediaPath, mediaType })) ?? { error: 'API unavailable' };
}

export async function uploadMessageMedia(
  conversationId: string, localUri: string, mimeType: string,
): Promise<{ path: string | null; error: string | null }> {
  const ext = mimeType.includes('video') ? 'mp4' : 'jpg';
  const path = `message-media/${conversationId}/${Date.now()}.${ext}`;
  // Get presigned upload URL from our API
  const urlData = await post<{ uploadUrl: string; publicUrl: string }>('/api/v1/storage/upload-url', {
    bucket: 'message-media', path, contentType: mimeType,
  });
  if (!urlData?.uploadUrl) return { path: null, error: 'Failed to get upload URL' };
  // Upload directly to S3
  const response = await fetch(localUri);
  const blob = await response.blob();
  const uploadRes = await fetch(urlData.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': mimeType } });
  if (!uploadRes.ok) return { path: null, error: 'Upload failed' };
  return { path, error: null };
}

export async function getMessageMediaUrl(path: string): Promise<string | null> {
  const data = await api<{ url: string }>(`/api/v1/storage/signed-url?bucket=message-media&path=${encodeURIComponent(path)}`);
  return data?.url ?? null;
}

export async function markMediaViewed(messageId: string): Promise<void> {
  await post(`/api/v1/messaging/messages/${messageId}/viewed`, {});
}

// ── Verification ──────────────────────────────────────────────────

export async function fetchMyVerificationRequest(userId: string): Promise<VerificationRequest | null> {
  return api<VerificationRequest>(`/api/v1/verifications/me`);
}

export async function submitVerificationPhoto(
  userId: string, localUri: string, reportedSize: number,
): Promise<{ imagePath: string | null; error: string | null }> {
  const ext = localUri.split('.').pop() ?? 'jpg';
  const path = `verifications/${userId}/${Date.now()}.${ext}`;
  const urlData = await post<{ uploadUrl: string }>('/api/v1/storage/upload-url', {
    bucket: 'verifications', path, contentType: 'image/jpeg',
  });
  if (!urlData?.uploadUrl) return { imagePath: null, error: 'Failed to get upload URL' };
  const response = await fetch(localUri);
  const blob = await response.blob();
  const uploadRes = await fetch(urlData.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
  if (!uploadRes.ok) return { imagePath: null, error: 'Upload failed' };
  return { imagePath: path, error: null };
}

export async function runVerification(
  imagePath: string, reportedSize: number, reportedGirth?: number | null, verifyType?: string,
): Promise<{ status: 'auto_verified' | 'pending'; reason?: string; error?: string }> {
  const data = await post<{ status: 'auto_verified' | 'pending'; reason?: string; error?: string }>(
    '/api/v1/verifications/verify', { imagePath, reportedSize, reportedGirth, verifyType: verifyType ?? 'size' },
  );
  return data ?? { status: 'pending', error: 'API unavailable' };
}

export async function fetchPendingVerifications(): Promise<VerificationRequest[]> {
  return (await api<VerificationRequest[]>('/api/v1/verifications/pending')) ?? [];
}

export async function getVerificationSignedUrl(imagePath: string): Promise<string | null> {
  const data = await api<{ url: string }>(`/api/v1/storage/signed-url?bucket=verifications&path=${encodeURIComponent(imagePath)}`);
  return data?.url ?? null;
}

export async function adminReviewVerification(requestId: string, action: 'approve' | 'reject'): Promise<{ error: string | null }> {
  return (await post('/api/v1/verifications/review', { requestId, action })) ?? { error: 'API unavailable' };
}

// ── Follows ───────────────────────────────────────────────────────

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return;
  await post(`/api/v1/users/${followingId}/follow`, {});
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const data = await api<{ following: boolean }>(`/api/v1/users/${followingId}/is-following`);
  return data?.following ?? false;
}

export async function getOrCreateConversation(myId: string, otherId: string): Promise<{ id: string | null; error: string | null }> {
  return (await post('/api/v1/messaging/conversations', { otherId })) ?? { id: null, error: 'API unavailable' };
}

// ── Groups ────────────────────────────────────────────────────────

export async function fetchGroups(): Promise<any[]> {
  return (await api('/api/v1/messaging/groups')) ?? [];
}

export async function createGroup(name: string, description: string, isPrivate?: boolean, memberIds?: string[]): Promise<{ id: string; error: string | null }> {
  return (await post('/api/v1/messaging/groups', { name, description, isPrivate, memberIds })) ?? { id: '', error: 'API unavailable' };
}

export async function fetchGroupMessages(groupId: string): Promise<any[]> {
  return (await api(`/api/v1/messaging/groups/${groupId}/messages`)) ?? [];
}

export async function sendGroupMessage(groupId: string, content: string, mediaUrl?: string, mediaType?: 'image' | 'video'): Promise<{ error: string | null }> {
  return (await post(`/api/v1/messaging/groups/${groupId}/messages`, { content, mediaUrl, mediaType })) ?? { error: 'API unavailable' };
}

export async function fetchGroupMembers(groupId: string): Promise<any[]> {
  return (await api(`/api/v1/messaging/groups/${groupId}/members`)) ?? [];
}

export async function addGroupMember(groupId: string, userId: string): Promise<{ error: string | null }> {
  return (await post(`/api/v1/messaging/groups/${groupId}/members`, { userId })) ?? { error: 'API unavailable' };
}

export async function removeGroupMember(groupId: string, userId: string): Promise<{ error: string | null }> {
  return (await del(`/api/v1/messaging/groups/${groupId}/members/${userId}`)) ?? { error: 'API unavailable' };
}

// ── Communities ───────────────────────────────────────────────────

export async function fetchCommunities(): Promise<any[]> { return (await api('/api/v1/communities')) ?? []; }
export async function fetchMyCommunities(): Promise<any[]> { return (await api('/api/v1/communities/my')) ?? []; }
export async function fetchCommunity(id: string): Promise<any | null> { return api(`/api/v1/communities/${id}`); }
export async function fetchCommunityBySlug(slug: string): Promise<any | null> { return api(`/api/v1/communities/slug/${slug}`); }

export async function createCommunity(name: string, description: string, opts?: any): Promise<{ id: string; error: string | null }> {
  return (await post('/api/v1/communities', { name, description, ...opts })) ?? { id: '', error: 'API unavailable' };
}

export async function joinCommunity(id: string): Promise<{ error: string | null }> {
  return (await post(`/api/v1/communities/${id}/join`, {})) ?? { error: 'API unavailable' };
}

export async function leaveCommunity(id: string): Promise<void> { await post(`/api/v1/communities/${id}/leave`, {}); }
export async function fetchCommunityPosts(id: string): Promise<any[]> { return (await api(`/api/v1/communities/${id}/posts`)) ?? []; }

export async function createCommunityPost(id: string, title: string, content: string, mediaUrl?: string, tag?: string): Promise<{ id: string; error: string | null }> {
  return (await post(`/api/v1/communities/${id}/posts`, { title, content, mediaUrl, tag })) ?? { id: '', error: 'API unavailable' };
}

export async function fetchCommunityMembers(id: string): Promise<any[]> { return (await api(`/api/v1/communities/${id}/members`)) ?? []; }

// ── Gifting ───────────────────────────────────────────────────────

export async function sendGift(
  recipientId: string, amount: number, postId?: string, message?: string,
): Promise<{ error: string | null }> {
  return (await post('/api/v1/gifts', { recipientId, amount, postId, message })) ?? { error: 'API unavailable' };
}

export async function getGiftsForPost(postId: string): Promise<{ totalAmount: number; gifts: any[] }> {
  return (await api(`/api/v1/gifts/post/${postId}`)) ?? { totalAmount: 0, gifts: [] };
}

export async function getGiftsReceived(userId: string): Promise<any[]> {
  return (await api(`/api/v1/gifts/received/${userId}`)) ?? [];
}
