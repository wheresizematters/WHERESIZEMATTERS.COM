import { supabase, SUPABASE_READY } from './supabase';
import { MOCK_POSTS, MOCK_LEADERBOARD } from './mockData';
import { Post, LeaderboardEntry, Conversation, Message, VerificationRequest } from './types';

// ── Feed ──────────────────────────────────────────────────────────────────────

export async function fetchPosts(): Promise<Post[]> {
  if (!SUPABASE_READY) return MOCK_POSTS;

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, type, title, content, tag, comment_count, created_at,
      author:profiles(id, username, size_inches, is_verified),
      poll_options(id, text, vote_count)
    `)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !data) return MOCK_POSTS;
  return data as unknown as Post[];
}

export async function voteOnPoll(pollOptionId: string, userId: string): Promise<void> {
  if (!SUPABASE_READY) return;
  await supabase.from('votes').insert({ poll_option_id: pollOptionId, user_id: userId });
  await supabase.rpc('increment_vote_count', { option_id: pollOptionId });
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
  if (!SUPABASE_READY) {
    return MOCK_LEADERBOARD.filter(u =>
      u.username.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, username, size_inches, is_verified')
    .ilike('username', `%${query}%`)
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

export async function fetchUserRank(userId: string): Promise<number> {
  if (!SUPABASE_READY) return 247;

  const { data } = await supabase
    .from('leaderboard')
    .select('rank')
    .eq('id', userId)
    .single();

  return data?.rank ?? 0;
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

// ── Messaging ─────────────────────────────────────────────────────────────────

export async function fetchConversations(userId: string): Promise<Conversation[]> {
  if (!SUPABASE_READY) return [];

  const { data } = await supabase
    .from('conversations')
    .select(`
      id, user_1_id, user_2_id, last_message_at, last_message_preview,
      user1:profiles!conversations_user_1_id_fkey(id, username, size_inches, is_verified),
      user2:profiles!conversations_user_2_id_fkey(id, username, size_inches, is_verified)
    `)
    .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`)
    .order('last_message_at', { ascending: false });

  return (data ?? []) as unknown as Conversation[];
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  if (!SUPABASE_READY) return [];

  const { data } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(60);

  return data ?? [];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
): Promise<{ error: string | null }> {
  if (!SUPABASE_READY) return { error: 'Supabase not configured' };

  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content });

  return { error: error?.message ?? null };
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

// Always stores user_1_id < user_2_id to enforce uniqueness
export async function getOrCreateConversation(
  myId: string,
  otherId: string,
): Promise<string | null> {
  if (!SUPABASE_READY) return null;

  const [user_1_id, user_2_id] = myId < otherId ? [myId, otherId] : [otherId, myId];

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_1_id', user_1_id)
    .eq('user_2_id', user_2_id)
    .single();

  if (existing) return existing.id;

  const { data: created } = await supabase
    .from('conversations')
    .insert({ user_1_id, user_2_id })
    .select('id')
    .single();

  return created?.id ?? null;
}
