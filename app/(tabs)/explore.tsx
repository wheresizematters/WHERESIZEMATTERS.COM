import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import PageContainer from '@/components/PageContainer';
import { getTrendingDickCoins, DickCoin } from '@/lib/dickcoin';
import { formatMarketCap } from '@/lib/token-info';

type SortKey = 'volume' | 'holders' | 'fees' | 'newest';

export default function ExploreScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const [coins, setCoins] = useState<DickCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('volume');

  const loadData = useCallback(async () => {
    const data = await getTrendingDickCoins();
    setCoins(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter + sort
  const filtered = coins
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q) || c.creatorUsername?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (sort) {
        case 'volume': return b.totalVolume - a.totalVolume;
        case 'holders': return b.holderCount - a.holderCount;
        case 'fees': return b.totalFeesEarned - a.totalFeesEarned;
        case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: return 0;
      }
    });

  return (
    <SafeAreaView style={s.container}>
      <PageContainer>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.logo}>SIZE.</Text>
            <Text style={s.title}>EXPLORE</Text>
          </View>
          {profile?.is_verified && (
            <TouchableOpacity style={s.launchBtn} onPress={() => router.push('/launch-dickcoin' as any)}>
              <Ionicons name="add" size={16} color={COLORS.bg} />
              <Text style={s.launchBtnText}>Launch</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={16} color={COLORS.muted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search coins, creators..."
              placeholderTextColor={COLORS.mutedDark}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Sort tabs */}
        <View style={s.sortBar}>
          {([
            { key: 'volume' as SortKey, label: 'Volume' },
            { key: 'holders' as SortKey, label: 'Holders' },
            { key: 'fees' as SortKey, label: 'Fees' },
            { key: 'newest' as SortKey, label: 'Newest' },
          ]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.sortBtn, sort === t.key && s.sortBtnActive]}
              onPress={() => setSort(t.key)}
            >
              <Text style={[s.sortBtnText, sort === t.key && s.sortBtnTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={c => c.contractAddress}
            contentContainerStyle={s.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.gold} />}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={s.coinCard}
                onPress={() => (() => { if (typeof window !== 'undefined') window.location.href = `/coin/${item.contractAddress}`; })()}
                activeOpacity={0.7}
              >
                <View style={s.coinRank}>
                  <Text style={s.coinRankNum}>#{index + 1}</Text>
                </View>
                <View style={s.coinInfo}>
                  <View style={s.coinNameRow}>
                    <Text style={s.coinName}>{item.name}</Text>
                    <Text style={s.coinTicker}>{item.ticker}</Text>
                  </View>
                  <Text style={s.coinCreator}>by @{item.creatorUsername}</Text>
                </View>
                <View style={s.coinStats}>
                  <View style={s.coinStatRow}>
                    <Text style={s.coinStatLabel}>Vol</Text>
                    <Text style={s.coinStatValue}>{item.totalVolume > 0 ? formatMarketCap(item.totalVolume) : '--'}</Text>
                  </View>
                  <View style={s.coinStatRow}>
                    <Text style={s.coinStatLabel}>Holders</Text>
                    <Text style={s.coinStatValue}>{item.holderCount}</Text>
                  </View>
                  <View style={s.coinStatRow}>
                    <Text style={s.coinStatLabel}>Fees</Text>
                    <Text style={s.coinStatValue}>{item.totalFeesEarned > 0 ? `${item.totalFeesEarned.toFixed(2)} ETH` : '--'}</Text>
                  </View>
                </View>
                <View style={s.coinActions}>
                  {item.hasStaking && (
                    <View style={s.stakingBadge}>
                      <Ionicons name="trending-up" size={10} color={COLORS.green} />
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="planet-outline" size={40} color={COLORS.muted} />
                <Text style={s.emptyTitle}>No DickCoins launched yet</Text>
                <Text style={s.emptyDesc}>Be the first to launch a personal memecoin on SIZE.</Text>
                {profile?.is_verified && (
                  <TouchableOpacity style={s.emptyCta} onPress={() => router.push('/launch-dickcoin' as any)}>
                    <Ionicons name="rocket" size={16} color={COLORS.bg} />
                    <Text style={s.emptyCtaText}>Launch a DickCoin</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </PageContainer>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  logo: { fontSize: 28, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  title: { fontSize: SIZES.base, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
  launchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8 },
  launchBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.sm },

  // Search
  searchRow: { paddingHorizontal: 16, marginBottom: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, color: COLORS.white, fontSize: SIZES.sm },

  // Sort
  sortBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 12 },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  sortBtnActive: { backgroundColor: `${COLORS.gold}20`, borderColor: `${COLORS.gold}50` },
  sortBtnText: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '700' },
  sortBtnTextActive: { color: COLORS.gold },

  // List
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  coinCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 12, marginBottom: 8 },
  coinRank: { width: 32, alignItems: 'center' },
  coinRankNum: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '800' },
  coinInfo: { flex: 1 },
  coinNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coinName: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  coinTicker: { color: COLORS.gold, fontSize: SIZES.xs, fontWeight: '600' },
  coinCreator: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 1 },
  coinStats: { gap: 2 },
  coinStatRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coinStatLabel: { color: COLORS.mutedDark, fontSize: 9, fontWeight: '600', width: 40 },
  coinStatValue: { color: COLORS.offWhite, fontSize: SIZES.xs, fontWeight: '700' },
  coinActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stakingBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: `${COLORS.green}15`, borderWidth: 1, borderColor: `${COLORS.green}30`, alignItems: 'center', justifyContent: 'center' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '700', textAlign: 'center' },
  emptyDesc: { color: COLORS.muted, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 20, marginTop: 8 },
  emptyCtaText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.sm },
});
