import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PageContainer from '@/components/PageContainer';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { WORLD_AVERAGE } from '@/lib/mockData';
import { fetchUserRank, fetchUserPostCount, fetchTotalUserCount, fetchUserPosts } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Post } from '@/lib/types';

type ProfileTab = 'posts' | 'comments' | 'saved';

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

const TAG_COLORS: Record<string, string> = {
  size: '#A78BFA',
  content: '#60A5FA',
  viral: '#F87171',
};
const TAG_CATEGORIES: Record<string, string> = {
  Hung: 'size', Massive: 'size', 'Above Average': 'size', Average: 'size',
  Micro: 'size', Grower: 'size', Shower: 'size',
  OC: 'content', 'Rate Me': 'content', Comparison: 'content', Measurement: 'content',
  Progress: 'content', 'First Post': 'content', Soft: 'content', Hard: 'content', Bulge: 'content',
  'Guess My Size': 'viral', 'Be Honest': 'viral', 'Brutal Rating': 'viral',
  'Top %': 'viral', "Biggest You've Seen?": 'viral',
};

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

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, session, signOut, demoMode } = useAuth();
  const [rank, setRank] = useState<number | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showSize, setShowSize] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const size = profile?.size_inches ?? 0;
  const tier = getSizeTier(size);

  useEffect(() => {
    if (!session?.user.id) return;
    fetchUserRank(session.user.id).then(setRank).catch(() => setRank(null));
    fetchUserPostCount(session.user.id).then(setPostCount).catch(() => setPostCount(0));
    fetchTotalUserCount().then(setTotalUsers).catch(() => setTotalUsers(0));
    setPostsLoading(true);
    fetchUserPosts(session.user.id)
      .then(data => setUserPosts(data))
      .catch(() => setUserPosts([]))
      .finally(() => setPostsLoading(false));
  }, [session?.user.id]);

  const percentile = rank && totalUsers ? Math.round((1 - rank / totalUsers) * 100) : null;

  async function handleSignOut() {
    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to sign out?')) return;
      setSigningOut(true);
      await signOut();
      return;
    }
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
        },
      },
    ]);
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inner}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>PROFILE</Text>
          <TouchableOpacity onPress={() => router.push('/settings' as any)}>
            <Ionicons name="settings-outline" size={22} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        {demoMode && (
          <View style={styles.demoBanner}>
            <Ionicons name="warning-outline" size={14} color={COLORS.gold} />
            <Text style={styles.demoText}>Demo mode — connect Supabase to go live</Text>
          </View>
        )}

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { borderColor: tier.color }]}>
            <Text style={styles.avatarText}>{profile.username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.is_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            )}
          </View>
        </View>

        {/* Size card */}
        <LinearGradient
          colors={['#1A1200', '#111111', '#0A0A0A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sizeCard}
        >
          <LinearGradient
            colors={['rgba(232,80,10,0.21)', 'rgba(201,168,76,0.09)', 'rgba(191,90,242,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sizeCardInner}
          >
            <View style={styles.sizeCardTop}>
              <Text style={styles.sizeCardLabel}>YOUR SIZE</Text>
              <TouchableOpacity onPress={() => setShowSize(!showSize)}>
                <Ionicons name={showSize ? 'eye-outline' : 'eye-off-outline'} size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            {showSize ? (
              <LinearGradient
                colors={['#FF6B2B', '#E8500A', '#C9A84C', '#BF5AF2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sizeDisplayGrad}
              >
                <Text style={styles.sizeDisplay}>{size.toFixed(1)}"</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.sizeDisplayHidden}>••••</Text>
            )}
            <View style={[styles.tierBadge, { borderColor: tier.color }]}>
              <Text style={styles.tierEmoji}>{tier.emoji}</Text>
              <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
            </View>
            {!profile.is_verified && (
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={() => router.push('/verify' as any)}
              >
                <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.gold} />
                <Text style={styles.verifyText}>Get Verified</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </LinearGradient>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{rank ? `#${rank.toLocaleString()}` : '—'}</Text>
            <Text style={styles.statLbl}>Global Rank</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statVal}>{percentile !== null ? `${percentile}th` : '—'}</Text>
            <Text style={styles.statLbl}>Percentile</Text>
          </View>
          <View style={[styles.statCell, styles.statCellTop]}>
            <Text style={styles.statVal}>
              {size >= WORLD_AVERAGE ? `+${(size - WORLD_AVERAGE).toFixed(1)}"` : `-${(WORLD_AVERAGE - size).toFixed(1)}"`}
            </Text>
            <Text style={styles.statLbl}>vs Avg</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder, styles.statCellTop]}>
            <Text style={styles.statVal}>{postCount}</Text>
            <Text style={styles.statLbl}>Posts</Text>
          </View>
        </View>

        {/* Info */}
        {(profile.country || profile.age_range) && (
          <View style={styles.infoSection}>
            {profile.country && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.muted} />
                <Text style={styles.infoLabel}>Country</Text>
                <Text style={styles.infoValue}>{profile.country}</Text>
              </View>
            )}
            {profile.age_range && (
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.muted} />
                <Text style={styles.infoLabel}>Age Range</Text>
                <Text style={styles.infoValue}>{profile.age_range}</Text>
              </View>
            )}
          </View>
        )}

        {/* Posts / Comments / Saved tabs */}
        <View style={styles.tabSection}>
          <View style={styles.tabBar}>
            {(['posts', 'comments', 'saved'] as ProfileTab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={styles.tabBtn}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
                {activeTab === tab && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Posts tab */}
          {activeTab === 'posts' && (
            postsLoading ? (
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
            )
          )}

          {/* Comments tab */}
          {activeTab === 'comments' && (
            <View style={styles.tabEmpty}>
              <Ionicons name="chatbubble-outline" size={36} color={COLORS.muted} />
              <Text style={styles.tabEmptyText}>No comments yet</Text>
            </View>
          )}

          {/* Saved tab */}
          {activeTab === 'saved' && (
            <View style={styles.tabEmpty}>
              <Ionicons name="bookmark-outline" size={36} color={COLORS.muted} />
              <Text style={styles.tabEmptyText}>No saved posts yet</Text>
            </View>
          )}
        </View>

        {/* Admin panel link */}
        {(profile as any).is_admin && (
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => router.push('/admin' as any)}
          >
            <Ionicons name="shield-outline" size={18} color={COLORS.purple} />
            <Text style={styles.adminText}>Verify Queue</Text>
          </TouchableOpacity>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
          {signingOut
            ? <ActivityIndicator size="small" color={COLORS.red} />
            : <>
                <Ionicons name="log-out-outline" size={18} color={COLORS.red} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>
      </PageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { paddingBottom: 100 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  demoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12, backgroundColor: `${COLORS.gold}15`, borderRadius: RADIUS.md, borderWidth: 1, borderColor: `${COLORS.gold}40`, paddingHorizontal: 14, paddingVertical: 10 },
  demoText: { color: COLORS.gold, fontSize: SIZES.sm, flex: 1 },
  avatarSection: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.card, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontSize: SIZES.xxxl, fontWeight: '900' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { color: COLORS.white, fontSize: SIZES.xl, fontWeight: '800' },
  verifiedBadge: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: COLORS.bg, fontSize: 11, fontWeight: '900' },
  sizeCard: { marginHorizontal: 16, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(232,80,10,0.3)', overflow: 'hidden', marginBottom: 16 },
  sizeCardInner: { padding: 24, alignItems: 'center', gap: 12 },
  sizeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  sizeCardLabel: { color: COLORS.gold, fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '800' },
  sizeDisplayGrad: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  sizeDisplay: { fontSize: 56, fontWeight: '900', lineHeight: 64, color: COLORS.white, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  sizeDisplayHidden: { fontSize: 56, fontWeight: '900', lineHeight: 64, color: COLORS.mutedDark },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6 },
  tierEmoji: { fontSize: 16 },
  tierText: { fontSize: SIZES.sm, fontWeight: '700', letterSpacing: 1 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  verifyText: { color: COLORS.gold, fontSize: SIZES.sm, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 16, overflow: 'hidden' },
  statCell: { width: '50%', padding: 16, alignItems: 'center' },
  statCellBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.cardBorder },
  statCellTop: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  statVal: { color: COLORS.gold, fontSize: SIZES.xl, fontWeight: '900' },
  statLbl: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2, letterSpacing: 0.5 },
  infoSection: { marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden', marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  infoLabel: { color: COLORS.muted, fontSize: SIZES.md, flex: 1 },
  infoValue: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '600' },
  // Tab section
  tabSection: { marginTop: 8, marginBottom: 16 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder, marginBottom: 4 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabLabel: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.muted },
  tabLabelActive: { color: COLORS.white },
  tabUnderline: { position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 2, backgroundColor: COLORS.gold, borderRadius: 2 },
  tabEmpty: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  tabEmptyText: { color: COLORS.muted, fontSize: SIZES.md },
  // Post items
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
  // Admin
  adminBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: `${COLORS.purple}40`, marginBottom: 10 },
  adminText: { color: COLORS.purple, fontWeight: '700', fontSize: SIZES.md },
  // Sign out
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: `${COLORS.red}40` },
  signOutText: { color: COLORS.red, fontWeight: '700', fontSize: SIZES.md },
});
