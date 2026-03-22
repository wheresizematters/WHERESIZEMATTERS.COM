import { supabase, SUPABASE_READY } from './supabase';
import { MOCK_POSTS, MOCK_LEADERBOARD } from './mockData';
import { Post, LeaderboardEntry, Conversation, Message, VerificationRequest, Profile, Comment } from './types';

// ── Feed ──────────────────────────────────────────────────────────────────────

export async function fetchPosts(userId?: string): Promise<Post[]> {
  if (!SUPABASE_READY) return MOCK_POSTS;

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, type, title, content, tag, comment_count, score, created_at,
      author:profiles(id, username, size_inches, is_verified),
      poll_options(id, text, vote_count)
    `)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !data) return MOCK_POSTS;

  let posts = data as unknown as Post[];

  if (userId) {
    const { data: votes } = await supabase
      .from('post_votes')
      .select('post_id, vote')
      .eq('user_id', userId);
    if (votes) {
      const voteMap = new Map(votes.map(v => [v.post_id, v.vote as 1 | -1]));
      posts = posts.map(p => ({ ...p, user_vote: voteMap.get(p.id) ?? 0 }));
    }
  }

  return posts;
}

export async function voteOnPost(
  postId: string,
  userId: string,
  vote: 1 | -1 | 0,
): Promise<{ error: string | null }> {
  if (!SUPABASE_READY) return { error: null };
  const { error } = await supabase.rpc('vote_on_post', { p_post_id: postId, p_user_id: userId, p_vote: vote });
  return { error: error?.message ?? null };
}

export async function voteOnPoll(pollOptionId: string, userId: string): Promise<{ error: string | null }> {
  if (!SUPABASE_READY) return { error: null };
  // Prevent duplicate votes
  const { data: existing } = await supabase
    .from('votes')
    .select('id')
    .eq('poll_option_id', pollOptionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return { error: null }; // Already voted — idempotent
  const { error } = await supabase.from('votes').insert({ poll_option_id: pollOptionId, user_id: userId });
  if (error) return { error: error.message };
  await supabase.rpc('increment_vote_count', { option_id: pollOptionId });
  return { error: null };
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
  if (!SUPABASE_READY) return { error: 'Supabase not configured' };

  const { data: post, error } = await supabase
    .from('posts')
    .insert({ user_id: userId, type, title: title ?? null, content, media_url: mediaUrl ?? null, tag: tag ?? null })
    .select()
    .single();

  if (error) return { error: error.message };

  if (type === 'poll' && pollOptions?.length) {
    const options = pollOptions.map(text => ({ post_id: post.id, text }));
    const { error: optErr } = await supabase.from('poll_options').insert(options);
    if (optErr) return { error: optErr.message };
  }

  return { error: null };
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function fetchLeaderboard(filter?: {
  country?: string;
  ageRange?: string;
}): Promise<LeaderboardEntry[]> {
  if (!SUPABASE_READY) return MOCK_LEADERBOARD;

  let query = supabase
    .from('leaderboard')
    .select('rank, id, username, size_inches, is_verified, country, age_range')
    .limit(100);

  if (filter?.country) query = query.eq('country', filter.country);
  if (filter?.ageRange) query = query.eq('age_range', filter.ageRange);

  const { data, error } = await query;
  if (error || !data) return MOCK_LEADERBOARD;
  return data as LeaderboardEntry[];
}

// ── Compare ───────────────────────────────────────────────────────────────────

export async function searchUsers(query: string) {
  // Require at least 2 chars to limit enumeration exposure
  if (query.trim().length < 2) return [];

  if (!SUPABASE_READY) {
    return MOCK_LEADERBOARD.filter(u =>
      u.username.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, username, size_inches, is_verified')
    .ilike('username', `%${query.trim()}%`)
    .limit(5);

  return data ?? [];
}

export async function fetchUserPercentile(sizeInches: number): Promise<number> {
  if (!SUPABASE_READY) return 72;

  const { count: total } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  const { count: smaller } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .lt('size_inches', sizeInches);

  if (!total || smaller === null) return 0;
  return Math.round((smaller / total) * 100);
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function fetchPublicProfile(userId: string): Promise<Profile | null> {
  if (!SUPABASE_READY) {
    const mock = MOCK_LEADERBOARD.find(u => u.id === userId);
    if (!mock) return null;
    return { id: mock.id, username: mock.username, size_inches: mock.size_inches, is_verified: mock.is_verified, has_set_size: true, country: mock.country, created_at: new Date().toISOString() };
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, username, size_inches, is_verified, has_set_size, country, age_range, bio, created_at')
    .eq('id', userId)
    .single();

  return data ?? null;
}

export async function fetchUserRank(userId: string): Promise<number> {
  if (!SUPABASE_READY) return 247;

  const { data } = await supabase
    .from('leaderboard')
    .select('rank')
    .eq('id', userId)
    .single();

  return data?.rank ?? 0;
}

export async function fetchPost(postId: string): Promise<Post | null> {
  if (!SUPABASE_READY) return MOCK_POSTS.find(p => p.id === postId) ?? null;

  const { data } = await supabase
    .from('posts')
    .select(`
      id, type, title, content, tag, comment_count, score, created_at,
      author:profiles(id, username, size_inches, is_verified),
      poll_options(id, text, vote_count)
    `)
    .eq('id', postId)
    .single();

  return data as unknown as Post ?? null;
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  if (!SUPABASE_READY) return [];

  const { data } = await supabase
    .from('comments')
    .select(`
      id, post_id, user_id, content, created_at,
      author:profiles(id, username, size_inches, is_verified)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  return (data ?? []) as unknown as Comment[];
}

export async function createComment(
  postId: string,
  userId: string,
  content: string,
): Promise<{ error: string | null }> {
  if (!SUPABASE_READY) return { error: 'Supabase not configured' };

  const { error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: userId, content });

  return { error: error?.message ?? null };
}

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  if (!SUPABASE_READY) return MOCK_POSTS.filter(p => p.author.id === userId);

  const { data } = await supabase
    .from('posts')
    .select(`
      id, type, title, content, tag, comment_count, created_at,
      author:profiles(id, username, size_inches, is_verified),
      poll_options(id, text, vote_count)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  return (data ?? []) as unknown as Post[];
}

export async function fetchUserPostCount(userId: string): Promise<number> {
  if (!SUPABASE_READY) return 14;

  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return count ?? 0;
}

export async function fetchTotalUserCount(): Promise<number> {
  if (!SUPABASE_READY) return 12842;

  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  return count ?? 0;
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
  if (!SUPABASE_READY) return [];

  const { data } = await supabase
    .from('conversations')
    .select(`
      id, user_1_id, user_2_id, last_message_at, last_message_preview,
      user_1_last_read, user_2_last_read,
      user1:profiles!conversations_user_1_id_fkey(id, username, size_inches, is_verified),
      user2:profiles!conversations_user_2_id_fkey(id, username, size_inches, is_verified)
    `)
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false });

  return (data ?? []) as unknown as Conversation[];
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  if (!SUPABASE_READY) return;

  const { data: conv } = await supabase
    .from('conversations')
    .select('user_1_id')
    .eq('id', conversationId)
    .single();

  if (!conv) return;

  const field = conv.user_1_id === userId ? 'user_1_last_read' : 'user_2_last_read';
  await supabase
    .from('conversations')
    .update({ [field]: new Date().toISOString() })
    .eq('id', conversationId);
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  if (!SUPABASE_READY) return [];

  const { data } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, media_url, media_type, viewed_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(60);

  return data ?? [];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  mediaPath?: string,
  mediaType?: 'image' | 'video',
): Promise<{ error: string | null }> {
  if (!SUPABASE_READY) return { error: 'Supabase not configured' };

  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      media_url: mediaPath ?? null,
      media_type: mediaType ?? null,
    });

  return { error: error?.message ?? null };
}

export async function uploadMessageMedia(
  conversationId: string,
  localUri: string,
  mimeType: string,
): Promise<{ path: string | null; error: string | null }> {
  if (!SUPABASE_READY) return { path: null, error: 'Supabase not configured' };

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
    .createSignedUrl(path, 300); // 5-minute signed URL — hard to share/save

  return data?.signedUrl ?? null;
}

export async function markMediaViewed(messageId: string): Promise<void> {
  if (!SUPABASE_READY) return;

  await supabase
    .from('messages')
    .update({ viewed_at: new Date().toISOString() })
    .eq('id', messageId);
}

// ── Verification ──────────────────────────────────────────────────────────────

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
  if (!SUPABASE_READY) return { imagePath: null, error: 'Supabase not configured' };

  const timestamp = Date.now();
  const ext = localUri.split('.').pop() ?? 'jpg';
  const imagePath = `${userId}/${timestamp}.${ext}`;

  // Fetch the file as a blob
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
): Promise<{ status: 'auto_verified' | 'pending'; reason?: string; error?: string }> {
  if (!SUPABASE_READY) return { status: 'pending', reason: 'demo_mode' };

  const { data, error } = await supabase.functions.invoke('verify-size', {
    body: { imagePath, reportedSize },
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
  if (!SUPABASE_READY) return { error: 'Supabase not configured' };

  const { error } = await supabase.functions.invoke('admin-review', {
    body: { requestId, action },
  });

  return { error: error?.message ?? null };
}

// ── Friends / Follows ─────────────────────────────────────────────────────────

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (!SUPABASE_READY || followerId === followingId) return;
  // Mutual follow: both directions
  await supabase.from('follows').upsert([
    { follower_id: followerId, following_id: followingId },
    { follower_id: followingId, following_id: followerId },
  ]);
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (!SUPABASE_READY) return false;
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  return !!data;
}

// Always stores user_1_id < user_2_id to enforce uniqueness
export async function getOrCreateConversation(
  myId: string,
  otherId: string,
): Promise<{ id: string | null; error: string | null }> {
  if (!SUPABASE_READY) return { id: null, error: 'Supabase not configured' };

  const [user_1_id, user_2_id] = myId < otherId ? [myId, otherId] : [otherId, myId];

  // Use maybeSingle() to avoid throwing when 0 rows exist
  const { data: existing, error: selectErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_1_id', user_1_id)
    .eq('user_2_id', user_2_id)
    .maybeSingle();

  if (existing) return { id: existing.id, error: null };

  const { data: created, error: insertErr } = await supabase
    .from('conversations')
    .insert({ user_1_id, user_2_id })
    .select('id')
    .single();

  if (insertErr) return { id: null, error: insertErr.message };
  return { id: created?.id ?? null, error: null };
}
