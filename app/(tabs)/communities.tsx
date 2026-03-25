import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import PageContainer from '@/components/PageContainer';
import { getMyCircleJerks, getTrendingDickCoins, getTierInfo, DickCoin } from '@/lib/dickcoin';
import { supabase } from '@/lib/supabase';

export default function CommunitiesScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();

  const [tab, setTab] = useState<'mine' | 'trending'>('mine');
  const [myCoins, setMyCoins] = useState<DickCoin[]>([]);
  const [trending, setTrending] = useState<DickCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token ?? '';
    const [mine, trend] = await Promise.all([
      getMyCircleJerks(token),
      getTrendingDickCoins(),
    ]);
    setMyCoins(mine);
    setTrending(trend);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const data = tab === 'mine' ? myCoins : trending;

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>SIZE.</Text>
            <Text style={styles.title}>CIRCLE JERKS</Text>
          </View>
          {profile?.is_verified && (
            <TouchableOpacity
              style={styles.launchBtn}
              onPress={() => router.push('/launch-dickcoin' as any)}
            >
              <Ionicons name="add" size={16} color={COLORS.bg} />
              <Text style={styles.launchBtnText}>Launch</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab toggle */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'mine' && styles.tabBtnActive]}
            onPress={() => setTab('mine')}
          >
            <Text style={[styles.tabBtnText, tab === 'mine' && styles.tabBtnTextActive]}>My Circle Jerks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'trending' && styles.tabBtnActive]}
            onPress={() => setTab('trending')}
          >
            <Text style={[styles.tabBtnText, tab === 'trending' && styles.tabBtnTextActive]}>Trending</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => item.contractAddress}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.gold} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.coinRow}
                onPress={() => router.push(`/circle-jerk/${item.contractAddress}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.coinInfo}>
                  <Text style={styles.coinName}>{item.name}</Text>
                  <Text style={styles.coinTicker}>{item.ticker}</Text>
                </View>
                <View style={styles.coinStats}>
                  <Text style={styles.coinHolders}>{item.holderCount} holders</Text>
                  {item.hasStaking && (
                    <View style={styles.stakingPill}>
                      <Ionicons name="trending-up" size={10} color={COLORS.green} />
                      <Text style={styles.stakingText}>Staking</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={40} color={COLORS.muted} />
                <Text style={styles.emptyTitle}>
                  {tab === 'mine' ? "You're not in any Circle Jerks yet" : 'No trending coins right now'}
                </Text>
                <Text style={styles.emptyDesc}>
                  {tab === 'mine'
                    ? "Buy a DickCoin to join its community, or launch your own."
                    : "Check back soon or launch the first one."}
                </Text>
                {tab === 'mine' && profile?.is_verified && (
                  <TouchableOpacity
                    style={styles.emptyCta}
                    onPress={() => router.push('/launch-dickcoin' as any)}
                  >
                    <Ionicons name="rocket-outline" size={16} color={COLORS.bg} />
                    <Text style={styles.emptyCtaText}>Launch a DickCoin</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  logo: { fontSize: 28, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  title: { fontSize: SIZES.base, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
  launchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8 },
  launchBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.sm },

  // Tab bar
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.card, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 3 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: RADIUS.full },
  tabBtnActive: { backgroundColor: `${COLORS.gold}20`, borderWidth: 1, borderColor: `${COLORS.gold}50` },
  tabBtnText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '700' },
  tabBtnTextActive: { color: COLORS.gold },

  // List
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14, marginBottom: 8 },
  coinInfo: { flex: 1 },
  coinName: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  coinTicker: { color: COLORS.gold, fontSize: SIZES.xs, fontWeight: '600', marginTop: 1 },
  coinStats: { alignItems: 'flex-end', gap: 4 },
  coinHolders: { color: COLORS.muted, fontSize: SIZES.xs },
  stakingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${COLORS.green}15`, borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: `${COLORS.green}30` },
  stakingText: { color: COLORS.green, fontSize: 9, fontWeight: '700' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '700', textAlign: 'center' },
  emptyDesc: { color: COLORS.muted, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 20, marginTop: 8 },
  emptyCtaText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.sm },
});
