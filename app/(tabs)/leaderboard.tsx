import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl, ScrollView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { fetchLeaderboard, fetchUserRank, fetchTotalUserCount, fetchLeaderboardByRadius, NearbyEntry } from '@/lib/api';
import PageContainer from '@/components/PageContainer';
import { usePurchase } from '@/context/PurchaseContext';
import { useAuth } from '@/context/AuthContext';
import PaywallModal from '@/components/PaywallModal';
import { LeaderboardEntry } from '@/lib/types';
import UserAvatar from '@/components/UserAvatar';
import { requestAndSaveLocation, getCurrentLocation, UserLocation } from '@/lib/location';
import NearbyMap from '@/components/NearbyMap';

const GLOBAL_FILTERS = ['Global', 'USA', '18–24', '25–34', '35–44'];
const RADIUS_OPTIONS = [
  { label: '5 mi', miles: 5 },
  { label: '10 mi', miles: 10 },
  { label: '25 mi', miles: 25 },
  { label: '50 mi', miles: 50 },
];

const HOLO_COLORS: [string, string, string, string] = ['#FF6B2B', '#E8500A', '#C9A84C', '#BF5AF2'];

const RANK_PALETTES: Record<number, [string, string, string]> = {
  1: ['#FFD700', '#E8B800', '#FFA500'],
  2: ['#C0C0C0', '#A8A8A8', '#D8D8D8'],
  3: ['#CD7F32', '#A0522D', '#D4956A'],
};

function HoloBadge({ inches, size = 'md', isPremium }: { inches: number; size?: 'sm' | 'md' | 'lg'; isPremium?: boolean }) {
  const isLg = size === 'lg';
  const isSm = size === 'sm';

  if (isPremium === false) {
    const tier = getSizeTier(inches);
    return (
      <View style={[
        styles.holoBadgeMuted,
        isLg && styles.holoBadgeMutedLg,
        isSm && styles.holoBadgeMutedSm,
        { borderColor: tier.color, backgroundColor: tier.color + '20' },
      ]}>
        <Text style={[styles.holoBadgeMutedText, isLg && styles.holoBadgeTextLg, isSm && styles.holoBadgeTextSm, { color: tier.color }]}>
          {tier.emoji} {tier.label}
        </Text>
      </View>
    );
  }

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
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rankBadge}>
        <Text style={styles.rankBadgeText}>{rank === 1 ? '1' : rank === 2 ? '2' : '3'}</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={styles.rankNumWrap}>
      <Text style={styles.rankNum}>#{rank}</Text>
    </View>
  );
}

function TopThreeCard({ entry, position, onPress, isPremium }: { entry: LeaderboardEntry; position: 1 | 2 | 3; onPress: () => void; isPremium?: boolean }) {
  const colors = RANK_PALETTES[position];
  const isFirst = position === 1;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.topCard, isFirst && styles.topCardFirst]}>
      <LinearGradient
        colors={[`${colors[0]}33`, `${colors[1]}0A`]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.topCardGrad}
      >
        <View style={styles.topCardRankRow}>
          <Text style={[styles.topCardRankLabel, { color: colors[0] }]}>
            {position === 1 ? '#1' : position === 2 ? '#2' : '#3'}
          </Text>
          {entry.is_verified && (
            <View style={[styles.verifiedPill, { backgroundColor: `${colors[0]}30`, borderColor: `${colors[0]}60` }]}>
              <Text style={[styles.verifiedPillText, { color: colors[0] }]}>VERIFIED</Text>
            </View>
          )}
        </View>
        <Text style={styles.topCardUsername}>@{entry.username}</Text>
        {entry.country ? <Text style={styles.topCardCountry}>{entry.country}</Text> : null}
        <HoloBadge inches={entry.size_inches} size={isFirst ? 'lg' : 'md'} isPremium={isPremium} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

function LeaderboardRow({ entry, onPress, isPremium }: { entry: LeaderboardEntry; onPress: () => void; isPremium?: boolean }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <RankBadge rank={entry.rank} />
      <UserAvatar username={entry.username} sizeInches={entry.size_inches} size={32} isVerified={entry.is_verified} />
      <View style={styles.userInfo}>
        <View style={styles.usernameRow}>
          <Text style={styles.username}>@{entry.username}</Text>
          {entry.is_verified && (
            <View style={styles.verifiedDot}><Text style={styles.verifiedDotText}>✓</Text></View>
          )}
        </View>
        {entry.country ? <Text style={styles.countryText}>{entry.country}</Text> : null}
      </View>
      <HoloBadge inches={entry.size_inches} size="sm" isPremium={isPremium} />
    </TouchableOpacity>
  );
}

function NearbyRow({ entry, onPress, isPremium }: { entry: NearbyEntry; onPress: () => void; isPremium?: boolean }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rankNumWrap}>
        <Text style={styles.rankNum}>#{entry.rank}</Text>
      </View>
      <View style={styles.userInfo}>
        <View style={styles.usernameRow}>
          <Text style={styles.username}>@{entry.username}</Text>
          {entry.is_verified && (
            <View style={styles.verifiedDot}><Text style={styles.verifiedDotText}>✓</Text></View>
          )}
        </View>
        <Text style={styles.countryText}>{entry.distance_miles.toFixed(1)} mi away</Text>
      </View>
      <HoloBadge inches={entry.size_inches} size="sm" isPremium={isPremium} />
    </TouchableOpacity>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { isPremium } = usePurchase();
  const { profile, session } = useAuth();

  // Global leaderboard state
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Global');
  const [showPaywall, setShowPaywall] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);

  // Mode: 'global' | 'nearby'
  const [mode, setMode] = useState<'global' | 'nearby'>('global');

  // Nearby state
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [activeRadius, setActiveRadius] = useState(25);
  const [nearbyEntries, setNearbyEntries] = useState<NearbyEntry[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [mapView, setMapView] = useState(true);

  const visibleEntries = isPremium ? entries.slice(3) : entries.slice(3, 10);

  // ── Global load ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const AGE_RANGES = ['18–24', '25–34', '35–44'];
    const filter = activeFilter === 'Global'
      ? undefined
      : AGE_RANGES.includes(activeFilter)
        ? { ageRange: activeFilter }
        : { country: activeFilter };

    const [data, total] = await Promise.all([fetchLeaderboard(filter), fetchTotalUserCount()]);
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

  // ── Nearby load ────────────────────────────────────────────────────────────
  const loadNearby = useCallback(async (loc: UserLocation, miles: number) => {
    setNearbyLoading(true);
    const data = await fetchLeaderboardByRadius(loc.lat, loc.lng, miles);
    setNearbyEntries(data);
    setNearbyLoading(false);
  }, []);

  async function handleEnableLocation() {
    if (!session?.user.id) return;
    setLocationLoading(true);
    const loc = await requestAndSaveLocation(session.user.id);
    setLocationLoading(false);
    if (!loc) {
      setLocationDenied(true);
      if (Platform.OS === 'web') {
        window.alert('Location access denied. Please enable it in your browser settings.');
      } else {
        typeof window !== 'undefined' ? window.alert('Enable location access in your device settings to use this feature.') : null;
      }
      return;
    }
    setLocation(loc);
    loadNearby(loc, activeRadius);
  }

  useEffect(() => {
    if (mode === 'nearby' && !location && !locationLoading && !locationDenied) {
      // Try to get cached location silently first
      getCurrentLocation().then(loc => {
        if (loc) { setLocation(loc); loadNearby(loc, activeRadius); }
      }).catch(() => {});
    }
  }, [mode]);

  useEffect(() => {
    if (location) loadNearby(location, activeRadius);
  }, [activeRadius]);

  const top3 = entries.slice(0, 3);
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] as const : null;

  // ── Nearby screen ──────────────────────────────────────────────────────────
  function renderNearbyContent() {
    if (!location) {
      return (
        <View style={styles.locationPrompt}>
          <LinearGradient
            colors={['#1A1200', '#111111']}
            style={styles.locationCard}
          >
            <Ionicons name="location-outline" size={40} color={COLORS.gold} />
            <Text style={styles.locationTitle}>Nearby Rankings</Text>
            <Text style={styles.locationSub}>
              See how you size up against men in your area.{'\n'}Your exact location is never shared.
            </Text>
            <TouchableOpacity
              style={styles.locationBtn}
              onPress={handleEnableLocation}
              disabled={locationLoading}
            >
              {locationLoading
                ? <ActivityIndicator color={COLORS.bg} />
                : <>
                    <Ionicons name="navigate-outline" size={18} color={COLORS.bg} />
                    <Text style={styles.locationBtnText}>Enable Location</Text>
                  </>
              }
            </TouchableOpacity>
            <Text style={styles.locationPrivacy}>
               Approximate location only · Never shared publicly
            </Text>
          </LinearGradient>
        </View>
      );
    }

    return (
      <>
        {/* Radius + map toggle controls */}
        <View style={styles.nearbyControls}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusRow}>
            {RADIUS_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.miles}
                style={[styles.radiusChip, activeRadius === opt.miles && styles.radiusChipActive]}
                onPress={() => setActiveRadius(opt.miles)}
              >
                <Text style={[styles.radiusChipText, activeRadius === opt.miles && styles.radiusChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.mapToggleBtn, mapView && styles.mapToggleBtnActive]}
            onPress={() => setMapView(v => !v)}
          >
            <Ionicons name={mapView ? 'list-outline' : 'map-outline'} size={16} color={mapView ? COLORS.gold : COLORS.muted} />
          </TouchableOpacity>
        </View>

        {nearbyLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.gold} />
          </View>
        ) : mapView ? (
          <View style={styles.mapWrap}>
            <NearbyMap
              center={location}
              entries={nearbyEntries}
              mySize={profile?.size_inches ?? 5.5}
              radiusMiles={activeRadius}
              onPinPress={e => router.push(`/profile/${e.id}` as any)}
            />
            <View style={styles.mapStats}>
              <Text style={styles.mapStatsText}>
                {nearbyEntries.length > 0 ? `${nearbyEntries.length} verified nearby · ${activeRadius} mi` : `No verified users within ${activeRadius} mi`}
              </Text>
            </View>
          </View>
        ) : nearbyEntries.length === 0 ? (
          <View style={styles.emptyNearby}>
            <Ionicons name="people-outline" size={48} color={COLORS.muted} />
            <Text style={styles.emptyNearbyText}>No verified users within {activeRadius} miles.</Text>
            <Text style={styles.emptyNearbySub}>Try a larger radius.</Text>
          </View>
        ) : (
          <FlatList
            data={nearbyEntries}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <NearbyRow entry={item} onPress={() => router.push(`/profile/${item.id}` as any)} isPremium={isPremium} />
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListHeaderComponent={
              <Text style={styles.listHeader}>
                {nearbyEntries.length} VERIFIED NEARBY · {activeRadius} MI
              </Text>
            }
          />
        )}
      </>
    );
  }

  // ── Global screen ──────────────────────────────────────────────────────────
  function renderGlobalContent() {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      );
    }

    return (
      <FlatList
        data={visibleEntries}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.gold} />
        }
        renderItem={({ item }) => (
          <LeaderboardRow entry={item} onPress={() => router.push(`/profile/${item.id}` as any)} isPremium={isPremium} />
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={
          <>
            {/* Your Ranking Hero */}
            {profile && (
              <LinearGradient
                colors={['#1A1200', '#111111', '#0A0A0A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <LinearGradient
                  colors={['rgba(232,80,10,0.25)', 'rgba(201,168,76,0.12)', 'rgba(191,90,242,0.08)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.heroCardInner}
                >
                  <View style={styles.heroLeft}>
                    <Text style={styles.heroLabel}>YOUR RANKING</Text>
                    <Text style={styles.heroRank} numberOfLines={1} adjustsFontSizeToFit>
                      {myRank ? `#${myRank.toLocaleString()}` : '—'}
                      {totalUsers > 0 && <Text style={styles.heroRankTotal}> / {totalUsers.toLocaleString()}</Text>}
                    </Text>
                    <Text style={styles.heroUsername}>@{profile.username}</Text>
                    {profile.is_verified ? (
                      <View style={styles.verifiedRow}>
                        <Ionicons name="checkmark-circle" size={13} color={COLORS.gold} />
                        <Text style={styles.verifiedRowText}>Verified</Text>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => router.push('/verify' as any)} style={styles.verifyHintBtn}>
                        <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.gold} />
                        <Text style={styles.unverifiedHint}>Get Verified →</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <HoloBadge inches={profile.size_inches} size="lg" isPremium={isPremium} />
                </LinearGradient>
              </LinearGradient>
            )}

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
              {GLOBAL_FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                  onPress={() => { setActiveFilter(f); setLoading(true); setEntries([]); }}
                >
                  <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Top 3 Podium */}
            {podiumOrder && (
              <View style={styles.podiumRow}>
                {podiumOrder.map((entry, i) => (
                  <View key={entry.id} style={[styles.podiumCol, i === 1 && styles.podiumColCenter]}>
                    <TopThreeCard
                      entry={entry}
                      position={(i === 0 ? 2 : i === 1 ? 1 : 3) as 1 | 2 | 3}
                      onPress={() => router.push(`/profile/${entry.id}` as any)}
                      isPremium={isPremium}
                    />
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.listHeader}>TOP VERIFIED MEMBERS</Text>
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
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Text style={styles.logo}>SIZE.</Text>
            <Text style={styles.title}>RANKS</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.verifiedOnlyBadge}>
              <Ionicons name="checkmark-circle" size={11} color={COLORS.gold} />
              <Text style={styles.verifiedOnlyText}>VERIFIED</Text>
            </View>
            <Ionicons name="trophy" size={22} color={COLORS.gold} />
          </View>
        </View>

        {/* Mode toggle: Global / Nearby */}
        <View style={styles.modeBar}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'global' && styles.modeBtnActive]}
            onPress={() => setMode('global')}
          >
            <Ionicons name="globe-outline" size={14} color={mode === 'global' ? COLORS.gold : COLORS.muted} />
            <Text style={[styles.modeBtnText, mode === 'global' && styles.modeBtnTextActive]}>Global</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'nearby' && styles.modeBtnActive]}
            onPress={() => setMode('nearby')}
          >
            <Ionicons name="location-outline" size={14} color={mode === 'nearby' ? COLORS.gold : COLORS.muted} />
            <Text style={[styles.modeBtnText, mode === 'nearby' && styles.modeBtnTextActive]}>Nearby</Text>
          </TouchableOpacity>
        </View>

        {mode === 'global' ? renderGlobalContent() : renderNearbyContent()}

        <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} trigger="Unlock the full Top 100 leaderboard" />
      </PageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verifiedOnlyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${COLORS.gold}18`, borderWidth: 1, borderColor: `${COLORS.gold}40`, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedOnlyText: { color: COLORS.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  headerTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  logo: { fontSize: 28, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Mode toggle
  modeBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.card, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 3 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: RADIUS.full },
  modeBtnActive: { backgroundColor: `${COLORS.gold}20`, borderWidth: 1, borderColor: `${COLORS.gold}50` },
  modeBtnText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '700' },
  modeBtnTextActive: { color: COLORS.gold },

  // Hero card
  heroCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(232,80,10,0.3)', overflow: 'hidden' },
  heroCardInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingRight: 16, gap: 12 },
  heroLeft: { flex: 1, minWidth: 0 },
  heroLabel: { color: COLORS.gold, fontSize: 9, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 4 },
  heroRank: { color: COLORS.white, fontSize: 32, fontWeight: '900', letterSpacing: -0.5, lineHeight: 38 },
  heroRankTotal: { color: COLORS.muted, fontSize: 16, fontWeight: '600' },
  heroUsername: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '600', marginTop: 4 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  verifiedRowText: { color: COLORS.gold, fontSize: SIZES.xs, fontWeight: '700' },
  verifyHintBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  unverifiedHint: { color: COLORS.gold, fontSize: SIZES.xs },

  // Holo badge
  holoBadge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  holoBadgeLg: { paddingHorizontal: 20, paddingVertical: 12 },
  holoBadgeSm: { paddingHorizontal: 10, paddingVertical: 5 },
  holoBadgeText: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '900', letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  holoBadgeTextLg: { fontSize: SIZES.xxl, letterSpacing: -0.5 },
  holoBadgeTextSm: { fontSize: SIZES.sm },
  holoBadgeMuted: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0, maxWidth: 140 },
  holoBadgeMutedLg: { paddingHorizontal: 14, paddingVertical: 10, maxWidth: 150 },
  holoBadgeMutedSm: { paddingHorizontal: 8, paddingVertical: 5 },
  holoBadgeMutedText: { fontSize: SIZES.sm, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center' },

  // Filter
  filterList: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  filterChipActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}20` },
  filterText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '600' },
  filterTextActive: { color: COLORS.gold },

  // Top 3
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  podiumCol: { flex: 1 },
  podiumColCenter: { flex: 1.15, marginBottom: 10 },
  topCard: { borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  topCardFirst: { borderColor: 'rgba(255,215,0,0.35)' },
  topCardGrad: { padding: 12, gap: 6 },
  topCardRankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  topCardRankLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  topCardUsername: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '800' },
  topCardCountry: { color: COLORS.muted, fontSize: 10, fontWeight: '500' },
  verifiedPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1 },
  verifiedPillText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },

  // Rank
  rankBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rankBadgeText: { fontSize: 18 },
  rankNumWrap: { width: 40, alignItems: 'center' },
  rankNum: { color: COLORS.muted, fontSize: SIZES.md, fontWeight: '700' },

  // List
  listHeader: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2, paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  sep: { height: 1, backgroundColor: COLORS.cardBorder, marginHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  userInfo: { flex: 1 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  verifiedDot: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, width: 15, height: 15, alignItems: 'center', justifyContent: 'center' },
  verifiedDotText: { color: COLORS.bg, fontSize: 9, fontWeight: '900' },
  countryText: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 1 },

  // Unlock
  unlockBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, padding: 16, backgroundColor: 'rgba(232,80,10,0.08)', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: 'rgba(232,80,10,0.25)' },
  unlockText: { color: COLORS.gold, fontWeight: '700', fontSize: SIZES.md, flex: 1 },

  // Nearby
  nearbyControls: { flexDirection: 'row', alignItems: 'center', paddingRight: 16, marginBottom: 4 },
  radiusRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  radiusChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  radiusChipActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}20` },
  radiusChipText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '700' },
  radiusChipTextActive: { color: COLORS.gold },
  mapToggleBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  mapToggleBtnActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}15` },
  mapWrap: { flex: 1, marginHorizontal: 16, marginBottom: 16, borderRadius: RADIUS.lg, overflow: 'hidden', minHeight: 400, position: 'relative' },
  mapStats: { position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6 },
  mapStatsText: { color: COLORS.white, fontSize: SIZES.xs, fontWeight: '700' },
  emptyNearby: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 10 },
  emptyNearbyText: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '700' },
  emptyNearbySub: { color: COLORS.muted, fontSize: SIZES.sm },

  // Location prompt
  locationPrompt: { flex: 1, padding: 20, justifyContent: 'center' },
  locationCard: { borderRadius: RADIUS.xl, borderWidth: 1, borderColor: `${COLORS.gold}30`, padding: 32, alignItems: 'center', gap: 14 },
  locationTitle: { color: COLORS.white, fontSize: SIZES.xxl, fontWeight: '900' },
  locationSub: { color: COLORS.muted, fontSize: SIZES.md, textAlign: 'center', lineHeight: 22 },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingHorizontal: 28, paddingVertical: 16, marginTop: 8 },
  locationBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.md },
  locationPrivacy: { color: COLORS.muted, fontSize: SIZES.xs, textAlign: 'center', marginTop: 4 },
});
