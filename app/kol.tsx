import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { rateKolWallet, compareKolWallets, fetchKolTop, KolRating, KolComparison, KolTopEntry } from '@/lib/api';

const TIER_COLORS: Record<string, string> = {
  Plankton: '#555555',
  Shrimp: '#888888',
  Fish: '#4A9EFF',
  Dolphin: '#32D74B',
  Shark: '#BF5AF2',
  Whale: '#C9A84C',
  Leviathan: '#FF453A',
};

const TIER_ICONS: Record<string, string> = {
  Plankton: 'water-outline',
  Shrimp: 'fish-outline',
  Fish: 'fish',
  Dolphin: 'boat-outline',
  Shark: 'skull-outline',
  Whale: 'planet-outline',
  Leviathan: 'flame',
};

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

type Tab = 'rate' | 'compare' | 'top';

export default function KolRatingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('rate');

  // Rate tab
  const [rateAddr, setRateAddr] = useState('');
  const [rating, setRating] = useState<KolRating | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState('');

  // Compare tab
  const [compareAddr1, setCompareAddr1] = useState('');
  const [compareAddr2, setCompareAddr2] = useState('');
  const [comparison, setComparison] = useState<KolComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Top tab
  const [topList, setTopList] = useState<KolTopEntry[]>([]);
  const [topLoading, setTopLoading] = useState(false);

  useEffect(() => {
    if (tab === 'top' && topList.length === 0) loadTop();
  }, [tab]);

  async function handleRate() {
    if (!rateAddr || !/^0x[a-fA-F0-9]{40}$/.test(rateAddr)) {
      setRateError('Enter a valid EVM address');
      return;
    }
    setRateLoading(true);
    setRateError('');
    setRating(null);
    const result = await rateKolWallet(rateAddr);
    if (result) setRating(result);
    else setRateError('Failed to rate wallet. Try again.');
    setRateLoading(false);
  }

  async function handleCompare() {
    if (!/^0x[a-fA-F0-9]{40}$/.test(compareAddr1) || !/^0x[a-fA-F0-9]{40}$/.test(compareAddr2)) return;
    setCompareLoading(true);
    setComparison(null);
    const result = await compareKolWallets(compareAddr1, compareAddr2);
    if (result) setComparison(result);
    setCompareLoading(false);
  }

  async function loadTop() {
    setTopLoading(true);
    const result = await fetchKolTop();
    setTopList(result.leaderboard);
    setTopLoading(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/(tabs)' as any); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>KOL Ratings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['rate', 'compare', 'top'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'rate' ? 'Rate Wallet' : t === 'compare' ? 'Compare' : 'Top KOLs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inner}>

        {/* ── RATE TAB ──────────────────────────────────────── */}
        {tab === 'rate' && (
          <>
            <LinearGradient
              colors={['#1A0A00', '#111111', '#0A0A0A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <LinearGradient
                colors={['rgba(232,80,10,0.21)', 'rgba(201,168,76,0.09)', 'rgba(191,90,242,0.06)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.heroInner}
              >
                <Ionicons name="analytics" size={32} color={COLORS.gold} />
                <Text style={styles.heroTitle}>SIZE Score</Text>
                <Text style={styles.heroSub}>
                  Rate any wallet 0-1000. ETH, $SIZE, NFTs, Arkham, Farcaster.{'\n'}
                  How big is your bag?
                </Text>
              </LinearGradient>
            </LinearGradient>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>WALLET ADDRESS</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="0x..."
                  placeholderTextColor={COLORS.muted}
                  value={rateAddr}
                  onChangeText={setRateAddr}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.goBtn} onPress={handleRate} disabled={rateLoading}>
                  {rateLoading ? (
                    <ActivityIndicator size="small" color={COLORS.bg} />
                  ) : (
                    <Ionicons name="search" size={18} color={COLORS.bg} />
                  )}
                </TouchableOpacity>
              </View>
              {rateError ? <Text style={styles.errorText}>{rateError}</Text> : null}
            </View>

            {rating && <RatingCard rating={rating} />}
          </>
        )}

        {/* ── COMPARE TAB ──────────────────────────────────── */}
        {tab === 'compare' && (
          <>
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>WALLET 1</Text>
              <TextInput
                style={[styles.input, { marginBottom: 12 }]}
                placeholder="0x..."
                placeholderTextColor={COLORS.muted}
                value={compareAddr1}
                onChangeText={setCompareAddr1}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.inputLabel}>WALLET 2</Text>
              <TextInput
                style={styles.input}
                placeholder="0x..."
                placeholderTextColor={COLORS.muted}
                value={compareAddr2}
                onChangeText={setCompareAddr2}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.compareBtn} onPress={handleCompare} disabled={compareLoading}>
                <LinearGradient
                  colors={['#FF6B2B', '#E8500A']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.compareBtnGrad}
                >
                  {compareLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="git-compare" size={18} color="#fff" />
                      <Text style={styles.compareBtnText}>Compare Wallets</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {comparison && <ComparisonCard comparison={comparison} />}
          </>
        )}

        {/* ── TOP TAB ──────────────────────────────────────── */}
        {tab === 'top' && (
          <>
            {topLoading ? (
              <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 40 }} />
            ) : topList.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="trophy-outline" size={36} color={COLORS.muted} />
                <Text style={styles.emptyText}>No ratings yet</Text>
                <Text style={styles.emptySub}>Rate some wallets to build the leaderboard</Text>
              </View>
            ) : (
              <View style={styles.listCard}>
                <Text style={styles.listTitle}>TOP RATED WALLETS</Text>
                {topList.map((entry, i) => (
                  <TouchableOpacity
                    key={entry.address}
                    style={[styles.topRow, i < topList.length - 1 && styles.topRowBorder]}
                    onPress={() => { setRateAddr(entry.address); setTab('rate'); handleRateAddress(entry.address); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.topRank, i < 3 && { color: COLORS.gold }]}>#{entry.rank}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.topName}>
                        {entry.entityName ?? entry.farcasterUsername ?? shortAddr(entry.address)}
                      </Text>
                      <Text style={styles.topAddr}>{shortAddr(entry.address)}</Text>
                    </View>
                    <View style={styles.topScoreBadge}>
                      <Text style={[styles.topScore, { color: TIER_COLORS[entry.tier] ?? COLORS.muted }]}>
                        {entry.score}
                      </Text>
                      <Text style={[styles.topTier, { color: TIER_COLORS[entry.tier] ?? COLORS.muted }]}>
                        {entry.tier}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );

  async function handleRateAddress(addr: string) {
    setRateLoading(true);
    setRateError('');
    setRating(null);
    const result = await rateKolWallet(addr);
    if (result) setRating(result);
    setRateLoading(false);
  }
}

// ── Rating Card Component ──────────────────────────────────────────

function RatingCard({ rating }: { rating: KolRating }) {
  const tierColor = TIER_COLORS[rating.score.tier] ?? COLORS.muted;
  const name = rating.arkham.entityName ?? rating.farcaster?.displayName ?? rating.farcaster?.username ?? shortAddr(rating.address);
  const b = rating.score.breakdown;
  const maxScore = 1000;

  return (
    <View style={styles.ratingCard}>
      {/* Score header */}
      <View style={styles.scoreHeader}>
        <View>
          <Text style={styles.scoreName}>{name}</Text>
          <Text style={styles.scoreAddr}>{shortAddr(rating.address)}</Text>
        </View>
        <View style={styles.scoreCircle}>
          <Text style={[styles.scoreValue, { color: tierColor }]}>{rating.score.total}</Text>
          <Text style={[styles.scoreTier, { color: tierColor }]}>{rating.score.tier}</Text>
        </View>
      </View>

      {/* Score bar */}
      <View style={styles.scoreBarBg}>
        <View style={[styles.scoreBarFill, { width: `${(rating.score.total / maxScore) * 100}%`, backgroundColor: tierColor }]} />
      </View>

      {/* Breakdown */}
      <Text style={styles.breakdownTitle}>BREAKDOWN</Text>
      {[
        { label: 'ETH Value', val: b.ethValue, max: 200, icon: 'diamond-outline' as const },
        { label: '$SIZE Holdings', val: b.sizeHoldings, max: 150, icon: 'wallet-outline' as const },
        { label: '$SIZE Staking', val: b.sizeStaking, max: 200, icon: 'lock-closed-outline' as const },
        { label: 'Blue Chip NFTs', val: b.blueChipNFTs, max: 200, icon: 'image-outline' as const },
        { label: 'Arkham Intel', val: b.arkhamRecognition, max: 100, icon: 'eye-outline' as const },
        { label: 'Farcaster', val: b.farcasterPresence, max: 150, icon: 'chatbubble-outline' as const },
      ].map(cat => (
        <View key={cat.label} style={styles.catRow}>
          <View style={styles.catLeft}>
            <Ionicons name={cat.icon} size={14} color={COLORS.muted} />
            <Text style={styles.catLabel}>{cat.label}</Text>
          </View>
          <View style={styles.catBarBg}>
            <View style={[styles.catBarFill, { width: `${(cat.val / cat.max) * 100}%`, backgroundColor: cat.val > 0 ? tierColor : 'transparent' }]} />
          </View>
          <Text style={styles.catVal}>{cat.val}/{cat.max}</Text>
        </View>
      ))}

      {/* Details */}
      <View style={styles.detailsGrid}>
        <DetailBox label="ETH" value={`${rating.ethBalance.toFixed(2)} ETH`} sub={formatUsd(rating.ethBalanceUsd)} />
        <DetailBox label="$SIZE" value={formatNum(rating.sizePosition.balance)} sub={rating.sizePosition.tierName !== 'None' ? `Staked: ${formatNum(rating.sizePosition.staked)}` : 'Not staked'} />
        <DetailBox label="NFTs" value={rating.blueChipNFTs.length > 0 ? rating.blueChipNFTs.map(n => n.name.split(' ')[0]).join(', ') : 'None'} sub={`${rating.blueChipNFTs.length} blue chip${rating.blueChipNFTs.length !== 1 ? 's' : ''}`} />
        <DetailBox label="Social" value={rating.farcaster.username ? `@${rating.farcaster.username}` : rating.arkham.entityName ?? 'Unknown'} sub={rating.farcaster.fid ? `FID #${rating.farcaster.fid}${rating.farcaster.isOG ? ' (OG)' : ''}` : rating.arkham.isKnown ? 'Arkham verified' : 'Not identified'} />
      </View>
    </View>
  );
}

function DetailBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.detailBox}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.detailSub} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

// ── Comparison Card Component ──────────────────────────────────────

function ComparisonCard({ comparison }: { comparison: KolComparison }) {
  const w1 = comparison.wallet1;
  const w2 = comparison.wallet2;
  const w1Name = w1.arkham.entityName ?? w1.farcaster?.username ?? shortAddr(w1.address);
  const w2Name = w2.arkham.entityName ?? w2.farcaster?.username ?? shortAddr(w2.address);
  const w1Color = TIER_COLORS[w1.score.tier] ?? COLORS.muted;
  const w2Color = TIER_COLORS[w2.score.tier] ?? COLORS.muted;

  const categories = [
    { label: 'ETH Value', k: 'ethValue' as const, max: 200 },
    { label: '$SIZE Holdings', k: 'sizeHoldings' as const, max: 150 },
    { label: '$SIZE Staking', k: 'sizeStaking' as const, max: 200 },
    { label: 'Blue Chip NFTs', k: 'blueChipNFTs' as const, max: 200 },
    { label: 'Arkham Intel', k: 'arkhamRecognition' as const, max: 100 },
    { label: 'Farcaster', k: 'farcasterPresence' as const, max: 150 },
  ];

  return (
    <View style={styles.ratingCard}>
      {/* Trash talk */}
      <LinearGradient
        colors={['rgba(232,80,10,0.15)', 'rgba(191,90,242,0.08)']}
        style={styles.trashTalkBanner}
      >
        <Text style={styles.trashTalkText}>{comparison.trash_talk}</Text>
      </LinearGradient>

      {/* Score comparison header */}
      <View style={styles.vsHeader}>
        <View style={styles.vsWallet}>
          <Text style={[styles.vsScore, { color: w1Color }]}>{w1.score.total}</Text>
          <Text style={[styles.vsTier, { color: w1Color }]}>{w1.score.tier}</Text>
          <Text style={styles.vsName} numberOfLines={1}>{w1Name}</Text>
        </View>
        <View style={styles.vsBadge}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <View style={styles.vsWallet}>
          <Text style={[styles.vsScore, { color: w2Color }]}>{w2.score.total}</Text>
          <Text style={[styles.vsTier, { color: w2Color }]}>{w2.score.tier}</Text>
          <Text style={styles.vsName} numberOfLines={1}>{w2Name}</Text>
        </View>
      </View>

      {/* Category bars side by side */}
      <Text style={styles.breakdownTitle}>CATEGORY BREAKDOWN</Text>
      {categories.map(cat => {
        const v1 = w1.score.breakdown[cat.k];
        const v2 = w2.score.breakdown[cat.k];
        const winner = v1 > v2 ? 1 : v2 > v1 ? 2 : 0;
        return (
          <View key={cat.k} style={styles.vsCatRow}>
            <Text style={[styles.vsCatVal, winner === 1 && { color: COLORS.green }]}>{v1}</Text>
            <View style={styles.vsCatCenter}>
              <Text style={styles.vsCatLabel}>{cat.label}</Text>
              <View style={styles.vsDualBarWrap}>
                <View style={styles.vsDualBarLeft}>
                  <View style={[styles.vsDualBarFillLeft, { width: `${(v1 / cat.max) * 100}%`, backgroundColor: w1Color }]} />
                </View>
                <View style={styles.vsDualBarRight}>
                  <View style={[styles.vsDualBarFillRight, { width: `${(v2 / cat.max) * 100}%`, backgroundColor: w2Color }]} />
                </View>
              </View>
            </View>
            <Text style={[styles.vsCatVal, winner === 2 && { color: COLORS.green }]}>{v2}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  backBtn: { width: 40, alignItems: 'flex-start' } as any,
  headerTitle: { flex: 1, color: COLORS.white, fontWeight: '800', fontSize: SIZES.md, textAlign: 'center' },
  inner: { paddingBottom: 100, paddingHorizontal: 16, gap: 16, paddingTop: 16 },

  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, backgroundColor: COLORS.card, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  tabBtnActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  tabText: { color: COLORS.muted, fontWeight: '700', fontSize: SIZES.sm },
  tabTextActive: { color: COLORS.bg },

  // Hero
  heroCard: { borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(232,80,10,0.3)', overflow: 'hidden' },
  heroInner: { padding: 24, alignItems: 'center', gap: 10 },
  heroTitle: { color: COLORS.gold, fontSize: SIZES.xl, fontWeight: '900' },
  heroSub: { color: COLORS.muted, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 },

  // Input
  inputCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16 },
  inputLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.cardBorder, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.white, fontSize: SIZES.sm, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  goBtn: { width: 48, height: 48, borderRadius: RADIUS.sm, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: COLORS.red, fontSize: SIZES.xs, marginTop: 8 },

  // Compare button
  compareBtn: { marginTop: 16, borderRadius: RADIUS.lg, overflow: 'hidden' },
  compareBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  compareBtnText: { color: '#fff', fontWeight: '900', fontSize: SIZES.base },

  // Rating card
  ratingCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, gap: 14 },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreName: { color: COLORS.white, fontWeight: '900', fontSize: SIZES.lg },
  scoreAddr: { color: COLORS.muted, fontSize: SIZES.xs, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, marginTop: 2 },
  scoreCircle: { alignItems: 'center' },
  scoreValue: { fontSize: SIZES.xxxl, fontWeight: '900' },
  scoreTier: { fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 1 },
  scoreBarBg: { height: 6, backgroundColor: COLORS.mutedDark, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 3 },

  // Breakdown
  breakdownTitle: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 4 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 120 },
  catLabel: { color: COLORS.offWhite, fontSize: SIZES.xs },
  catBarBg: { flex: 1, height: 4, backgroundColor: COLORS.mutedDark, borderRadius: 2, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 2 },
  catVal: { color: COLORS.muted, fontSize: SIZES.xs, width: 42, textAlign: 'right' },

  // Details grid
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailBox: { width: '47%' as any, backgroundColor: COLORS.bg, borderRadius: RADIUS.sm, padding: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  detailLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  detailValue: { color: COLORS.white, fontWeight: '800', fontSize: SIZES.sm },
  detailSub: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2 },

  // Comparison
  trashTalkBanner: { borderRadius: RADIUS.sm, padding: 16, alignItems: 'center' },
  trashTalkText: { color: COLORS.gold, fontWeight: '800', fontSize: SIZES.base, textAlign: 'center' },
  vsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  vsWallet: { flex: 1, alignItems: 'center' },
  vsScore: { fontSize: SIZES.xxl, fontWeight: '900' },
  vsTier: { fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 1 },
  vsName: { color: COLORS.offWhite, fontSize: SIZES.xs, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  vsBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.mutedDark, alignItems: 'center', justifyContent: 'center' },
  vsText: { color: COLORS.muted, fontWeight: '900', fontSize: SIZES.xs },

  // VS category bars
  vsCatRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vsCatVal: { color: COLORS.muted, fontSize: SIZES.xs, width: 28, textAlign: 'center', fontWeight: '800' },
  vsCatCenter: { flex: 1, gap: 2 },
  vsCatLabel: { color: COLORS.offWhite, fontSize: SIZES.xs, textAlign: 'center' },
  vsDualBarWrap: { flexDirection: 'row', height: 4, gap: 2 },
  vsDualBarLeft: { flex: 1, height: 4, backgroundColor: COLORS.mutedDark, borderRadius: 2, overflow: 'hidden', alignItems: 'flex-end' },
  vsDualBarRight: { flex: 1, height: 4, backgroundColor: COLORS.mutedDark, borderRadius: 2, overflow: 'hidden' },
  vsDualBarFillLeft: { height: '100%', borderRadius: 2, alignSelf: 'flex-end' },
  vsDualBarFillRight: { height: '100%', borderRadius: 2 },

  // Top list
  listCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, gap: 8 },
  listTitle: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  topRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  topRank: { color: COLORS.muted, fontWeight: '900', fontSize: SIZES.base, width: 32 },
  topName: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.sm },
  topAddr: { color: COLORS.muted, fontSize: SIZES.xs, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, marginTop: 1 },
  topScoreBadge: { alignItems: 'flex-end' },
  topScore: { fontWeight: '900', fontSize: SIZES.lg },
  topTier: { fontSize: SIZES.xs, fontWeight: '700' },

  // Empty
  emptyCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 32, alignItems: 'center', gap: 8, marginTop: 20 },
  emptyText: { color: COLORS.muted, fontSize: SIZES.md, fontWeight: '700' },
  emptySub: { color: COLORS.muted, fontSize: SIZES.sm },
});
