import { supabase, SUPABASE_READY } from './supabase';
import { MOCK_POSTS, MOCK_LEADERBOARD } from './mockData';
import { Post, LeaderboardEntry } from './types';

// ── Feed ──────────────────────────────────────────────────────────────────────

export async function fetchPosts(): Promise<Post[]> {
  if (!SUPABASE_READY) return MOCK_POSTS;

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, type, content, comment_count, created_at,
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
): Promise<{ error: string | null }> {
  if (!SUPABASE_READY) return { error: 'Supabase not configured' };

  const { data: post, error } = await supabase
    .from('posts')
    .insert({ user_id: userId, type, content, media_url: mediaUrl ?? null })
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
