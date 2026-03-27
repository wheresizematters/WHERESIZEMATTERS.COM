import { v4 as uuid } from "uuid";
import { T, getItem, putItem, updateItem, deleteItem, queryItems, scanAll } from "../db";
import { getProfile, awardCoins } from "./profiles";

export interface Post {
  id: string;
  user_id: string;
  type: "discussion" | "poll";
  title?: string | null;
  content: string;
  tag?: string | null;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
  comment_count: number;
  score: number;
  created_at: string;
}

export interface PollOption {
  id: string;
  post_id: string;
  text: string;
  vote_count: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

// ── Posts ───────────────────────────────────────────────────────────

export async function getPosts(userId?: string, limit = 30): Promise<any[]> {
  // Get all posts sorted by score desc, then created_at desc
  let posts = await scanAll<Post>(T.posts);
  posts.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  posts = posts.slice(0, limit);

  // Hydrate with author + poll options
  const hydrated = await Promise.all(
    posts.map(async (p) => {
      const author = await getProfile(p.user_id);
      const pollOptions = p.type === "poll"
        ? await queryItems<PollOption>(T.poll_options, "post_id = :pid", { ":pid": p.id })
        : [];

      let user_vote = 0;
      if (userId) {
        const vote = await getItem<{ vote: number }>(T.post_votes, { post_id: p.id, user_id: userId });
        if (vote) user_vote = vote.vote;
      }

      return {
        ...p,
        author: author ? {
          id: author.id,
          username: author.username,
          size_inches: author.size_inches,
          is_verified: author.is_verified,
        } : { id: p.user_id, username: "Unknown", size_inches: 0, is_verified: false },
        poll_options: pollOptions,
        user_vote,
      };
    })
  );

  return hydrated;
}

export async function getPost(postId: string): Promise<any | null> {
  const post = await getItem<Post>(T.posts, { id: postId });
  if (!post) return null;
  const author = await getProfile(post.user_id);
  const pollOptions = post.type === "poll"
    ? await queryItems<PollOption>(T.poll_options, "post_id = :pid", { ":pid": postId })
    : [];

  return {
    ...post,
    author: author ? {
      id: author.id, username: author.username,
      size_inches: author.size_inches, is_verified: author.is_verified,
    } : null,
    poll_options: pollOptions,
  };
}

export async function createPost(
  userId: string,
  type: "discussion" | "poll",
  content: string,
  pollOptions?: string[],
  mediaUrl?: string,
  tag?: string,
  title?: string,
): Promise<{ id: string; error: string | null }> {
  const id = uuid();
  const now = new Date().toISOString();

  await putItem(T.posts, {
    id,
    user_id: userId,
    type,
    title: title ?? null,
    content,
    tag: tag ?? null,
    media_url: mediaUrl ?? null,
    media_type: mediaUrl ? (mediaUrl.includes("mp4") ? "video" : "image") : null,
    comment_count: 0,
    score: 0,
    created_at: now,
  });

  if (type === "poll" && pollOptions?.length) {
    for (const text of pollOptions) {
      await putItem(T.poll_options, {
        id: uuid(),
        post_id: id,
        text,
        vote_count: 0,
      });
    }
  }

  // Award daily post coins (fire and forget)
  maybeAwardPostCoins(userId).catch(() => {});

  return { id, error: null };
}

export async function deletePost(postId: string, userId: string): Promise<{ error: string | null }> {
  const post = await getItem<Post>(T.posts, { id: postId });
  if (!post || post.user_id !== userId) return { error: "Not authorized" };
  await deleteItem(T.posts, { id: postId });
  return { error: null };
}

export async function getUserPosts(userId: string): Promise<any[]> {
  const posts = await queryItems<Post>(
    T.posts,
    "user_id = :uid",
    { ":uid": userId },
    { indexName: "user-posts-index", limit: 50 },
  );
  // Hydrate author
  const author = await getProfile(userId);
  return posts.map((p) => ({
    ...p,
    author: author ? {
      id: author.id, username: author.username,
      size_inches: author.size_inches, is_verified: author.is_verified,
    } : null,
    poll_options: [],
  }));
}

export async function getUserPostCount(userId: string): Promise<number> {
  const posts = await queryItems<Post>(
    T.posts,
    "user_id = :uid",
    { ":uid": userId },
    { indexName: "user-posts-index" },
  );
  return posts.length;
}

// ── Voting ─────────────────────────────────────────────────────────

export async function voteOnPost(
  postId: string,
  userId: string,
  vote: 1 | -1 | 0,
): Promise<{ error: string | null }> {
  const existing = await getItem<{ vote: number }>(T.post_votes, { post_id: postId, user_id: userId });
  const oldVote = existing?.vote ?? 0;
  const scoreDelta = vote - oldVote;

  if (vote === 0) {
    await deleteItem(T.post_votes, { post_id: postId, user_id: userId });
  } else {
    await putItem(T.post_votes, { post_id: postId, user_id: userId, vote });
  }

  // Update post score
  const post = await getItem<Post>(T.posts, { id: postId });
  if (post) {
    await updateItem(T.posts, { id: postId }, { score: post.score + scoreDelta });

    // Award upvote coins to post author
    if (vote === 1 && oldVote !== 1 && post.user_id !== userId) {
      awardCoins(post.user_id, 1500).catch(() => {});
    }
  }

  return { error: null };
}

export async function voteOnPoll(
  pollOptionId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const key = { poll_option_id: pollOptionId, user_id: userId };
  const existing = await getItem(T.votes, key);
  if (existing) return { error: null }; // idempotent

  await putItem(T.votes, { ...key, id: uuid(), created_at: new Date().toISOString() });

  // Increment vote count
  const option = await getItem<PollOption>(T.poll_options, { id: pollOptionId });
  if (option) {
    await updateItem(T.poll_options, { id: pollOptionId }, {
      vote_count: (option.vote_count ?? 0) + 1,
    });
  }

  return { error: null };
}

// ── Comments ───────────────────────────────────────────────────────

export async function getComments(postId: string): Promise<any[]> {
  const comments = await queryItems<Comment>(
    T.comments,
    "post_id = :pid",
    { ":pid": postId },
    { scanForward: true },
  );

  return Promise.all(
    comments.map(async (c) => {
      const author = await getProfile(c.user_id);
      return {
        ...c,
        author: author ? {
          id: author.id, username: author.username,
          size_inches: author.size_inches, is_verified: author.is_verified,
        } : null,
      };
    })
  );
}

export async function createComment(
  postId: string,
  userId: string,
  content: string,
  mediaUrl?: string,
): Promise<{ error: string | null }> {
  const item: any = {
    id: uuid(),
    post_id: postId,
    user_id: userId,
    content,
    created_at: new Date().toISOString(),
  };
  if (mediaUrl) item.media_url = mediaUrl;
  await putItem(T.comments, item);

  // Increment comment count
  const post = await getItem<Post>(T.posts, { id: postId });
  if (post) {
    await updateItem(T.posts, { id: postId }, {
      comment_count: (post.comment_count ?? 0) + 1,
    });
  }

  return { error: null };
}

export async function deleteComment(commentId: string, userId: string): Promise<{ error: string | null }> {
  const comment = await getItem(T.comments, { id: commentId });
  if (!comment) return { error: "Comment not found" };
  if (comment.user_id !== userId) return { error: "Not authorized" };

  await deleteItem(T.comments, { id: commentId });

  // Decrement comment count on parent post
  const post = await getItem(T.posts, { id: comment.post_id });
  if (post) {
    await updateItem(T.posts, { id: comment.post_id }, {
      comment_count: Math.max(0, (post.comment_count ?? 1) - 1),
    });
  }

  return { error: null };
}

// ── Coins helper ───────────────────────────────────────────────────

async function maybeAwardPostCoins(userId: string): Promise<void> {
  const profile = await getProfile(userId);
  if (!profile) return;
  const last = profile.last_post_coin_at;
  const today = new Date().toDateString();
  if (last && new Date(last).toDateString() === today) return;
  await updateItem(T.profiles, { id: userId }, { last_post_coin_at: new Date().toISOString() });
  await awardCoins(userId, 1000);
}
