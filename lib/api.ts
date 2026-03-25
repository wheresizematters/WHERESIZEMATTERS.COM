import { supabase, SUPABASE_READY } from './supabase';
import { MOCK_POSTS, MOCK_LEADERBOARD } from './mockData';
import { Post, LeaderboardEntry, Conversation, Message, VerificationRequest, Profile, Comment } from './types';

// ── API Base ─────────────────────────────────────────────────────────

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';
const API_READY = API_BASE.length > 0;

async function getAuthToken(): Promise<string | null> {
  if (!SUPABASE_READY) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function api<T = any>(
  path: string,
  opts?: { method?: string; body?: any },
): Promise<T | null> {
  if (!API_READY) return null;
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts?.method ?? 'GET',
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function apiPost<T = any>(path: string, body: any): Promise<T | null> {
  return api<T>(path, { method: 'POST', body });
}

async function apiPatch<T = any>(path: string, body: any): Promise<T | null> {
  return api<T>(path, { method: 'PATCH', body });
}

async function apiDelete<T = any>(path: string): Promise<T | null> {
  return api<T>(path, { method: 'DELETE' });
}

// ── Coins ─────────────────────────────────────────────────────────────────────

export async function awardCoins(userId: string, amount: number): Promise<void> {
  await apiPost(`/api/v1/profiles/${userId}/coins`, { amount });
}

export async function maybeAwardDailyLoginCoins(userId: string): Promise<boolean> {
  // Handled server-side now — just call the profile endpoint
  // The backend awards coins on profile fetch if daily threshold met
  await api(`/api/v1/profiles/me`);
  return true;
}

export async function maybeAwardPostCoins(userId: string): Promise<void> {
  // Handled server-side when creating a post
}

// ── Feed ──────────────────────────────────────────────────────────────────────

export async function fetchPosts(userId?: string): Promise<Post[]> {
  if (!API_READY) return MOCK_POSTS;
  const posts = await api<Post[]>('/api/v1/posts');
  return posts ?? MOCK_POSTS;
}

export async function voteOnPost(
  postId: string,
  userId: string,
  vote: 1 | -1 | 0,
): Promise<{ error: string | null }> {
  const result = await apiPost<{ error: string | null }>(`/api/v1/posts/${postId}/vote`, { vote });
  return result ?? { error: null };
}

export async function voteOnPoll(pollOptionId: string, userId: string): Promise<{ error: string | null }> {
  const result = await apiPost<{ error: string | null }>(`/api/v1/posts/poll/${pollOptionId}/vote`, {});
  return result ?? { error: null };
}

export async function createPost(
  userId: string,
  type: 'discussion' | 'poll',
  content: string,
  pollOptions?: string[],
  mediaUrl?: string,
  tag?: string,
  title?: string,
): Promise<{ error: string | null }> {
  const result = await apiPost<{ error: string | null }>('/api/v1/posts', {
    type, content, pollOptions, mediaUrl, tag, title,
  });
  return result ?? { error: 'API unavailable' };
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function fetchLeaderboard(filter?: {
  country?: string;
  ageRange?: string;
}): Promise<LeaderboardEntry[]> {
  if (!API_READY) return MOCK_LEADERBOARD;
  const params = new URLSearchParams();
  if (filter?.country) params.set('country', filter.country);
  if (filter?.ageRange) params.set('ageRange', filter.ageRange);
  const qs = params.toString();
  const data = await api<LeaderboardEntry[]>(`/api/v1/profiles/leaderboard${qs ? `?${qs}` : ''}`);
  return data ?? MOCK_LEADERBOARD;
}

// ── Compare ───────────────────────────────────────────────────────────────────

export async function searchUsers(query: string) {
  if (query.trim().length < 2) return [];
  if (!API_READY) {
    return MOCK_LEADERBOARD.filter(u =>
      u.username.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
  }
  const data = await api(`/api/v1/profiles/search?q=${encodeURIComponent(query.trim())}`);
  return data ?? [];
}

export async function fetchUserPercentile(sizeInches: number): Promise<number> {
  if (!API_READY) return 72;
  const data = await api<{ percentile: number }>(`/api/v1/profiles/percentile/${sizeInches}`);
  return data?.percentile ?? 0;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function fetchPublicProfile(userId: string): Promise<Profile | null> {
  if (!API_READY) {
    const mock = MOCK_LEADERBOARD.find(u => u.id === userId);
    if (!mock) return null;
    return { id: mock.id, username: mock.username, size_inches: mock.size_inches, is_verified: mock.is_verified, has_set_size: true, country: mock.country, created_at: new Date().toISOString() };
  }
  return api<Profile>(`/api/v1/profiles/${userId}`);
}

export async function fetchUserRank(userId: string): Promise<number> {
  if (!API_READY) return 247;
  const data = await api<{ rank: number }>(`/api/v1/profiles/${userId}/rank`);
  return data?.rank ?? 0;
}

export async function fetchPost(postId: string): Promise<Post | null> {
  if (!API_READY) return MOCK_POSTS.find(p => p.id === postId) ?? null;
  return api<Post>(`/api/v1/posts/${postId}`);
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  if (!API_READY) return [];
  const data = await api<Comment[]>(`/api/v1/posts/${postId}/comments`);
  return data ?? [];
}

export async function createComment(
  postId: string,
  userId: string,
  content: string,
): Promise<{ error: string | null }> {
  const result = await apiPost<{ error: string | null }>(`/api/v1/posts/${postId}/comments`, { content });
  return result ?? { error: 'API unavailable' };
}

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  if (!API_READY) return MOCK_POSTS.filter(p => p.author.id === userId);
  const data = await api<Post[]>(`/api/v1/posts/user/${userId}`);
  return data ?? [];
}

export async function fetchUserPostCount(userId: string): Promise<number> {
  if (!API_READY) return 14;
  const data = await api<{ count: number }>(`/api/v1/posts/user/${userId}/count`);
  return data?.count ?? 0;
}

export async function fetchTotalUserCount(): Promise<number> {
  if (!API_READY) return 12842;
  const data = await api<{ count: number }>('/api/v1/profiles/count');
  return data?.count ?? 0;
}

// ── Nearby Leaderboard ────────────────────────────────────────────────────────

export interface NearbyEntry {
  id: string;
  username: string;
  size_inches: number;
  is_verified: boolean;
  lat: number;
  lng: number;
  distance_miles: number;
  rank: number;
}

export async function fetchLeaderboardByRadius(
  lat: number,
  lng: number,
  radiusMiles: number,
): Promise<NearbyEntry[]> {
  // TODO: Implement geospatial query on AWS backend
  // For now, fall back to Supabase RPC if available
  if (!SUPABASE_READY) return [];
  const { data, error } = await supabase.rpc('leaderboard_by_radius', {
    center_lat: lat,
    center_lng: lng,
    radius_miles: radiusMiles,
  });
  if (error || !data) return [];
  return data as NearbyEntry[];
}

// ── Messaging ─────────────────────────────────────────────────────────────────

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  if (!API_READY) return [];
  const data = await api<Conversation[]>('/api/v1/messaging/conversations');
  return data ?? [];
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  await apiPost(`/api/v1/messaging/conversations/${conversationId}/read`, {});
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  if (!API_READY) return [];
  const data = await api<Message[]>(`/api/v1/messaging/conversations/${conversationId}/messages`);
  return data ?? [];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  mediaPath?: string,
  mediaType?: 'image' | 'video',
): Promise<{ error: string | null }> {
  const result = await apiPost<{ error: string | null }>(
    `/api/v1/messaging/conversations/${conversationId}/messages`,
    { content, mediaUrl: mediaPath, mediaType },
  );
  return result ?? { error: 'API unavailable' };
}

// Storage operations stay on Supabase
export async function uploadMessageMedia(
  conversationId: string,
  localUri: string,
  mimeType: string,
): Promise<{ path: string | null; error: string | null }> {
  if (!SUPABASE_READY) return { path: null, error: 'Storage not configured' };
  const ext = mimeType.includes('video') ? 'mp4' : 'jpg';
  const path = `${conversationId}/${Date.now()}.${ext}`;
  const response = await fetch(localUri);
  const blob = await response.blob();
  const { error } = await supabase.storage
    .from('message-media')
    .upload(path, blob, { contentType: mimeType });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

export async function getMessageMediaUrl(path: string): Promise<string | null> {
  if (!SUPABASE_READY) return null;
  const { data } = await supabase.storage
    .from('message-media')
    .createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function markMediaViewed(messageId: string): Promise<void> {
  // TODO: Route through API when message media tracking moves to AWS
}

// ── Verification (stays on Supabase — edge functions + storage) ───────────────

export async function fetchMyVerificationRequest(userId: string): Promise<VerificationRequest | null> {
  if (!SUPABASE_READY) return null;
  const { data } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

export async function submitVerificationPhoto(
  userId: string,
  localUri: string,
  reportedSize: number,
): Promise<{ imagePath: string | null; error: string | null }> {
  if (!SUPABASE_READY) return { imagePath: null, error: 'Storage not configured' };
  const timestamp = Date.now();
  const ext = localUri.split('.').pop() ?? 'jpg';
  const imagePath = `${userId}/${timestamp}.${ext}`;
  const response = await fetch(localUri);
  const blob = await response.blob();
  const { error } = await supabase.storage
    .from('verifications')
    .upload(imagePath, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
  if (error) return { imagePath: null, error: error.message };
  return { imagePath, error: null };
}

export async function runVerification(
  imagePath: string,
  reportedSize: number,
  reportedGirth?: number | null,
): Promise<{ status: 'auto_verified' | 'pending'; reason?: string; error?: string }> {
  if (!SUPABASE_READY) return { status: 'pending', reason: 'demo_mode' };
  const { data, error } = await supabase.functions.invoke('verify-size', {
    body: { imagePath, reportedSize, reportedGirth: reportedGirth ?? null },
  });
  if (error) return { status: 'pending', error: error.message };
  return data;
}

export async function fetchPendingVerifications(): Promise<VerificationRequest[]> {
  if (!SUPABASE_READY) return [];
  const { data } = await supabase
    .from('verification_requests')
    .select('*, profile:profiles(username, size_inches)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return (data ?? []) as unknown as VerificationRequest[];
}

export async function getVerificationSignedUrl(imagePath: string): Promise<string | null> {
  if (!SUPABASE_READY) return null;
  const { data } = await supabase.storage
    .from('verifications')
    .createSignedUrl(imagePath, 120);
  return data?.signedUrl ?? null;
}

export async function adminReviewVerification(
  requestId: string,
  action: 'approve' | 'reject',
): Promise<{ error: string | null }> {
  if (!SUPABASE_READY) return { error: 'Not configured' };
  const { error } = await supabase.functions.invoke('admin-review', {
    body: { requestId, action },
  });
  return { error: error?.message ?? null };
}

// ── Friends / Follows ─────────────────────────────────────────────────────────

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return;
  await apiPost(`/api/v1/users/${followingId}/follow`, {});
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (!API_READY) return false;
  const data = await api<{ following: boolean }>(`/api/v1/users/${followingId}/is-following`);
  return data?.following ?? false;
}

export async function getOrCreateConversation(
  myId: string,
  otherId: string,
): Promise<{ id: string | null; error: string | null }> {
  const result = await apiPost<{ id: string | null; error: string | null }>(
    '/api/v1/messaging/conversations',
    { otherId },
  );
  return result ?? { id: null, error: 'API unavailable' };
}

// ── Group Chats (new) ─────────────────────────────────────────────────────────

export async function fetchGroups(): Promise<any[]> {
  const data = await api<any[]>('/api/v1/messaging/groups');
  return data ?? [];
}

export async function createGroup(
  name: string,
  description: string,
  isPrivate?: boolean,
  memberIds?: string[],
): Promise<{ id: string; error: string | null }> {
  const result = await apiPost<{ id: string; error: string | null }>('/api/v1/messaging/groups', {
    name, description, isPrivate, memberIds,
  });
  return result ?? { id: '', error: 'API unavailable' };
}

export async function fetchGroupMessages(groupId: string): Promise<any[]> {
  const data = await api<any[]>(`/api/v1/messaging/groups/${groupId}/messages`);
  return data ?? [];
}

export async function sendGroupMessage(
  groupId: string,
  content: string,
  mediaUrl?: string,
  mediaType?: 'image' | 'video',
): Promise<{ error: string | null }> {
  const result = await apiPost<{ error: string | null }>(
    `/api/v1/messaging/groups/${groupId}/messages`,
    { content, mediaUrl, mediaType },
  );
  return result ?? { error: 'API unavailable' };
}

export async function fetchGroupMembers(groupId: string): Promise<any[]> {
  const data = await api<any[]>(`/api/v1/messaging/groups/${groupId}/members`);
  return data ?? [];
}

export async function addGroupMember(groupId: string, userId: string): Promise<{ error: string | null }> {
  const result = await apiPost<{ error: string | null }>(`/api/v1/messaging/groups/${groupId}/members`, { userId });
  return result ?? { error: 'API unavailable' };
}

export async function removeGroupMember(groupId: string, userId: string): Promise<{ error: string | null }> {
  const result = await apiDelete<{ error: string | null }>(`/api/v1/messaging/groups/${groupId}/members/${userId}`);
  return result ?? { error: 'API unavailable' };
}

// ── Communities (new) ─────────────────────────────────────────────────────────

export async function fetchCommunities(): Promise<any[]> {
  const data = await api<any[]>('/api/v1/communities');
  return data ?? [];
}

export async function fetchMyCommunities(): Promise<any[]> {
  const data = await api<any[]>('/api/v1/communities/my');
  return data ?? [];
}

export async function fetchCommunity(communityId: string): Promise<any | null> {
  return api(`/api/v1/communities/${communityId}`);
}

export async function fetchCommunityBySlug(slug: string): Promise<any | null> {
  return api(`/api/v1/communities/slug/${slug}`);
}

export async function createCommunity(
  name: string,
  description: string,
  opts?: { isPrivate?: boolean; slug?: string; tags?: string[]; rules?: string[]; minTier?: number; minSize?: number },
): Promise<{ id: string; error: string | null }> {
  const result = await apiPost<{ id: string; error: string | null }>('/api/v1/communities', {
    name, description, ...opts,
  });
  return result ?? { id: '', error: 'API unavailable' };
}

export async function joinCommunity(communityId: string): Promise<{ error: string | null }> {
  const result = await apiPost<{ error: string | null }>(`/api/v1/communities/${communityId}/join`, {});
  return result ?? { error: 'API unavailable' };
}

export async function leaveCommunity(communityId: string): Promise<void> {
  await apiPost(`/api/v1/communities/${communityId}/leave`, {});
}

export async function fetchCommunityPosts(communityId: string): Promise<any[]> {
  const data = await api<any[]>(`/api/v1/communities/${communityId}/posts`);
  return data ?? [];
}

export async function createCommunityPost(
  communityId: string,
  title: string,
  content: string,
  mediaUrl?: string,
  tag?: string,
): Promise<{ id: string; error: string | null }> {
  const result = await apiPost<{ id: string; error: string | null }>(`/api/v1/communities/${communityId}/posts`, {
    title, content, mediaUrl, tag,
  });
  return result ?? { id: '', error: 'API unavailable' };
}

export async function fetchCommunityMembers(communityId: string): Promise<any[]> {
  const data = await api<any[]>(`/api/v1/communities/${communityId}/members`);
  return data ?? [];
}
