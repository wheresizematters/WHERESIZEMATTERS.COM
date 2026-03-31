import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Linking, Image, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { fetchPost, fetchComments, createComment, voteOnPoll, voteOnPost, deletePost, deleteComment } from "@/lib/api";
import { useAuth } from '@/context/AuthContext';
import { usePurchase } from '@/context/PurchaseContext';
import { SUPABASE_READY } from '@/lib/supabase';
import { pickMedia, uploadMedia } from '@/lib/media';
import { Post, Comment } from '@/lib/types';
import LockedMedia from '@/components/LockedMedia';
import LinkPreview from '@/components/LinkPreview';
import UserAvatar from '@/components/UserAvatar';
import RichText from '@/components/RichText';

const HOLO_COLORS: [string, string, string, string] = ['#FF6B2B', '#E8500A', '#C9A84C', '#BF5AF2'];
const TAG_COLORS: Record<string, string> = { size: '#A78BFA', content: '#60A5FA', viral: '#F87171' };
const TAG_CATEGORIES: Record<string, string> = {
  Hung: 'size', Massive: 'size', 'Above Average': 'size', Average: 'size',
  Micro: 'size', Grower: 'size', Shower: 'size',
  OC: 'content', 'Rate Me': 'content', Comparison: 'content', Measurement: 'content',
  Progress: 'content', 'First Post': 'content', Soft: 'content', Hard: 'content', Bulge: 'content',
  'Guess My Size': 'viral', 'Be Honest': 'viral', 'Brutal Rating': 'viral',
  'Top %': 'viral', "Biggest You've Seen?": 'viral',
};

function timeAgo(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const URL_REGEX = /https?:\/\/[^\s]+/g;
function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

// Only open http/https URLs — prevents javascript: and other protocol attacks
function safeOpenURL(url: string) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;
  Linking.openURL(url);
}

function LinkedText({ text, style }: { text: string; style?: any }) {
  const parts: { text: string; isUrl: boolean }[] = [];
  let lastIndex = 0;
  const regex = new RegExp(URL_REGEX.source, 'g');
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), isUrl: false });
    parts.push({ text: match[0], isUrl: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), isUrl: false });
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.isUrl
          ? <Text key={i} style={styles.link} onPress={() => safeOpenURL(p.text)}>{p.text}</Text>
          : p.text
      )}
    </Text>
  );
}

// ── Post Detail ───────────────────────────────────────────────────────────────
function PostDetail({ post, myId, isPremium, onVotePost }: {
  post: Post; myId: string; isPremium: boolean; onVotePost: (v: 1 | -1 | 0) => void;
}) {
  const router = useRouter();
  const [voted, setVoted] = useState<string | null>(null);
  const [localOptions, setLocalOptions] = useState(post.poll_options ?? []);
  const tier = getSizeTier(post.author.size_inches);
  const isOwner = post.author.id === myId;
  const tagColor = post.tag ? (TAG_COLORS[TAG_CATEGORIES[post.tag]] ?? COLORS.muted) : null;
  const linkUrl = post.type === 'discussion' ? extractFirstUrl(post.content) : null;
  const score = post.score ?? 0;
  const userVote = post.user_vote ?? 0;

  async function handleVote(optionId: string) {
    if (voted) return;
    setVoted(optionId);
    setLocalOptions(prev =>
      prev.map(o => o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o)
    );
    await voteOnPoll(optionId, myId);
  }

  const totalVotes = localOptions.reduce((sum, o) => sum + o.vote_count, 0);

  return (
    <View style={styles.postCard}>
      {/* Author row */}
      <TouchableOpacity
        style={styles.authorRow}
        onPress={() => router.push(`/profile/${post.author.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={[styles.authorAvatar, { borderColor: tier.color }]}>
          <Text style={[styles.authorAvatarText, { color: tier.color }]}>
            {post.author.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.authorMeta}>
          <Text style={styles.authorUsername}>@{post.author.username}</Text>
          {post.author.is_verified && (
            <LinearGradient colors={HOLO_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓</Text>
            </LinearGradient>
          )}
        </View>
        <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
        {isOwner && (
          <TouchableOpacity onPress={async () => { if (window.confirm("Delete this post?")) { await deletePost(post.id); window.alert("Post deleted."); router.push("/(tabs)" as any); } }} style={{ padding: 6 }}>
            <Ionicons name="trash-outline" size={16} color={COLORS.red} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Tag */}
      {post.tag && tagColor && (
        <View style={[styles.tagChip, { borderColor: tagColor, backgroundColor: `${tagColor}18` }]}>
          <Text style={[styles.tagChipText, { color: tagColor }]}>{post.tag}</Text>
        </View>
      )}

      {/* Title */}
      {post.title && <Text style={styles.postTitle}>{post.title}</Text>}

      {/* Content */}
      <LinkedText text={post.content} style={post.type === 'poll' ? styles.pollQuestion : styles.postBody} />

      {/* Poll options */}
      {post.type === 'poll' && (
        <View style={styles.pollOptions}>
          {localOptions.map(opt => {
            const pct = totalVotes > 0 ? (opt.vote_count / totalVotes) * 100 : 0;
            const isVoted = voted === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={styles.pollOption}
                onPress={() => handleVote(opt.id)}
                activeOpacity={0.8}
              >
                {voted && (
                  <View style={[styles.pollBar, { width: `${pct}%` as any, backgroundColor: isVoted ? COLORS.gold : COLORS.mutedDark }]} />
                )}
                <View style={styles.pollOptionInner}>
                  <Text style={[styles.pollOptionText, isVoted && styles.pollOptionVoted]}>{opt.text}</Text>
                  {voted && <Text style={[styles.pollPct, isVoted && styles.pollPctVoted]}>{pct.toFixed(0)}%</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          {voted && (
            <Text style={styles.pollTotal}>{totalVotes.toLocaleString()} votes</Text>
          )}
        </View>
      )}

      {/* Link preview */}
      {linkUrl && <LinkPreview url={linkUrl} />}

      {/* Media */}
      {(post as any).media_url && (
        <LockedMedia
          uri={(post as any).media_url}
          type={(post as any).media_type ?? 'image'}
          isPremium={isPremium}
          isOwner={isOwner}
        />
      )}

      {/* Vote bar */}
      <View style={styles.voteBar}>
        <TouchableOpacity
          style={styles.voteBtnLg}
          onPress={() => onVotePost(userVote === 1 ? 0 : 1)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        >
          <Ionicons name="arrow-up" size={22} color={userVote === 1 ? COLORS.gold : COLORS.muted} />
        </TouchableOpacity>
        <Text style={[styles.voteScore, userVote === 1 && styles.voteScoreUp, userVote === -1 && styles.voteScoreDown]}>
          {score}
        </Text>
        <TouchableOpacity
          style={styles.voteBtnLg}
          onPress={() => onVotePost(userVote === -1 ? 0 : -1)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        >
          <Ionicons name="arrow-down" size={22} color={userVote === -1 ? COLORS.blue : COLORS.muted} />
        </TouchableOpacity>
        {post.type === 'poll' && totalVotes > 0 && (
          <Text style={styles.pollTotalInBar}>{totalVotes.toLocaleString()} poll votes</Text>
        )}
      </View>
    </View>
  );
}

// ── Comment Row ───────────────────────────────────────────────────────────────
function CommentRow({ comment, myId, onDelete }: { comment: Comment; myId: string; onDelete?: (commentId: string) => void }) {
  const router = useRouter();
  const tier = getSizeTier(comment.author.size_inches);
  const [score, setScore] = useState(comment.score ?? 0);
  const [userVote, setUserVote] = useState<0 | 1 | -1>(comment.user_vote ?? 0);
  const linkUrl = extractFirstUrl(comment.content);
  const isOwner = comment.author.id === myId;

  function handleVote(vote: 1 | -1 | 0) {
    const delta = vote - userVote;
    setScore((s: number) => s + delta);
    setUserVote(vote as 0 | 1 | -1);
    // TODO: wire up comment vote API when backend supports it
  }

  return (
    <View style={styles.commentRow}>
      {/* Vote column */}
      <View style={styles.commentVoteCol}>
        <TouchableOpacity onPress={() => handleVote(userVote === 1 ? 0 : 1)} hitSlop={{ top: 6, bottom: 4, left: 6, right: 6 }}>
          <Ionicons name="arrow-up" size={16} color={userVote === 1 ? COLORS.gold : COLORS.mutedDark} />
        </TouchableOpacity>
        <Text style={[styles.commentVoteScore, userVote === 1 && { color: COLORS.gold }, userVote === -1 && { color: '#60A5FA' }]}>
          {score}
        </Text>
        <TouchableOpacity onPress={() => handleVote(userVote === -1 ? 0 : -1)} hitSlop={{ top: 4, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="arrow-down" size={16} color={userVote === -1 ? '#60A5FA' : COLORS.mutedDark} />
        </TouchableOpacity>
      </View>

      {/* Avatar */}
      <TouchableOpacity onPress={() => router.push(`/profile/${comment.author.id}` as any)} activeOpacity={0.7}>
        <View style={[styles.commentAvatar, { borderColor: tier.color }]}>
          <Text style={[styles.commentAvatarText, { color: tier.color }]}>
            {comment.author.username.charAt(0).toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Body */}
      <View style={styles.commentBody}>
        <View style={styles.commentHeader}>
          <TouchableOpacity onPress={() => router.push(`/profile/${comment.author.id}` as any)} activeOpacity={0.7}>
            <Text style={styles.commentUsername}>@{comment.author.username}</Text>
          </TouchableOpacity>
          {comment.author.is_verified && (
            <View style={styles.commentVerifiedDot}>
              <Text style={styles.commentVerifiedText}>✓</Text>
            </View>
          )}
          <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
          {isOwner && onDelete && (
            <TouchableOpacity onPress={() => { if (window.confirm('Delete this comment?')) onDelete(comment.id); }} style={{ marginLeft: 4, padding: 4 }}>
              <Ionicons name="trash-outline" size={14} color={COLORS.red} />
            </TouchableOpacity>
          )}
        </View>
        <LinkedText text={comment.content} style={styles.commentContent} />
        {/* Link preview */}
        {linkUrl && <LinkPreview url={linkUrl} />}
        {/* Comment media */}
        {comment.media_url && (
          <Image
            source={{ uri: comment.media_url }}
            style={styles.commentMedia}
            resizeMode="cover"
          />
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PostScreen() {
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = usePurchase();
  const myId = session?.user.id ?? '';

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentMedia, setCommentMedia] = useState<any | null>(null);
  const inputRef = useRef<TextInput>(null);

  async function handleVoteOnPost(vote: 1 | -1 | 0) {
    if (!session || !post) return;
    const prevVote = post.user_vote ?? 0;
    const scoreDelta = vote - prevVote;
    setPost(p => p ? { ...p, score: (p.score ?? 0) + scoreDelta, user_vote: vote } : p);
    await voteOnPost(post.id, session.user.id, vote);
  }

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([fetchPost(postId), fetchComments(postId)]);
    setPost(p);
    setComments(c);
    setLoading(false);
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  // Realtime for new comments
  useEffect(() => {
    if (!SUPABASE_READY) return;
  }, [postId]);

  async function handlePickCommentMedia() {
    const asset = await pickMedia();
    if (asset) setCommentMedia(asset);
  }

  async function handleSubmit() {
    const content = text.trim();
    if ((!content && !commentMedia) || submitting || !session) return;
    setSubmitting(true);
    setText('');

    let mediaUrl: string | undefined;
    if (commentMedia) {
      const commentId = Date.now().toString();
      const url = await uploadMedia(session.user.id, `comment-${commentId}`, commentMedia.uri, commentMedia.mimeType ?? 'image/jpeg');
      if (url) mediaUrl = url;
    }

    const { error } = await createComment(postId, myId, content || '', mediaUrl);
    setSubmitting(false);
    setCommentMedia(null);
    if (error) {
      setText(content);
      window.alert(`Failed to post comment: ${error}`);
    } else {
      // Optimistically add comment to list
      const newComment: Comment = {
        id: Date.now().toString(),
        post_id: postId,
        user_id: myId,
        content: content || '',
        author: {
          id: myId,
          username: (session.user as any).user_metadata?.username ?? (session.user as any).username ?? 'you',
          size_inches: 0,
          is_verified: false,
        },
        created_at: new Date().toISOString(),
        ...(mediaUrl ? { media_url: mediaUrl } : {}),
      } as any;
      setComments(prev => [...prev, newComment]);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); } else { router.push('/(tabs)' as any); } }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {post ? (post.type === 'poll' ? 'Poll' : post.title ?? 'Discussion') : ''}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              post ? (
                <>
                  <PostDetail post={post} myId={myId} isPremium={isPremium} onVotePost={handleVoteOnPost} />
                  <View style={styles.commentsDivider}>
                    <Text style={styles.commentsLabel}>
                      {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
                    </Text>
                  </View>
                </>
              ) : null
            }
            renderItem={({ item }) => <CommentRow comment={item} myId={myId} onDelete={async (commentId) => { await deleteComment(postId, commentId); setComments(prev => prev.filter(c => c.id !== commentId)); }} />}
            ItemSeparatorComponent={() => <View style={styles.commentSep} />}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyComments}>
                  <Ionicons name="chatbubble-outline" size={32} color={COLORS.muted} />
                  <Text style={styles.emptyText}>No comments yet. Be the first.</Text>
                </View>
              ) : null
            }
          />
        )}

        {/* Comment input */}
        {session && (
          <View>
            {/* Media preview */}
            {commentMedia && (
              <View style={styles.commentMediaPreview}>
                <Image source={{ uri: commentMedia.uri }} style={styles.commentMediaThumb} resizeMode="cover" />
                <TouchableOpacity style={styles.commentMediaRemove} onPress={() => setCommentMedia(null)}>
                  <Ionicons name="close-circle" size={20} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputBar}>
              <TouchableOpacity onPress={handlePickCommentMedia} style={styles.mediaBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}>
                <Ionicons name="image-outline" size={20} color={commentMedia ? COLORS.gold : COLORS.muted} />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Add a comment..."
                placeholderTextColor={COLORS.muted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() && !commentMedia || submitting) && styles.sendBtnDisabled]}
                onPress={handleSubmit}
                disabled={(!text.trim() && !commentMedia) || submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color={COLORS.bg} />
                  : <Ionicons name="arrow-up" size={18} color={COLORS.bg} />
                }
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, color: COLORS.white, fontWeight: '800', fontSize: SIZES.md, textAlign: 'center', numberOfLines: 1 } as any,
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 100 },

  // Post card
  postCard: { padding: 16, borderBottomWidth: 6, borderBottomColor: '#111' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  authorAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  authorAvatarText: { fontSize: SIZES.md, fontWeight: '800' },
  authorMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorUsername: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  verifiedBadge: { borderRadius: RADIUS.full, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: COLORS.bg, fontSize: 9, fontWeight: '900' },
  postTime: { color: COLORS.muted, fontSize: SIZES.xs },
  tagChip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1, marginBottom: 8 },
  tagChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  postTitle: { color: COLORS.white, fontSize: SIZES.xl, fontWeight: '900', lineHeight: 28, marginBottom: 8 },
  postBody: { color: COLORS.offWhite, fontSize: SIZES.base, lineHeight: 24, marginBottom: 4 },
  link: { color: '#60A5FA', textDecorationLine: 'underline' },

  // Poll
  pollQuestion: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '700', lineHeight: 24, marginBottom: 14 },
  pollOptions: { gap: 10, marginBottom: 8 },
  pollOption: { borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: `${COLORS.mutedDark}60`, overflow: 'hidden', minHeight: 48, justifyContent: 'center' },
  pollBar: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  pollOptionInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  pollOptionText: { color: COLORS.offWhite, fontSize: SIZES.md, fontWeight: '500' },
  pollOptionVoted: { color: COLORS.white, fontWeight: '700' },
  pollPct: { color: COLORS.muted, fontWeight: '600', fontSize: SIZES.sm },
  pollPctVoted: { color: COLORS.gold, fontWeight: '800' },
  pollTotal: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 4 },

  // Vote bar
  voteBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, marginTop: 8 },
  voteBtnLg: { padding: 4 },
  voteScore: { color: COLORS.muted, fontSize: SIZES.lg, fontWeight: '900', minWidth: 28, textAlign: 'center' },
  voteScoreUp: { color: COLORS.gold },
  voteScoreDown: { color: COLORS.blue },
  pollTotalInBar: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '600', marginLeft: 8 },

  // Comments section
  commentsDivider: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  commentsLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  commentSep: { height: 1, backgroundColor: COLORS.cardBorder, marginLeft: 64 },
  emptyComments: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyText: { color: COLORS.muted, fontSize: SIZES.md },

  // Comment row
  commentRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  commentVoteCol: { alignItems: 'center', gap: 1, width: 24, paddingTop: 2 },
  commentVoteScore: { color: COLORS.muted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  commentAvatarText: { fontSize: SIZES.sm, fontWeight: '800' },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  commentUsername: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.sm },
  commentVerifiedDot: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  commentVerifiedText: { color: COLORS.bg, fontSize: 8, fontWeight: '900' },
  commentTime: { color: COLORS.muted, fontSize: SIZES.xs, marginLeft: 'auto' },
  commentContent: { color: COLORS.offWhite, fontSize: SIZES.md, lineHeight: 20 },
  commentMedia: { width: '100%', height: 180, borderRadius: RADIUS.md, marginTop: 8, backgroundColor: COLORS.card },

  // Input bar
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, gap: 8 },
  mediaBtn: { paddingBottom: Platform.OS === 'ios' ? 8 : 6 },
  input: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8, color: COLORS.white, fontSize: SIZES.md, maxHeight: 100 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  commentMediaPreview: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  commentMediaThumb: { width: 60, height: 60, borderRadius: RADIUS.sm, backgroundColor: COLORS.card },
  commentMediaRemove: { marginLeft: 8 },
});
