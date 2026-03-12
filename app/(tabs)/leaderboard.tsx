import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { fetchLeaderboard } from '@/lib/api';
import { usePurchase } from '@/context/PurchaseContext';
import PaywallModal from '@/components/PaywallModal';
import { LeaderboardEntry } from '@/lib/types';

const FILTERS = ['Global', 'USA', '18–24', '25–34', '35–44'];

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Text style={styles.medal}>🥇</Text>;
  if (rank === 2) return <Text style={styles.medal}>🥈</Text>;
  if (rank === 3) return <Text style={styles.medal}>🥉</Text>;
  return <Text style={styles.rankNum}>#{rank}</Text>;
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const tier = getSizeTier(entry.size_inches);
  return (
    <View style={styles.row}>
      <View style={styles.rankCol}><RankMedal rank={entry.rank} /></View>
      <View style={styles.userCol}>
        <View style={styles.usernameRow}>
          <Text style={styles.username}>@{entry.username}</Text>
          {entry.is_verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓</Text>
            </View>
          )}
        </View>
        <Text style={styles.country}>{entry.country}</Text>
      </View>
      <View style={styles.sizeCol}>
        <Text style={[styles.sizeNum, { color: tier.color }]}>{entry.size_inches.toFixed(1)}"</Text>
        <Text style={styles.tierEmoji}>{tier.emoji}</Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { isPremium } = usePurchase();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Global');
  const [showPaywall, setShowPaywall] = useState(false);

  const visibleEntries = isPremium ? entries : entries.slice(0, 10);

  const load = useCallback(async () => {
    const data = await fetchLeaderboard();
    setEntries(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const top3 = entries.slice(0, 3);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>LEADERBOARD</Text>
        <Ionicons name="trophy" size={22} color={COLORS.gold} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      ) : (
        <>
          {/* Podium */}
          {top3.length === 3 && (
            <View style={styles.podium}>
              <View style={styles.podiumItem}>
                <Text style={styles.podiumEmoji}>🥈</Text>
                <Text style={styles.podiumName}>@{top3[1].username}</Text>
                <Text style={[styles.podiumSize, { color: getSizeTier(top3[1].size_inches).color }]}>{top3[1].size_inches.toFixed(1)}"</Text>
                <View style={[styles.podiumBar, { height: 60, backgroundColor: '#888' }]} />
              </View>
              <View style={styles.podiumItem}>
                <Text style={styles.podiumEmoji}>👑</Text>
                <Text style={styles.podiumName}>@{top3[0].username}</Text>
                <Text style={[styles.podiumSize, { color: COLORS.gold }]}>{top3[0].size_inches.toFixed(1)}"</Text>
                <View style={[styles.podiumBar, { height: 80, backgroundColor: COLORS.gold }]} />
              </View>
              <View style={styles.podiumItem}>
                <Text style={styles.podiumEmoji}>🥉</Text>
                <Text style={styles.podiumName}>@{top3[2].username}</Text>
                <Text style={[styles.podiumSize, { color: getSizeTier(top3[2].size_inches).color }]}>{top3[2].size_inches.toFixed(1)}"</Text>
                <View style={[styles.podiumBar, { height: 44, backgroundColor: '#a0522d' }]} />
              </View>
            </View>
          )}

          {/* Filters */}
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

          <FlatList
            data={visibleEntries}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.gold} />
            }
            renderItem={({ item }) => <LeaderboardRow entry={item} />}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListFooterComponent={!isPremium && entries.length > 10 ? (
              <TouchableOpacity style={styles.unlockBanner} onPress={() => setShowPaywall(true)}>
                <Ionicons name="lock-closed" size={18} color={COLORS.gold} />
                <Text style={styles.unlockText}>Unlock full Top 100 — Premium</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.gold} />
              </TouchableOpacity>
            ) : null}
          />
          <PaywallModal
            visible={showPaywall}
            onClose={() => setShowPaywall(false)}
            trigger="Unlock the full Top 100 leaderboard"
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  podiumItem: { alignItems: 'center', flex: 1, gap: 4 },
  podiumEmoji: { fontSize: 24 },
  podiumName: { color: COLORS.white, fontSize: SIZES.xs, fontWeight: '700', textAlign: 'center' },
  podiumSize: { fontSize: SIZES.base, fontWeight: '900' },
  podiumBar: { width: '100%', borderRadius: 4 },
  filterList: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  filterChipActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}20` },
  filterText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '600' },
  filterTextActive: { color: COLORS.gold },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  sep: { height: 1, backgroundColor: COLORS.cardBorder },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  rankCol: { width: 40, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { color: COLORS.muted, fontSize: SIZES.md, fontWeight: '700' },
  userCol: { flex: 1 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  verifiedBadge: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: COLORS.bg, fontSize: 9, fontWeight: '900' },
  country: { color: COLORS.muted, fontSize: SIZES.sm, marginTop: 2 },
  sizeCol: { alignItems: 'flex-end' },
  sizeNum: { fontSize: SIZES.lg, fontWeight: '900' },
  tierEmoji: { fontSize: SIZES.lg },
  unlockBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, padding: 16, backgroundColor: `${COLORS.gold}15`, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}40` },
  unlockText: { color: COLORS.gold, fontWeight: '700', fontSize: SIZES.md, flex: 1 },
});
