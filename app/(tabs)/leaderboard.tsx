import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { fetchLeaderboard, fetchUserRank, fetchTotalUserCount } from '@/lib/api';
import PageContainer from '@/components/PageContainer';
import { usePurchase } from '@/context/PurchaseContext';
import { useAuth } from '@/context/AuthContext';
import PaywallModal from '@/components/PaywallModal';
import { LeaderboardEntry } from '@/lib/types';

const FILTERS = ['Global', 'USA', '18–24', '25–34', '35–44'];

// Holographic gradient stops — iridescent orange/gold/purple shimmer
const HOLO_COLORS: [string, string, string, string] = [
  '#FF6B2B', '#E8500A', '#C9A84C', '#BF5AF2',
];

// Rank-specific colors for top 3
const RANK_PALETTES: Record<number, [string, string, string]> = {
  1: ['#FFD700', '#E8B800', '#FFA500'],
  2: ['#C0C0C0', '#A8A8A8', '#D8D8D8'],
  3: ['#CD7F32', '#A0522D', '#D4956A'],
};

function HoloBadge({ inches, size = 'md' }: { inches: number; size?: 'sm' | 'md' | 'lg' }) {
  const isLg = size === 'lg';
  const isSm = size === 'sm';
  return (
    <LinearGradient
      colors={HOLO_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.holoBadge, isLg && styles.holoBadgeLg, isSm && styles.holoBadgeSm]}
    >
      <Text style={[styles.holoBadgeText, isLg && styles.holoBadgeTextLg, isSm && styles.holoBadgeTextSm]}>
        {inches.toFixed(1)}"
      </Text>
    </LinearGradient>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const colors = RANK_PALETTES[rank];
    return (
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.rankBadge}
      >
        <Text style={styles.rankBadgeText}>
          {rank === 1 ? '👑' : rank === 2 ? '🥈' : '🥉'}
        </Text>
      </LinearGradient>
    );
  }
  return (
    <View style={styles.rankNumWrap}>
      <Text style={styles.rankNum}>#{rank}</Text>
    </View>
  );
}

function TopThreeCard({ entry, position }: { entry: LeaderboardEntry; position: 1 | 2 | 3 }) {
  const colors = RANK_PALETTES[position];
  const isFirst = position === 1;
  const tier = getSizeTier(entry.size_inches);

  return (
    <View style={[styles.topCard, isFirst && styles.topCardFirst]}>
      <LinearGradient
        colors={[`${colors[0]}33`, `${colors[1]}0A`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topCardGrad}
      >
        <View style={styles.topCardRankRow}>
          <Text style={[styles.topCardRankLabel, { color: colors[0] }]}>
            {position === 1 ? '👑 #1' : position === 2 ? '🥈 #2' : '🥉 #3'}
          </Text>
          {entry.is_verified && (
            <View style={[styles.verifiedPill, { backgroundColor: `${colors[0]}30`, borderColor: `${colors[0]}60` }]}>
              <Text style={[styles.verifiedPillText, { color: colors[0] }]}>VERIFIED</Text>
            </View>
          )}
        </View>
        <Text style={styles.topCardUsername}>@{entry.username}</Text>
        {entry.country ? <Text style={styles.topCardCountry}>{entry.country}</Text> : null}
        <HoloBadge inches={entry.size_inches} size={isFirst ? 'lg' : 'md'} />
      </LinearGradient>
    </View>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const tier = getSizeTier(entry.size_inches);
  const isTop10 = entry.rank <= 10;

  return (
    <View style={[styles.row, isTop10 && styles.rowTop10]}>
      <RankBadge rank={entry.rank} />
      <View style={styles.userInfo}>
        <View style={styles.usernameRow}>
          <Text style={styles.username}>@{entry.username}</Text>
          {entry.is_verified && (
            <View style={styles.verifiedDot}>
              <Text style={styles.verifiedDotText}>✓</Text>
            </View>
          )}
        </View>
        {entry.country ? <Text style={styles.countryText}>{entry.country}</Text> : null}
      </View>
      <HoloBadge inches={entry.size_inches} size="sm" />
    </View>
  );
}

export default function LeaderboardScreen() {
  const { isPremium } = usePurchase();
  const { profile, session } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Global');
  const [showPaywall, setShowPaywall] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);

  const visibleEntries = isPremium ? entries.slice(3) : entries.slice(3, 10);

  const load = useCallback(async () => {
    const AGE_RANGES = ['18–24', '25–34', '35–44'];
    const filter = activeFilter === 'Global'
      ? undefined
      : AGE_RANGES.includes(activeFilter)
        ? { ageRange: activeFilter }
        : { country: activeFilter };

    const [data, total] = await Promise.all([
      fetchLeaderboard(filter),
      fetchTotalUserCount(),
    ]);
    setEntries(data);
    setTotalUsers(total);
    if (session?.user.id && session.user.id !== 'demo') {
      const rank = await fetchUserRank(session.user.id);
      setMyRank(rank || null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [session?.user.id, activeFilter]);

  useEffect(() => { load(); }, [load]);

  const top3 = entries.slice(0, 3);
  // Reorder: 2nd, 1st, 3rd for podium visual
  const podiumOrder = top3.length === 3
    ? [top3[1], top3[0], top3[2]] as const
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Text style={styles.logo}>SIZE.</Text>
            <Text style={styles.title}>LEADERBOARD</Text>
          </View>
          <Ionicons name="trophy" size={22} color={COLORS.gold} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : (
          <FlatList
            data={visibleEntries}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor={COLORS.gold}
              />
            }
            renderItem={({ item }) => <LeaderboardRow entry={item} />}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListHeaderComponent={
              <>
                {/* Your Ranking Hero */}
                {profile && (
                  <LinearGradient
                    colors={['#1A1200', '#111111', '#0A0A0A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                  >
                    <LinearGradient
                      colors={['rgba(232,80,10,0.25)', 'rgba(201,168,76,0.12)', 'rgba(191,90,242,0.08)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.heroCardInner}
                    >
                      <View style={styles.heroLeft}>
                        <Text style={styles.heroLabel}>YOUR RANKING</Text>
                        <Text style={styles.heroRank}>
                          {myRank ? `#${myRank.toLocaleString()}` : '—'}
                          {totalUsers > 0 && (
                            <Text style={styles.heroRankTotal}> / {totalUsers.toLocaleString()}</Text>
                          )}
                        </Text>
                        <Text style={styles.heroUsername}>@{profile.username}</Text>
                        {profile.is_verified ? (
                          <View style={styles.verifiedRow}>
                            <Ionicons name="checkmark-circle" size={13} color={COLORS.gold} />
                            <Text style={styles.verifiedRowText}>Verified</Text>
                          </View>
                        ) : (
                          <Text style={styles.unverifiedHint}>Tap to verify →</Text>
                        )}
                      </View>
                      <HoloBadge inches={profile.size_inches} size="lg" />
                    </LinearGradient>
                  </LinearGradient>
                )}

                {/* Filter chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterList}
                >
                  {FILTERS.map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                      onPress={() => { setActiveFilter(f); setLoading(true); }}
                    >
                      <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Top 3 */}
                {podiumOrder && (
                  <View style={styles.podiumRow}>
                    {podiumOrder.map((entry, i) => (
                      <View key={entry.id} style={[styles.podiumCol, i === 1 && styles.podiumColCenter]}>
                        <TopThreeCard
                          entry={entry}
                          position={(i === 0 ? 2 : i === 1 ? 1 : 3) as 1 | 2 | 3}
                        />
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.listHeader}>TOP RANKED</Text>
              </>
            }
            ListFooterComponent={!isPremium && entries.length > 13 ? (
              <TouchableOpacity style={styles.unlockBanner} onPress={() => setShowPaywall(true)}>
                <Ionicons name="lock-closed" size={18} color={COLORS.gold} />
                <Text style={styles.unlockText}>Unlock full Top 100 — Premium</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.gold} />
              </TouchableOpacity>
            ) : null}
          />
        )}
        <PaywallModal
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          trigger="Unlock the full Top 100 leaderboard"
        />
      </PageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  logo: { fontSize: 28, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Hero card
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(232,80,10,0.3)',
    overflow: 'hidden',
  },
  heroCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingRight: 16,
  },
  heroLeft: { flex: 1 },
  heroLabel: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroRank: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  heroRankTotal: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  heroUsername: {
    color: COLORS.muted,
    fontSize: SIZES.sm,
    fontWeight: '600',
    marginTop: 4,
  },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  verifiedRowText: { color: COLORS.gold, fontSize: SIZES.xs, fontWeight: '700' },
  unverifiedHint: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 6 },

  // Holo badge
  holoBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holoBadgeLg: { paddingHorizontal: 20, paddingVertical: 12 },
  holoBadgeSm: { paddingHorizontal: 10, paddingVertical: 5 },
  holoBadgeText: {
    color: COLORS.white,
    fontSize: SIZES.md,
    fontWeight: '900',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  holoBadgeTextLg: { fontSize: SIZES.xxl, letterSpacing: -0.5 },
  holoBadgeTextSm: { fontSize: SIZES.sm },

  // Filter
  filterList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.card,
  },
  filterChipActive: {
    borderColor: COLORS.gold,
    backgroundColor: `${COLORS.gold}20`,
  },
  filterText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '600' },
  filterTextActive: { color: COLORS.gold },

  // Top 3 Podium
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  podiumCol: { flex: 1 },
  podiumColCenter: { flex: 1.15, marginBottom: 10 },

  topCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: `${COLORS.cardBorder}`,
    overflow: 'hidden',
  },
  topCardFirst: {
    borderColor: 'rgba(255,215,0,0.35)',
  },
  topCardGrad: { padding: 12, gap: 6 },
  topCardRankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  topCardRankLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  topCardUsername: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '800' },
  topCardCountry: { color: COLORS.muted, fontSize: 10, fontWeight: '500' },
  verifiedPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  verifiedPillText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },

  // Rank badge
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: { fontSize: 18 },
  rankNumWrap: { width: 40, alignItems: 'center' },
  rankNum: { color: COLORS.muted, fontSize: SIZES.md, fontWeight: '700' },

  // List section header
  listHeader: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
  },

  // Row
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  sep: { height: 1, backgroundColor: COLORS.cardBorder, marginHorizontal: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rowTop10: {
    // subtle top-10 highlight
  },
  userInfo: { flex: 1 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  verifiedDot: {
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.full,
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedDotText: { color: COLORS.bg, fontSize: 9, fontWeight: '900' },
  countryText: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 1 },

  // Unlock
  unlockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(232,80,10,0.08)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(232,80,10,0.25)',
  },
  unlockText: { color: COLORS.gold, fontWeight: '700', fontSize: SIZES.md, flex: 1 },
});
