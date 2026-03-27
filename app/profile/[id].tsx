import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Platform, Image, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { WORLD_AVERAGE } from '@/lib/mockData';
import {
  fetchPublicProfile, fetchUserRank, fetchUserPostCount,
  fetchTotalUserCount, fetchUserPosts, getOrCreateConversation,
  getUserNetWorth, followUser, unfollowUser, isFollowing,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { usePurchase } from '@/context/PurchaseContext';
import PaywallModal from '@/components/PaywallModal';
import { Profile, Post } from '@/lib/types';

const TAG_COLORS: Record<string, string> = {
  size: '#A78BFA', content: '#60A5FA', viral: '#F87171',
};
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
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function joinedDate(ts: string): string {
  return new Date(ts).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function PostItem({ post }: { post: Post }) {
  const totalVotes = post.poll_options?.reduce((s, o) => s + o.vote_count, 0) ?? 0;
  const tagColor = post.tag ? (TAG_COLORS[TAG_CATEGORIES[post.tag]] ?? COLORS.muted) : null;
  return (
    <View style={styles.postItem}>
      <View style={styles.postItemTop}>
        {post.tag && tagColor && (
          <View style={[styles.postTagChip, { borderColor: tagColor, backgroundColor: `${tagColor}18` }]}>
            <Text style={[styles.postTagText, { color: tagColor }]}>{post.tag}</Text>
          </View>
        )}
        <Text style={styles.postItemTime}>{timeAgo(post.created_at)}</Text>
      </View>
      <Text style={styles.postItemContent} numberOfLines={3}>{post.content}</Text>
      <View style={styles.postItemFooter}>
        {post.type === 'poll' && (
          <View style={styles.postItemStat}>
            <Ionicons name="stats-chart-outline" size={12} color={COLORS.muted} />
            <Text style={styles.postItemStatText}>{totalVotes.toLocaleString()} votes</Text>
          </View>
        )}
        <View style={styles.postItemStat}>
          <Ionicons name="chatbubble-outline" size={12} color={COLORS.muted} />
          <Text style={styles.postItemStatText}>{post.comment_count} comments</Text>
        </View>
        <View style={[styles.postTypePill, post.type === 'poll' ? styles.postTypePillPoll : styles.postTypePillDisc]}>
          <Text style={styles.postTypeText}>{post.type === 'poll' ? 'Poll' : 'Discussion'}</Text>
        </View>
      </View>
    </View>
  );
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = usePurchase();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rankResult, setRankResult] = useState<{ rank: number; provisional: boolean; totalVerified: number } | null>(null);
  const rank = rankResult?.rank ?? null;
  const [postCount, setPostCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [netWorth, setNetWorth] = useState<{ totalNetWorth: number; walletCount: number; verified: boolean } | null>(null);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = session?.user.id === id;

  useEffect(() => {
    if (!id) return;
    async function load() {
      const [p, r, pc, tu] = await Promise.all([
        fetchPublicProfile(id),
        fetchUserRank(id),
        fetchUserPostCount(id),
        fetchTotalUserCount(),
      ]);
      setProfile(p);
      setRankResult(r.rank > 0 ? r : null);
      setPostCount(pc);
      setTotalUsers(tu);
      setLoading(false);
      setPostsLoading(true);
      fetchUserPosts(id)
        .then(setUserPosts)
        .finally(() => setPostsLoading(false));
      getUserNetWorth(id).then(nw => {
        if (nw.walletCount > 0) setNetWorth(nw);
      }).catch(() => {});
      if (session?.user.id && session.user.id !== id) {
        isFollowing(session.user.id, id).then(setFollowing).catch(() => {});
      }
    }
    load();
  }, [id]);

  async function handleFollow() {
    if (!session?.user.id || isOwnProfile) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(session.user.id, id);
        setFollowing(false);
      } else {
        await followUser(session.user.id, id);
        setFollowing(true);
      }
    } catch {}
    setFollowLoading(false);
  }

  async function handleMessage() {
    if (!session) return;
    setMessaging(true);
    const { id: convId, error } = await getOrCreateConversation(session.user.id, id);
    setMessaging(false);
    if (error) {
      if (Platform.OS === 'web') {
        window.alert(`Could not start conversation: ${error}`);
      } else {
        typeof window !== 'undefined' ? window.alert(`Could not start conversation: ${error}`) : null;
      }
      return;
    }
    if (convId) router.push(`/chat/${convId}` as any);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <TouchableOpacity onPress={() => { if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); } else { router.push('/(tabs)' as any); } }} style={styles.backBtnAbs}>
            <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={{ color: COLORS.muted, marginTop: 20 }}>User not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const size = profile.size_inches;
  const tier = getSizeTier(size);
  const percentile = rank && totalUsers
    ? Math.max(0, Math.min(100, Math.round((1 - rank / totalUsers) * 100)))
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inner}>

        {/* Header banner */}
        <View style={styles.headerBanner}>
          {profile.header_url
            ? <Image source={{ uri: profile.header_url }} style={styles.headerImg} resizeMode="cover" />
            : <LinearGradient colors={['#1A0A00', '#0A0A0A']} style={styles.headerPlaceholder} />
          }
          {/* Back button */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => { if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); } else { router.push('/(tabs)' as any); } }} style={styles.topBarBtn}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar row */}
        <View style={styles.avatarRow}>
          <View style={[styles.avatarWrap, { borderColor: tier.color }]}>
            {profile.avatar_url
              ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
              : <Text style={styles.avatarInitial}>{profile.username.charAt(0).toUpperCase()}</Text>
            }
          </View>

          {/* Action buttons */}
          <View style={styles.actionBtns}>
            {isOwnProfile ? (
              <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/profile' as any)}>
                <Text style={styles.outlineBtnText}>Your Profile</Text>
              </TouchableOpacity>
            ) : session ? (
              <>
                <TouchableOpacity
                  style={following ? styles.followBtnFollowing : styles.followBtn}
                  onPress={handleFollow}
                  disabled={followLoading}
                  activeOpacity={0.85}
                >
                  {followLoading
                    ? <ActivityIndicator size="small" color={following ? COLORS.gold : COLORS.bg} />
                    : <Text style={following ? styles.followBtnTextFollowing : styles.followBtnText}>{following ? 'Following' : 'Follow'}</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.messageBtn}
                  onPress={handleMessage}
                  disabled={messaging}
                  activeOpacity={0.85}
                >
                  {messaging
                    ? <ActivityIndicator size="small" color={COLORS.bg} />
                    : <><Ionicons name="chatbubble-outline" size={15} color={COLORS.bg} /><Text style={styles.messageBtnText}>Message</Text></>
                  }
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>

        {/* Name + bio */}
        <View style={styles.bioSection}>
          <View style={styles.nameRow}>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.is_verified && (
              <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓</Text></View>
            )}
            <View style={[styles.tierPill, { borderColor: tier.color }]}>
              <Text style={styles.tierEmoji}>{tier.emoji}</Text>
              <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
            </View>
          </View>

          {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}

          {(profile as any).x_handle ? (
            <TouchableOpacity onPress={() => {
              const url = `https://x.com/${(profile as any).x_handle}`;
              if (typeof window !== 'undefined') window.open(url, '_blank');
            }}>
              <View style={styles.metaRow}>
                <Ionicons name="logo-twitter" size={14} color="#1DA1F2" />
                <Text style={[styles.metaLink, { color: '#1DA1F2' }]}>@{(profile as any).x_handle}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {profile.website ? (
            <TouchableOpacity onPress={() => {
              const u = profile.website!.startsWith('http') ? profile.website! : `https://${profile.website}`;
              if (typeof window !== 'undefined') window.open(u, '_blank');
            }}>
              <View style={styles.metaRow}>
                <Ionicons name="link-outline" size={14} color={COLORS.gold} />
                <Text style={styles.metaLink}>{profile.website}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          <View style={styles.metaRowGroup}>
            {profile.country ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color={COLORS.muted} />
                <Text style={styles.metaText}>{profile.country}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.muted} />
              <Text style={styles.metaText}>Joined {joinedDate(profile.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Size card */}
        <LinearGradient
          colors={['#1A1200', '#111111', '#0A0A0A']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.sizeCard}
        >
          <LinearGradient
            colors={['rgba(232,80,10,0.21)', 'rgba(201,168,76,0.09)', 'rgba(191,90,242,0.06)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.sizeCardInner}
          >
            <Text style={styles.sizeCardLabel}>SIZE</Text>
            {isPremium ? (
              <>
                <LinearGradient
                  colors={['#FF6B2B', '#E8500A', '#C9A84C', '#BF5AF2']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.sizeDisplayGrad}
                >
                  <Text style={styles.sizeDisplay}>{size.toFixed(1)}"</Text>
                </LinearGradient>
                {profile.girth_inches ? (
                  <Text style={styles.girthLabel}>{profile.girth_inches.toFixed(1)}" girth</Text>
                ) : null}
              </>
            ) : (
              <TouchableOpacity style={styles.sizeLockedWrap} onPress={() => setShowPaywall(true)} activeOpacity={0.85}>
                <Text style={styles.sizeLockedEmoji}>{tier.emoji}</Text>
                <Text style={styles.sizeLockedText}>Exact size hidden</Text>
                <View style={styles.sizeLockedBtn}>
                  <Ionicons name="lock-closed" size={12} color={COLORS.bg} />
                  <Text style={styles.sizeLockedBtnText}>Unlock with Premium</Text>
                </View>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </LinearGradient>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { val: rank ? `#${rank.toLocaleString()}` : '\u2014', lbl: rankResult?.provisional ? 'Provisional Rank' : 'Global Rank' },
            { val: percentile !== null ? `${percentile}th` : '\u2014', lbl: 'Percentile' },
            { val: size >= WORLD_AVERAGE ? `+${(size - WORLD_AVERAGE).toFixed(1)}"` : `-${(WORLD_AVERAGE - size).toFixed(1)}"`, lbl: 'vs Avg' },
            {
              val: netWorth
                ? netWorth.totalNetWorth >= 1_000_000_000 ? `$${(netWorth.totalNetWorth / 1_000_000_000).toFixed(1)}B`
                  : netWorth.totalNetWorth >= 1_000_000 ? `$${(netWorth.totalNetWorth / 1_000_000).toFixed(1)}M`
                  : netWorth.totalNetWorth >= 1_000 ? `$${(netWorth.totalNetWorth / 1_000).toFixed(1)}K`
                  : `$${Math.round(netWorth.totalNetWorth).toLocaleString()}`
                : '\u2014',
              lbl: 'Net Worth',
            },
          ].map((s, i) => (
            <View key={i} style={[styles.statCell, i % 2 !== 0 && styles.statCellBorder, i >= 2 && styles.statCellTop]}>
              <Text style={styles.statVal}>{s.val}</Text>
              <Text style={styles.statLbl}>{s.lbl}</Text>
            </View>
          ))}
        </View>

        {/* Posts */}
        <View style={styles.tabSection}>
          <View style={styles.tabHeader}>
            <Text style={styles.tabHeaderText}>POSTS</Text>
          </View>
          {postsLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.gold} />
          ) : userPosts.length === 0 ? (
            <View style={styles.tabEmpty}>
              <Ionicons name="document-text-outline" size={36} color={COLORS.muted} />
              <Text style={styles.tabEmptyText}>No posts yet</Text>
            </View>
          ) : (
            <View style={styles.postList}>
              {userPosts.map(post => <PostItem key={post.id} post={post} />)}
            </View>
          )}
        </View>

      </ScrollView>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        trigger="Unlock exact sizes with SIZE. Premium"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { paddingBottom: 100 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtnAbs: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Header banner
  headerBanner: { height: 140, position: 'relative', overflow: 'hidden' },
  headerImg: { width: '100%', height: '100%' },
  headerPlaceholder: { width: '100%', height: '100%' },
  topBar: { position: 'absolute', top: 12, left: 14 },
  topBarBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },

  // Avatar row
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: -36, marginBottom: 12 },
  avatarWrap: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarInitial: { color: COLORS.white, fontSize: SIZES.xxxl, fontWeight: '900' },

  // Action buttons
  actionBtns: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  messageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.gold, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 9 },
  messageBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.sm },
  followBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 9 },
  followBtnFollowing: { borderWidth: 1, borderColor: COLORS.gold, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: 'transparent' },
  followBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.sm },
  followBtnTextFollowing: { color: COLORS.gold, fontWeight: '700', fontSize: SIZES.sm },
  outlineBtn: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 9 },
  outlineBtnText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.sm },

  // Bio
  bioSection: { paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  username: { color: COLORS.white, fontSize: SIZES.xl, fontWeight: '900' },
  verifiedBadge: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: COLORS.bg, fontSize: 11, fontWeight: '900' },
  tierPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3 },
  tierEmoji: { fontSize: 12 },
  tierLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  bioText: { color: COLORS.offWhite, fontSize: SIZES.md, lineHeight: 22 },
  metaRowGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: COLORS.muted, fontSize: SIZES.sm },
  metaLink: { color: COLORS.gold, fontSize: SIZES.sm, fontWeight: '600' },

  // Size card
  sizeCard: { marginHorizontal: 16, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(232,80,10,0.3)', overflow: 'hidden', marginBottom: 16 },
  sizeCardInner: { padding: 24, alignItems: 'center', gap: 12 },
  sizeCardLabel: { color: COLORS.gold, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '800', alignSelf: 'flex-start' },
  sizeDisplayGrad: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  sizeDisplay: { fontSize: 56, fontWeight: '900', lineHeight: 64, color: COLORS.white, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  girthLabel: { color: COLORS.muted, fontSize: SIZES.sm, letterSpacing: 1 },
  sizeLockedWrap: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  sizeLockedEmoji: { fontSize: 48 },
  sizeLockedText: { color: COLORS.muted, fontSize: SIZES.md, letterSpacing: 0.5 },
  sizeLockedBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.gold, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 8, marginTop: 4 },
  sizeLockedBtnText: { color: COLORS.bg, fontSize: SIZES.sm, fontWeight: '800' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 16, overflow: 'hidden' },
  statCell: { width: '50%', padding: 16, alignItems: 'center' },
  statCellBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.cardBorder },
  statCellTop: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  statVal: { color: COLORS.gold, fontSize: SIZES.xl, fontWeight: '900' },
  statLbl: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2, letterSpacing: 0.5 },

  // Posts
  tabSection: { marginTop: 8 },
  tabHeader: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  tabHeaderText: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  tabEmpty: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  tabEmptyText: { color: COLORS.muted, fontSize: SIZES.md },
  postList: { gap: 1 },
  postItem: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder, gap: 8 },
  postItemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postTagChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1 },
  postTagText: { fontSize: 10, fontWeight: '800' },
  postItemTime: { color: COLORS.muted, fontSize: SIZES.xs, marginLeft: 'auto' },
  postItemContent: { color: COLORS.offWhite, fontSize: SIZES.md, lineHeight: 20 },
  postItemFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  postItemStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postItemStatText: { color: COLORS.muted, fontSize: SIZES.xs },
  postTypePill: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  postTypePillPoll: { backgroundColor: `${COLORS.purple}25` },
  postTypePillDisc: { backgroundColor: `${COLORS.blue}25` },
  postTypeText: { fontSize: 10, fontWeight: '700', color: COLORS.muted },
});
