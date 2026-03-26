import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Modal,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Image, Alert, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import PageContainer from '@/components/PageContainer';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { fetchPosts, createPost, voteOnPoll, voteOnPost } from '@/lib/api';
import { SUPABASE_READY, getToken } from '@/lib/supabase';
import { pickMedia, uploadMedia } from '@/lib/media';
import { useAuth } from '@/context/AuthContext';
import { usePurchase } from '@/context/PurchaseContext';
import { Post } from '@/lib/types';
import LockedMedia from '@/components/LockedMedia';
import LinkPreview from '@/components/LinkPreview';
import PaywallModal from '@/components/PaywallModal';
import UserAvatar from '@/components/UserAvatar';
import RichText from '@/components/RichText';

const FEED_TABS = ['FEED', 'DISCUSSIONS', 'MEDIA'] as const;
type FeedTab = typeof FEED_TABS[number];

const TAGS: { label: string; category: 'size' | 'content' | 'viral' }[] = [
  // Size
  { label: 'Hung',             category: 'size' },
  { label: 'Massive',          category: 'size' },
  { label: 'Above Average',    category: 'size' },
  { label: 'Average',          category: 'size' },
  { label: 'Micro',            category: 'size' },
  { label: 'Grower',           category: 'size' },
  { label: 'Shower',           category: 'size' },
  // Content
  { label: 'OC',               category: 'content' },
  { label: 'Rate Me',          category: 'content' },
  { label: 'Comparison',       category: 'content' },
  { label: 'Measurement',      category: 'content' },
  { label: 'Progress',         category: 'content' },
  { label: 'First Post',       category: 'content' },
  { label: 'Soft',             category: 'content' },
  { label: 'Hard',             category: 'content' },
  { label: 'Bulge',            category: 'content' },
  // Viral
  { label: 'Guess My Size',    category: 'viral' },
  { label: 'Be Honest',        category: 'viral' },
  { label: 'Brutal Rating',    category: 'viral' },
  { label: 'Top %',            category: 'viral' },
  { label: "Biggest You've Seen?", category: 'viral' },
];

const TAG_COLORS: Record<string, string> = {
  size:    '#A78BFA', // purple
  content: '#60A5FA', // blue
  viral:   '#F87171', // red
};

function timeAgo(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function TagChip({ tag }: { tag: string }) {
  const meta = TAGS.find(t => t.label === tag);
  const color = meta ? TAG_COLORS[meta.category] : COLORS.muted;
  return (
    <View style={[styles.tagChip, { borderColor: color, backgroundColor: `${color}18` }]}>
      <Text style={[styles.tagChipText, { color }]}>{tag}</Text>
    </View>
  );
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

function SizeBadge({ inches, verified, isPremium }: { inches: number; verified: boolean; isPremium: boolean }) {
  if (isPremium) {
    return (
      <LinearGradient
        colors={['#FF6B2B', '#E8500A', '#C9A84C', '#BF5AF2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badge}
      >
        <Text style={styles.badgeText}>
          {`${inches.toFixed(1)}"`}{verified ? ' ✓' : ''}
        </Text>
      </LinearGradient>
    );
  }
  const tier = getSizeTier(inches);
  return (
    <View style={[styles.badgeMuted, { borderColor: tier.color }]}>
      <Text style={[styles.badgeText, { color: tier.color }]}>
        {tier.emoji}{verified ? ' ✓' : ''}
      </Text>
    </View>
  );
}

function AuthorRow({ post, isPremium }: { post: Post; isPremium: boolean }) {
  const router = useRouter();
  const tier = getSizeTier(post.author.size_inches);
  return (
    <TouchableOpacity
      style={styles.authorRow}
      onPress={() => router.push(`/profile/${post.author.id}` as any)}
      activeOpacity={0.7}
    >
      <UserAvatar
        username={post.author.username}
        avatarUrl={(post.author as any).avatar_url}
        sizeInches={post.author.size_inches}
        size={36}
        isVerified={post.author.is_verified}
        showVerified
      />
      <View style={styles.authorMeta}>
        <Text style={styles.authorUsername}>@{post.author.username}</Text>
        <SizeBadge inches={post.author.size_inches} verified={post.author.is_verified} isPremium={isPremium} />
      </View>
      <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
    </TouchableOpacity>
  );
}

function VoteBar({
  post, onVote, pollVoteCount,
}: { post: Post; onVote: (v: 1 | -1 | 0) => void; pollVoteCount?: number }) {
  const score = post.score ?? 0;
  const userVote = post.user_vote ?? 0;
  return (
    <View style={styles.actionBar}>
      <View style={styles.voteRow}>
        <TouchableOpacity
          onPress={() => onVote(userVote === 1 ? 0 : 1)}
          style={styles.voteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        >
          <Ionicons name="arrow-up" size={18} color={userVote === 1 ? COLORS.gold : COLORS.muted} />
        </TouchableOpacity>
        <Text style={[styles.voteScore, userVote === 1 && styles.voteScoreUp, userVote === -1 && styles.voteScoreDown]}>
          {score}
        </Text>
        <TouchableOpacity
          onPress={() => onVote(userVote === -1 ? 0 : -1)}
          style={styles.voteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        >
          <Ionicons name="arrow-down" size={18} color={userVote === -1 ? '#60A5FA' : COLORS.muted} />
        </TouchableOpacity>
      </View>
      {pollVoteCount !== undefined && (
        <View style={styles.actionItem}>
          <Ionicons name="stats-chart-outline" size={13} color={COLORS.muted} />
          <Text style={styles.actionText}>{pollVoteCount.toLocaleString()} votes</Text>
        </View>
      )}
      <View style={styles.actionItem}>
        <Ionicons name="chatbubble-outline" size={13} color={COLORS.muted} />
        <Text style={styles.actionText}>{post.comment_count} comments</Text>
      </View>
    </View>
  );
}

function PollCard({ post, userId, isPremium, onVotePost }: {
  post: Post; userId: string; isPremium: boolean; onVotePost: (v: 1 | -1 | 0) => void;
}) {
  const router = useRouter();
  const [voted, setVoted] = useState<string | null>(null);
  const options = post.poll_options ?? [];
  const totalVotes = options.reduce((sum, o) => sum + o.vote_count, 0);

  async function handleVote(optionId: string) {
    if (voted) return;
    setVoted(optionId);
    await voteOnPoll(optionId, userId);
  }

  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/post/${post.id}` as any)} activeOpacity={0.95}>
      <AuthorRow post={post} isPremium={isPremium} />
      {post.tag && <TagChip tag={post.tag} />}
      <LinkedText text={post.content} style={styles.pollQuestion} />
      <View style={styles.pollOptions}>
        {options.map(opt => {
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
                <View style={[
                  styles.pollBar,
                  { width: `${pct}%` as any, backgroundColor: isVoted ? COLORS.gold : COLORS.mutedDark }
                ]} />
              )}
              <View style={styles.pollOptionInner}>
                <Text style={[styles.pollOptionText, isVoted && styles.pollOptionVoted]}>{opt.text}</Text>
                {voted && <Text style={[styles.pollPct, isVoted && styles.pollPctVoted]}>{pct.toFixed(0)}%</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <VoteBar post={post} onVote={onVotePost} pollVoteCount={totalVotes} />
    </TouchableOpacity>
  );
}

function DiscussionCard({ post, isPremium, myId, onVotePost }: {
  post: Post; isPremium: boolean; myId: string; onVotePost: (v: 1 | -1 | 0) => void;
}) {
  const router = useRouter();
  const isOwner = post.author.id === myId;
  const linkUrl = extractFirstUrl(post.content);
  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/post/${post.id}` as any)} activeOpacity={0.95}>
      <AuthorRow post={post} isPremium={isPremium} />
      {post.tag && <TagChip tag={post.tag} />}
      {post.title && <Text style={styles.discussionTitle}>{post.title}</Text>}
      <LinkedText text={post.content} style={styles.discussionText} />
      {linkUrl && <LinkPreview url={linkUrl} />}
      {(post as any).media_url && (
        <LockedMedia
          uri={(post as any).media_url}
          type={(post as any).media_type ?? 'image'}
          isPremium={isPremium}
          isOwner={isOwner}
        />
      )}
      <VoteBar post={post} onVote={onVotePost} />
    </TouchableOpacity>
  );
}

function DiscussionRow({ post, isPremium }: { post: Post; isPremium: boolean }) {
  const router = useRouter();
  const meta = TAGS.find(t => t.label === post.tag);
  const tagColor = meta ? TAG_COLORS[meta.category] : COLORS.muted;
  const tier = getSizeTier(post.author.size_inches);

  return (
    <TouchableOpacity style={styles.discRow} onPress={() => router.push(`/post/${post.id}` as any)} activeOpacity={0.8}>
      <View style={styles.discRowTop}>
        {post.tag && (
          <View style={[styles.tagChip, { borderColor: tagColor, backgroundColor: `${tagColor}18` }]}>
            <Text style={[styles.tagChipText, { color: tagColor }]}>{post.tag}</Text>
          </View>
        )}
        <Text style={styles.discRowTime}>{timeAgo(post.created_at)}</Text>
      </View>
      {post.title
        ? <Text style={styles.discRowTitle}>{post.title}</Text>
        : <Text style={styles.discRowTitle} numberOfLines={2}>{post.content}</Text>
      }
      {post.title && (
        <Text style={styles.discRowPreview} numberOfLines={2}>{post.content}</Text>
      )}
      <View style={styles.discRowFooter}>
        <View style={[styles.discRowAvatar, { borderColor: tier.color }]}>
          <Text style={[styles.discRowAvatarLetter, { color: tier.color }]}>
            {post.author.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.discRowAuthor}>@{post.author.username}</Text>
        <View style={styles.discRowStats}>
          <Ionicons name="chatbubble-outline" size={12} color={COLORS.muted} />
          <Text style={styles.discRowStatText}>{post.comment_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DiscussionsList({ posts, isPremium }: { posts: Post[]; isPremium: boolean }) {
  const [search, setSearch] = useState('');
  const discussions = posts.filter(p => p.type === 'discussion');
  const filtered = search.trim()
    ? discussions.filter(p =>
        (p.title ?? p.content).toLowerCase().includes(search.toLowerCase()) ||
        (p.tag ?? '').toLowerCase().includes(search.toLowerCase()) ||
        p.author.username.toLowerCase().includes(search.toLowerCase())
      )
    : discussions;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search discussions..."
          placeholderTextColor={COLORS.muted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.discList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <DiscussionRow post={item} isPremium={isPremium} />}
        ItemSeparatorComponent={() => <View style={styles.discSep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{search ? 'No results.' : 'No discussions yet.'}</Text>
          </View>
        }
      />
    </View>
  );
}

function CreatePostModal({ visible, onClose, onPost, isPremium }: {
  visible: boolean; onClose: () => void; onPost: () => void; isPremium: boolean;
}) {
  const { session } = useAuth();
  const [type, setType] = useState<'post' | 'discussion' | 'poll'>('post');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '', '', '']);
  const [mediaAsset, setMediaAsset] = useState<any | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  function reset() {
    setTitle(''); setContent(''); setMediaAsset(null); setSelectedTag(null);
    setPollOptions(['', '', '', '']); setType('post');
  }

  async function handlePickMedia() {
    const asset = await pickMedia();
    if (asset) setMediaAsset(asset);
  }

  const canPost = type === 'poll'
    ? content.trim().length > 0
    : type === 'discussion'
      ? content.trim().length > 0 && title.trim().length > 0
      : content.trim().length > 0;

  async function handlePost() {
    if (!canPost || !session) return;
    setLoading(true);
    const postId = Date.now().toString();
    let mediaUrl: string | undefined;
    if (mediaAsset) {
      const url = await uploadMedia(session.user.id, postId, mediaAsset.uri, mediaAsset.mimeType ?? 'image/jpeg');
      if (url) { mediaUrl = url; } else { window.alert("Image upload failed. Post will be created without the image."); }
    }
    const dbType = type === 'poll' ? 'poll' : 'discussion';
    const opts = type === 'poll' ? pollOptions.filter(o => o.trim()) : undefined;
    const { error } = await createPost(
      session.user.id, dbType, content.trim(), opts, mediaUrl,
      selectedTag ?? undefined, type === 'discussion' ? title.trim() || undefined : undefined,
    );
    setLoading(false);
    if (error) {
      window.alert('Post failed: ' + error);
    } else {
      window.alert('Post created! Pull down to refresh.'); reset(); onPost(); onClose();
    }
  }

  const TYPE_OPTIONS = [
    { key: 'post',       icon: 'create-outline',      label: 'Post' },
    { key: 'discussion', icon: 'chatbubbles-outline',  label: 'Discussion' },
    { key: 'poll',       icon: 'stats-chart-outline',  label: 'Poll' },
  ] as const;

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 0, backgroundColor: COLORS.bg }} />
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {type === 'post' ? 'New Post' : type === 'discussion' ? 'New Discussion' : 'New Poll'}
            </Text>
            <TouchableOpacity onPress={handlePost} disabled={loading || !canPost}>
              {loading
                ? <ActivityIndicator size="small" color={COLORS.gold} />
                : (
                  <View style={[styles.modalPostBtn, !canPost && styles.modalPostBtnDisabled]}>
                    <Text style={styles.modalPostBtnText}>Post</Text>
                  </View>
                )
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Type selector */}
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeBtn, type === t.key && styles.typeBtnActive]}
                  onPress={() => setType(t.key)}
                >
                  <Ionicons name={t.icon} size={16} color={type === t.key ? COLORS.gold : COLORS.muted} />
                  <Text style={[styles.typeBtnText, type === t.key && styles.typeBtnTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Context hint */}
            <Text style={styles.typeHint}>
              {type === 'post'
                ? 'Posts go directly to the feed. Quick thoughts, pics, or updates.'
                : type === 'discussion'
                  ? 'Discussions are threaded topics others can reply inside.'
                  : 'Polls let the community vote on a question.'}
            </Text>

            {/* Tag picker */}
            <Text style={styles.fieldLabel}>TAG <Text style={styles.fieldLabelOptional}>(optional)</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagPickerRow}>
              {TAGS.map(t => {
                const color = TAG_COLORS[t.category];
                const active = selectedTag === t.label;
                return (
                  <TouchableOpacity
                    key={t.label}
                    style={[styles.tagPickerChip, { borderColor: color, backgroundColor: active ? `${color}30` : 'transparent' }]}
                    onPress={() => setSelectedTag(active ? null : t.label)}
                  >
                    <Text style={[styles.tagPickerChipText, { color: active ? color : COLORS.muted }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Title — only for discussions */}
            {type === 'discussion' && (
              <>
                <Text style={styles.fieldLabel}>TITLE <Text style={styles.fieldLabelRequired}>*</Text></Text>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Give your discussion a title..."
                  placeholderTextColor={COLORS.muted}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={100}
                  returnKeyType="next"
                />
              </>
            )}

            {/* Body */}
            <Text style={styles.fieldLabel}>
              {type === 'poll' ? 'QUESTION' : type === 'discussion' ? 'BODY' : 'WHAT\'S ON YOUR MIND'} <Text style={styles.fieldLabelRequired}>*</Text>
            </Text>
            <TextInput
              style={styles.contentInput}
              placeholder={type === 'poll' ? 'Ask a question...' : type === 'discussion' ? 'Start the conversation...' : "Share something with the community..."}
              placeholderTextColor={COLORS.muted}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={600}
            />
            <Text style={styles.charCount}>{content.length}/600</Text>

            {/* Poll options */}
            {type === 'poll' && (
              <View style={styles.pollInputs}>
                <Text style={styles.fieldLabel}>OPTIONS</Text>
                {pollOptions.map((opt, i) => (
                  <TextInput
                    key={i}
                    style={styles.pollInput}
                    placeholder={`Option ${i + 1}${i < 2 ? ' *' : ' (optional)'}`}
                    placeholderTextColor={COLORS.muted}
                    value={opt}
                    onChangeText={val => {
                      const next = [...pollOptions];
                      next[i] = val;
                      setPollOptions(next);
                    }}
                  />
                ))}
              </View>
            )}

            {/* Media picker */}
            <TouchableOpacity style={styles.mediaPickerBtn} onPress={handlePickMedia}>
              <Ionicons name="images-outline" size={20} color={COLORS.gold} />
              <Text style={[styles.mediaPickerText, styles.mediaPickerTextActive]}>
                Add Photo / Video
              </Text>
            </TouchableOpacity>

            {mediaAsset && (
              <View style={styles.mediaPreviewWrap}>
                <Image source={{ uri: mediaAsset.uri }} style={styles.mediaPreview} resizeMode="cover" />
                <TouchableOpacity style={styles.removeMedia} onPress={() => setMediaAsset(null)}>
                  <Ionicons name="close-circle" size={24} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        trigger="Subscribe to post photos and videos"
      />
    </>
  );
}

function PremiumNudgeBanner({ onDismiss, onUpgrade }: { onDismiss: () => void; onUpgrade: () => void }) {
  return (
    <View style={styles.nudgeBanner}>
      <LinearGradient
        colors={[`${COLORS.gold}22`, `${COLORS.gold}08`]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.nudgeBannerInner}
      >
        <View style={styles.nudgeBannerContent}>
          <Text style={styles.nudgeBannerTitle}>SIZE. Premium</Text>
          <Text style={styles.nudgeBannerSub}>See exact sizes, unlock photos & videos, get verified.</Text>
          <TouchableOpacity style={styles.nudgeUpgradeBtn} onPress={onUpgrade} activeOpacity={0.85}>
            <Text style={styles.nudgeUpgradeBtnText}>Upgrade</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.nudgeDismissBtn} onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color={COLORS.muted} />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const PULL_THRESHOLD = 72;

export default function FeedScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = usePurchase();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FeedTab>('FEED');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [dismissedNudge, setDismissedNudge] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [pullY, setPullY] = useState(0);
  const pullState = useRef({ startY: 0, active: false, triggered: false });
  const feedAtTop = useRef(true);
  const activeFilterCount = (activeTag ? 1 : 0) + (verifiedOnly ? 1 : 0);

  const loadPosts = useCallback(async () => {
    if (!session) { setLoading(false); setRefreshing(false); return; }
    try {
      const data = await fetchPosts(session.user.id);
      setPosts(data);
    } catch {
      // Keep existing posts on error rather than clearing
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  const handleVoteOnPost = useCallback(async (postId: string, vote: 1 | -1 | 0) => {
    if (!session) return;
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const prevVote = p.user_vote ?? 0;
      const scoreDelta = vote - prevVote;
      return { ...p, score: (p.score ?? 0) + scoreDelta, user_vote: vote };
    }));
    await voteOnPost(postId, session.user.id, vote);
  }, [session]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Auto-refresh feed every 15 seconds
  useEffect(() => {
    const interval = setInterval(loadPosts, 15000); return () => clearInterval(interval);
  }, [loadPosts]);

  // Pull-to-refresh via touch events
  useEffect(() => {
    const ps = pullState.current;

    const onTouchStart = (e: TouchEvent) => {
      if (!feedAtTop.current) return;
      ps.startY = e.touches[0].clientY;
      ps.active = true;
      ps.triggered = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!ps.active || ps.triggered) return;
      const dy = e.touches[0].clientY - ps.startY;
      if (dy > 0) {
        setPullY(Math.min(dy * 0.45, PULL_THRESHOLD));
        if (dy >= PULL_THRESHOLD * 2) {
          ps.triggered = true;
          setPullY(0);
          setRefreshing(true);
          loadPosts();
        }
      } else {
        setPullY(0);
      }
    };

    const onTouchEnd = () => {
      ps.active = false;
      setPullY(0);
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [loadPosts]);

  const filteredPosts = posts.filter(p => {
    if (activeFilter === 'DISCUSSIONS') return p.type === 'discussion';
    if (activeFilter === 'MEDIA') return !!(p as any).media_url;
    if (activeTag && p.tag !== activeTag) return false;
    if (verifiedOnly && !p.author.is_verified) return false;
    return true;
  });

  // Inject nudge banners every 5 real posts for free users
  const filtered: any[] = [];
  filteredPosts.forEach((post, i) => {
    filtered.push(post);
    if (!isPremium && !dismissedNudge && (i + 1) % 5 === 0) {
      filtered.push({ _nudge: true, id: `nudge-${i}` });
    }
  });

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
      {/* Show header on native and mobile web, hide on desktop web (WebNavbar handles it) */}
      {!(Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= 768) && (
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={styles.logo}>SIZE.</Text>
          <Text style={styles.tabTitle}>FEED</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => { setRefreshing(true); loadPosts(); }}>
            <Ionicons name="refresh-outline" size={24} color={refreshing ? COLORS.gold : COLORS.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings' as any)}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.muted} />
          </TouchableOpacity>
        </View>
      </View>
      )}

      <View style={styles.feedTabBar}>
        {FEED_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={styles.feedTabBtn}
            onPress={() => setActiveFilter(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.feedTabLabel, activeFilter === tab && styles.feedTabLabelActive]}>
              {tab}
            </Text>
            {activeFilter === tab && <View style={styles.feedTabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>


      {/* Filter bar */}
      {activeFilter === 'FEED' && (
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
            onPress={() => setShowFilter(true)}
          >
            <Ionicons name="options-outline" size={14} color={activeFilterCount > 0 ? COLORS.gold : COLORS.muted} />
            <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
          {activeFilterCount > 0 && (
            <TouchableOpacity onPress={() => { setActiveTag(null); setVerifiedOnly(false); }}>
              <Text style={styles.filterClear}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter modal */}
      <Modal visible={showFilter} animationType="slide" presentationStyle="pageSheet" transparent>
        <TouchableOpacity style={styles.filterBackdrop} activeOpacity={1} onPress={() => setShowFilter(false)} />
        <View style={styles.filterSheet}>
          <View style={styles.filterSheetHandle} />
          <Text style={styles.filterSheetTitle}>Filter Posts</Text>

          <Text style={styles.filterSectionLabel}>POST TYPE</Text>
          <View style={styles.filterRow}>
            {['All', 'Verified only'].map(opt => {
              const active = opt === 'Verified only' ? verifiedOnly : !verifiedOnly;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setVerifiedOnly(opt === 'Verified only')}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.filterSectionLabel}>TAG</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 240 }}>
            <View style={styles.filterTagGrid}>
              {TAGS.map(item => {
                const color = TAG_COLORS[item.category];
                const active = activeTag === item.label;
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.filterTagChip, { borderColor: color, backgroundColor: active ? `${color}25` : 'transparent' }]}
                    onPress={() => setActiveTag(active ? null : item.label)}
                  >
                    <Text style={[styles.filterTagChipText, { color: active ? color : COLORS.muted }]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.filterDoneBtn} onPress={() => setShowFilter(false)}>
            <Text style={styles.filterDoneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      ) : activeFilter === 'DISCUSSIONS' ? (
        <DiscussionsList posts={posts} isPremium={isPremium} />
      ) : (
        <>
          {/* Pull-to-refresh indicator (web only) */}
          {pullY > 0 && (
            <View style={{ height: pullY, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 }}>
              <Ionicons
                name={pullY >= PULL_THRESHOLD ? 'refresh' : 'chevron-down-outline'}
                size={20}
                color={pullY >= PULL_THRESHOLD ? COLORS.gold : COLORS.muted}
              />
            </View>
          )}
          {refreshing && (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <ActivityIndicator size="small" color={COLORS.gold} />
            </View>
          )}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.feedList}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => { feedAtTop.current = e.nativeEvent.contentOffset.y <= 0; }}
          scrollEventThrottle={16}
          renderItem={({ item }) => {
            if ((item as any)._nudge) {
              return (
                <PremiumNudgeBanner
                  onDismiss={() => setDismissedNudge(true)}
                  onUpgrade={() => setShowPaywall(true)}
                />
              );
            }
            return item.type === 'poll'
              ? <PollCard post={item} userId={session?.user.id ?? ''} isPremium={isPremium} onVotePost={v => handleVoteOnPost(item.id, v)} />
              : <DiscussionCard post={item} isPremium={isPremium} myId={session?.user.id ?? ''} onVotePost={v => handleVoteOnPost(item.id, v)} />;
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {activeFilterCount > 0 ? 'No posts match your filters.' : 'No posts yet. Be the first.'}
              </Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={() => { setActiveTag(null); setVerifiedOnly(false); }}>
                  <Text style={[styles.emptyText, { color: COLORS.gold, marginTop: 8, fontSize: SIZES.sm }]}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
        </>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <CreatePostModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onPost={loadPosts}
        isPremium={isPremium}
      />

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        trigger="See exact sizes, unlock photos & videos, get verified."
      />
      </PageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  headerTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  logo: { fontSize: 28, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  tabTitle: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  feedTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  feedTabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  feedTabLabel: { fontSize: 11, fontWeight: '600', color: COLORS.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  feedTabLabelActive: { color: COLORS.white, fontWeight: '700' },
  feedTabUnderline: { position: 'absolute', bottom: 0, left: '25%', right: '25%', height: 2, backgroundColor: COLORS.gold, borderRadius: 1 },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  filterBtnActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}15` },
  filterBtnText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '700' },
  filterBtnTextActive: { color: COLORS.gold },
  filterClear: { color: COLORS.muted, fontSize: SIZES.sm, textDecorationLine: 'underline' },
  filterBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  filterSheet: { backgroundColor: '#161616', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 14, borderWidth: 1, borderColor: COLORS.cardBorder, borderBottomWidth: 0 },
  filterSheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.mutedDark, alignSelf: 'center', marginBottom: 8 },
  filterSheetTitle: { color: COLORS.white, fontSize: SIZES.xl, fontWeight: '800' },
  filterSectionLabel: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  filterChipActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}20` },
  filterChipText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '700' },
  filterChipTextActive: { color: COLORS.gold },
  filterTagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterTagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1 },
  filterTagChipText: { fontSize: SIZES.sm, fontWeight: '700' },
  filterDoneBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  filterDoneBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.md },
  tagChip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1 },
  tagChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  tagPickerLabel: { color: COLORS.muted, fontSize: SIZES.xs, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  tagPickerRow: { gap: 8, paddingBottom: 4 },
  tagPickerChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1 },
  tagPickerChipText: { fontSize: SIZES.sm, fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  feedList: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 100, gap: 10 },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { color: COLORS.muted, fontSize: SIZES.md },
  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
    gap: 10,
  },
  // Author row
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  authorAvatarLetter: { fontSize: SIZES.md, fontWeight: '800' },
  authorMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorUsername: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '600' },
  postTime: { color: COLORS.muted, fontSize: SIZES.xs },
  badge: { borderRadius: RADIUS.full, paddingHorizontal: 9, paddingVertical: 3 },
  badgeMuted: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: COLORS.white, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  // Content
  pollQuestion: { color: COLORS.white, fontSize: SIZES.base, fontWeight: '700', lineHeight: 22 },
  discussionText: { color: COLORS.offWhite, fontSize: SIZES.base, lineHeight: 24 },
  // Poll options
  pollOptions: { gap: 8 },
  pollOption: { borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: `${COLORS.mutedDark}60`, overflow: 'hidden', minHeight: 44, justifyContent: 'center' },
  pollBar: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  pollOptionInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  pollOptionText: { color: COLORS.offWhite, fontSize: SIZES.md, fontWeight: '500' },
  pollOptionVoted: { color: COLORS.white, fontWeight: '700' },
  pollPct: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '600' },
  pollPctVoted: { color: COLORS.gold, fontWeight: '800' },
  // Action / vote bar
  actionBar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, marginTop: 2 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '600' },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  voteBtn: { padding: 2 },
  voteScore: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '800', minWidth: 20, textAlign: 'center' },
  voteScoreUp: { color: COLORS.gold },
  voteScoreDown: { color: '#60A5FA' },
  fab: { position: 'absolute', bottom: 96, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  fabIcon: { fontSize: 32, fontWeight: '300', color: COLORS.bg, lineHeight: 36, marginTop: -2 },
  // Discussion title in card
  link: { color: '#60A5FA', textDecorationLine: 'underline' },
  discussionTitle: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '800', lineHeight: 24 },
  // Discussion list view
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginTop: 8, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, color: COLORS.white, fontSize: SIZES.md },
  discList: { paddingHorizontal: 14, paddingBottom: 100 },
  discSep: { height: 1, backgroundColor: COLORS.cardBorder },
  discRow: { paddingVertical: 14, gap: 6 },
  discRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discRowTime: { color: COLORS.muted, fontSize: SIZES.xs, marginLeft: 'auto' },
  discRowTitle: { color: COLORS.white, fontSize: SIZES.base, fontWeight: '800', lineHeight: 22 },
  discRowPreview: { color: COLORS.muted, fontSize: SIZES.sm, lineHeight: 18 },
  discRowFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  discRowAvatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  discRowAvatarLetter: { fontSize: 9, fontWeight: '900' },
  discRowAuthor: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '600', flex: 1 },
  discRowStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  discRowStatText: { color: COLORS.muted, fontSize: SIZES.xs },
  // Modal
  modal: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  modalCancel: { color: COLORS.muted, fontSize: SIZES.md, minWidth: 60 },
  modalTitle: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '800' },
  modalPostBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, paddingHorizontal: 18, paddingVertical: 7 },
  modalPostBtnDisabled: { opacity: 0.35 },
  modalPostBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.sm },
  modalBody: { flex: 1, padding: 20 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typeHint: { color: COLORS.muted, fontSize: SIZES.xs, marginBottom: 16, lineHeight: 18 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  typeBtnActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}15` },
  typeBtnText: { color: COLORS.muted, fontSize: SIZES.md, fontWeight: '600' },
  typeBtnTextActive: { color: COLORS.gold },
  fieldLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginTop: 18 },
  fieldLabelOptional: { color: COLORS.mutedDark, fontWeight: '600', letterSpacing: 0 },
  fieldLabelRequired: { color: COLORS.gold },
  titleInput: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.white, fontSize: SIZES.lg, fontWeight: '700' },
  contentInput: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, padding: 16, color: COLORS.white, fontSize: SIZES.base, minHeight: 120, textAlignVertical: 'top' },
  charCount: { color: COLORS.muted, fontSize: SIZES.xs, textAlign: 'right', marginTop: 6 },
  pollInputs: { gap: 8 },
  pollInput: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.white, fontSize: SIZES.md },
  mediaPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, marginTop: 16 },
  mediaPickerText: { color: COLORS.muted, fontSize: SIZES.md, flex: 1 },
  mediaPickerTextActive: { color: COLORS.gold },
  mediaPreviewWrap: { position: 'relative', marginVertical: 8, borderRadius: RADIUS.md, overflow: 'hidden' },
  mediaPreview: { width: '100%', height: 200, borderRadius: RADIUS.md },
  removeMedia: { position: 'absolute', top: 8, right: 8 },
  // Premium nudge banner
  nudgeBanner: { marginHorizontal: 0, marginBottom: 2 },
  nudgeBannerInner: { borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}40`, padding: 14, flexDirection: 'row', alignItems: 'flex-start' },
  nudgeBannerContent: { flex: 1, gap: 6 },
  nudgeBannerTitle: { color: COLORS.gold, fontSize: SIZES.md, fontWeight: '900', letterSpacing: 0.5 },
  nudgeBannerSub: { color: COLORS.muted, fontSize: SIZES.sm, lineHeight: 18 },
  nudgeUpgradeBtn: { alignSelf: 'flex-start', backgroundColor: COLORS.gold, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 7, marginTop: 4 },
  nudgeUpgradeBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.sm },
  nudgeDismissBtn: { padding: 4, marginLeft: 8 },
});
