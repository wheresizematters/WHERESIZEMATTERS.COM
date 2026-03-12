import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl, Modal,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import PageContainer from '@/components/PageContainer';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { fetchPosts, createPost, voteOnPoll } from '@/lib/api';
import { pickMedia, uploadMedia } from '@/lib/media';
import { useAuth } from '@/context/AuthContext';
import { usePurchase } from '@/context/PurchaseContext';
import { Post } from '@/lib/types';
import LockedMedia from '@/components/LockedMedia';
import PaywallModal from '@/components/PaywallModal';

const FILTERS = ['All', 'Polls', 'Discussion', 'Media'];

function SizeBadge({ inches, verified, isPremium }: { inches: number; verified: boolean; isPremium: boolean }) {
  const tier = getSizeTier(inches);
  return (
    <View style={[styles.badge, { borderColor: tier.color }]}>
      <Text style={[styles.badgeText, { color: tier.color }]}>
        {isPremium ? `${inches.toFixed(1)}"` : tier.emoji} {verified ? '✓' : ''}
      </Text>
    </View>
  );
}

function PollCard({ post, userId, isPremium }: { post: Post; userId: string; isPremium: boolean }) {
  const [voted, setVoted] = useState<string | null>(null);
  const options = post.poll_options ?? [];
  const totalVotes = options.reduce((sum, o) => sum + o.vote_count, 0);

  async function handleVote(optionId: string) {
    if (voted) return;
    setVoted(optionId);
    await voteOnPoll(optionId, userId);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.authorName}>@{post.author.username}</Text>
        <SizeBadge inches={post.author.size_inches} verified={post.author.is_verified} isPremium={isPremium} />
      </View>
      <Text style={styles.pollQuestion}>{post.content}</Text>
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
      <View style={styles.cardFooter}>
        <Text style={styles.footerMeta}>{totalVotes.toLocaleString()} votes</Text>
        <View style={styles.footerRight}>
          <Ionicons name="chatbubble-outline" size={14} color={COLORS.muted} />
          <Text style={styles.footerMeta}>{post.comment_count} · {post.created_at}</Text>
        </View>
      </View>
    </View>
  );
}

function DiscussionCard({ post, isPremium }: { post: Post; isPremium: boolean }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.authorName}>@{post.author.username}</Text>
        <SizeBadge inches={post.author.size_inches} verified={post.author.is_verified} isPremium={isPremium} />
      </View>
      <Text style={styles.discussionText}>{post.content}</Text>
      {(post as any).media_url && (
        <LockedMedia
          uri={(post as any).media_url}
          type={(post as any).media_type ?? 'image'}
          isPremium={isPremium}
        />
      )}
      <View style={styles.cardFooter}>
        <View style={styles.footerRight}>
          <Ionicons name="chatbubble-outline" size={14} color={COLORS.muted} />
          <Text style={styles.footerMeta}>{post.comment_count} replies · {post.created_at}</Text>
        </View>
      </View>
    </View>
  );
}

function CreatePostModal({ visible, onClose, onPost, isPremium }: {
  visible: boolean; onClose: () => void; onPost: () => void; isPremium: boolean;
}) {
  const { session } = useAuth();
  const [type, setType] = useState<'discussion' | 'poll'>('discussion');
  const [content, setContent] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '', '', '']);
  const [mediaAsset, setMediaAsset] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  async function handlePickMedia() {
    if (!isPremium) { setShowPaywall(true); return; }
    const asset = await pickMedia();
    if (asset) setMediaAsset(asset);
  }

  async function handlePost() {
    if (!content.trim() || !session) return;
    setLoading(true);
    const postId = Date.now().toString();
    let mediaUrl: string | undefined;
    if (mediaAsset) {
      const url = await uploadMedia(session.user.id, postId, mediaAsset.uri, mediaAsset.mimeType ?? 'image/jpeg');
      if (url) mediaUrl = url;
    }
    const opts = type === 'poll' ? pollOptions.filter(o => o.trim()) : undefined;
    const { error } = await createPost(session.user.id, type, content.trim(), opts, mediaUrl);
    setLoading(false);
    if (!error) { setContent(''); setMediaAsset(null); onPost(); onClose(); }
  }

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Post</Text>
            <TouchableOpacity onPress={handlePost} disabled={loading || !content.trim()}>
              {loading
                ? <ActivityIndicator size="small" color={COLORS.gold} />
                : <Text style={[styles.modalPost, !content.trim() && styles.modalPostDisabled]}>Post</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.typeRow}>
              {(['discussion', 'poll'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                  onPress={() => setType(t)}
                >
                  <Ionicons
                    name={t === 'discussion' ? 'chatbubbles-outline' : 'stats-chart-outline'}
                    size={16} color={type === t ? COLORS.gold : COLORS.muted}
                  />
                  <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
                    {t === 'discussion' ? 'Discussion' : 'Poll'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.contentInput}
              placeholder={type === 'poll' ? 'Ask a question...' : "What's on your mind?"}
              placeholderTextColor={COLORS.muted}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={280}
            />
            <Text style={styles.charCount}>{content.length}/280</Text>

            {/* Media picker */}
            <TouchableOpacity style={styles.mediaPickerBtn} onPress={handlePickMedia}>
              <Ionicons name="images-outline" size={20} color={isPremium ? COLORS.gold : COLORS.muted} />
              <Text style={[styles.mediaPickerText, isPremium && styles.mediaPickerTextActive]}>
                {isPremium ? 'Add Photo / Video' : '📷 Add Media (Premium)'}
              </Text>
              {!isPremium && <Ionicons name="lock-closed-outline" size={14} color={COLORS.muted} />}
            </TouchableOpacity>

            {mediaAsset && (
              <View style={styles.mediaPreviewWrap}>
                <Image source={{ uri: mediaAsset.uri }} style={styles.mediaPreview} resizeMode="cover" />
                <TouchableOpacity style={styles.removeMedia} onPress={() => setMediaAsset(null)}>
                  <Ionicons name="close-circle" size={24} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            )}

            {type === 'poll' && (
              <View style={styles.pollInputs}>
                <Text style={styles.pollInputLabel}>Poll Options</Text>
                {pollOptions.map((opt, i) => (
                  <TextInput
                    key={i}
                    style={styles.pollInput}
                    placeholder={`Option ${i + 1}${i < 2 ? ' (required)' : ' (optional)'}`}
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

export default function FeedScreen() {
  const { session } = useAuth();
  const { isPremium } = usePurchase();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);

  const loadPosts = useCallback(async () => {
    const data = await fetchPosts();
    setPosts(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const filtered = posts.filter(p => {
    if (activeFilter === 'Polls') return p.type === 'poll';
    if (activeFilter === 'Discussion') return p.type === 'discussion';
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
      {Platform.OS !== 'web' && (
      <View style={styles.header}>
        <Text style={styles.logo}>SIZE.</Text>
        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={24} color={COLORS.muted} />
        </TouchableOpacity>
      </View>
      )}

      <FlatList
        data={FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        keyExtractor={item => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === item && styles.filterChipActive]}
            onPress={() => setActiveFilter(item)}
          >
            <Text style={[styles.filterText, activeFilter === item && styles.filterTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.feedList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadPosts(); }}
              tintColor={COLORS.gold}
            />
          }
          renderItem={({ item }) =>
            item.type === 'poll'
              ? <PollCard post={item} userId={session?.user.id ?? ''} isPremium={isPremium} />
              : <DiscussionCard post={item} isPremium={isPremium} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No posts yet. Be the first.</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
        <Ionicons name="add" size={28} color={COLORS.bg} />
      </TouchableOpacity>

      <CreatePostModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onPost={loadPosts}
        isPremium={isPremium}
      />
      </PageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  logo: { fontSize: 28, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  filterList: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  filterChipActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}20` },
  filterText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '600' },
  filterTextActive: { color: COLORS.gold },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  feedList: { paddingHorizontal: 16, paddingBottom: 100 },
  separator: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 4 },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { color: COLORS.muted, fontSize: SIZES.md },
  card: { paddingVertical: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authorName: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  badge: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 0.5 },
  pollQuestion: { color: COLORS.white, fontSize: SIZES.base, fontWeight: '600', lineHeight: 22 },
  pollOptions: { gap: 8 },
  pollOption: { borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, overflow: 'hidden', minHeight: 44, justifyContent: 'center' },
  pollBar: { position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: RADIUS.sm },
  pollOptionInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  pollOptionText: { color: '#EEEEEE', fontSize: SIZES.md, fontWeight: '500' },
  pollOptionVoted: { color: COLORS.white, fontWeight: '700' },
  pollPct: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '600' },
  pollPctVoted: { color: COLORS.gold, fontWeight: '800' },
  discussionText: { color: '#EEEEEE', fontSize: SIZES.base, lineHeight: 24 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerMeta: { color: COLORS.muted, fontSize: SIZES.sm },
  fab: { position: 'absolute', bottom: 96, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  // Modal
  modal: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  modalCancel: { color: COLORS.muted, fontSize: SIZES.md },
  modalTitle: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '800' },
  modalPost: { color: COLORS.gold, fontSize: SIZES.md, fontWeight: '800' },
  modalPostDisabled: { opacity: 0.4 },
  modalBody: { flex: 1, padding: 20 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  typeBtnActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}15` },
  typeBtnText: { color: COLORS.muted, fontSize: SIZES.md, fontWeight: '600' },
  typeBtnTextActive: { color: COLORS.gold },
  contentInput: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, padding: 16, color: COLORS.white, fontSize: SIZES.base, minHeight: 120, textAlignVertical: 'top' },
  charCount: { color: COLORS.muted, fontSize: SIZES.xs, textAlign: 'right', marginTop: 6 },
  pollInputs: { marginTop: 20, gap: 10 },
  pollInputLabel: { color: COLORS.muted, fontSize: SIZES.xs, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  pollInput: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.white, fontSize: SIZES.md },
  mediaPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, marginTop: 8 },
  mediaPickerText: { color: COLORS.muted, fontSize: SIZES.md, flex: 1 },
  mediaPickerTextActive: { color: COLORS.gold },
  mediaPreviewWrap: { position: 'relative', marginVertical: 8, borderRadius: RADIUS.md, overflow: 'hidden' },
  mediaPreview: { width: '100%', height: 200, borderRadius: RADIUS.md },
  removeMedia: { position: 'absolute', top: 8, right: 8 },
});
