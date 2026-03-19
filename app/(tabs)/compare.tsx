import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import PageContainer from '@/components/PageContainer';
import { searchUsers, fetchUserPercentile, fetchTotalUserCount } from '@/lib/api';
import { WORLD_AVERAGE } from '@/lib/mockData';
import { useAuth } from '@/context/AuthContext';

function SizeBar({ size, maxSize, label, color, isYou }: {
  size: number; maxSize: number; label: string; color: string; isYou: boolean;
}) {
  const pct = Math.min((size / maxSize) * 100, 100);
  return (
    <View style={styles.barWrap}>
      <View style={styles.barLabelRow}>
        <Text style={[styles.barLabel, isYou && styles.barLabelYou]}>{label}</Text>
        <Text style={[styles.barSize, { color }]}>{size.toFixed(1)}"</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function CompareScreen() {
  const { profile } = useAuth();
  const mySize = profile?.size_inches ?? 6.0;
  const myTier = getSizeTier(mySize);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [compareTarget, setCompareTarget] = useState<any | null>(null);
  const [percentile, setPercentile] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchUserPercentile(mySize).then(setPercentile).catch(() => setPercentile(null));
    fetchTotalUserCount().then(setTotalUsers).catch(() => setTotalUsers(0));
  }, [mySize]);

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsers(search);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const maxSize = compareTarget
    ? Math.max(mySize, compareTarget.size_inches, WORLD_AVERAGE) * 1.15
    : Math.max(mySize, WORLD_AVERAGE) * 1.15;

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inner}>
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Text style={styles.logo}>SIZE.</Text>
            <Text style={styles.title}>COMPARE</Text>
          </View>
        </View>

        {/* My size */}
        <View style={[styles.myCard, { borderColor: myTier.color }]}>
          <Text style={styles.myLabel}>YOUR SIZE</Text>
          <Text style={[styles.mySize, { color: myTier.color }]}>{mySize.toFixed(1)}"</Text>
          <View style={[styles.tierPill, { borderColor: myTier.color }]}>
            <Text style={styles.tierEmoji}>{myTier.emoji}</Text>
            <Text style={[styles.tierText, { color: myTier.color }]}>{myTier.label}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{percentile !== null ? `${percentile}%` : '—'}</Text>
            <Text style={styles.statLabel}>Bigger than</Text>
            <Text style={styles.statSub}>of users</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {mySize >= WORLD_AVERAGE ? `+${(mySize - WORLD_AVERAGE).toFixed(1)}"` : `-${(WORLD_AVERAGE - mySize).toFixed(1)}"`}
            </Text>
            <Text style={styles.statLabel}>vs. Average</Text>
            <Text style={styles.statSub}>{mySize >= WORLD_AVERAGE ? 'above avg' : 'below avg'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalUsers.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
            <Text style={styles.statSub}>in database</Text>
          </View>
        </View>

        {/* Comparison bars */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COMPARISON</Text>
          <View style={styles.bars}>
            <SizeBar size={mySize} maxSize={maxSize} label="You" color={myTier.color} isYou={true} />
            <SizeBar size={WORLD_AVERAGE} maxSize={maxSize} label="World Avg" color={COLORS.muted} isYou={false} />
            {compareTarget && (
              <SizeBar
                size={compareTarget.size_inches} maxSize={maxSize}
                label={`@${compareTarget.username}`}
                color={getSizeTier(compareTarget.size_inches).color}
                isYou={false}
              />
            )}
          </View>
        </View>

        {/* Search */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COMPARE WITH USER</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={COLORS.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search username..."
              placeholderTextColor={COLORS.muted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            {searching && <ActivityIndicator size="small" color={COLORS.gold} />}
            {compareTarget && !searching && (
              <TouchableOpacity onPress={() => { setCompareTarget(null); setSearch(''); }}>
                <Ionicons name="close-circle" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            )}
          </View>

          {searchResults.length > 0 && (
            <View style={styles.results}>
              {searchResults.map((user: any) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.resultRow}
                  onPress={() => { setCompareTarget(user); setSearch(''); setSearchResults([]); }}
                >
                  <View>
                    <Text style={styles.resultName}>@{user.username}</Text>
                    {user.rank && <Text style={styles.resultRank}>Rank #{user.rank}</Text>}
                  </View>
                  <Text style={[styles.resultSize, { color: getSizeTier(user.size_inches).color }]}>
                    {user.size_inches.toFixed(1)}"
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {compareTarget && (
            <View style={styles.compareResult}>
              <Text style={styles.compareText}>
                {mySize >= compareTarget.size_inches
                  ? `You're ${(mySize - compareTarget.size_inches).toFixed(1)}" bigger than @${compareTarget.username}`
                  : `@${compareTarget.username} is ${(compareTarget.size_inches - mySize).toFixed(1)}" bigger than you`
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      </PageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  title: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  logo: { fontSize: 28, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  myCard: { marginHorizontal: 16, padding: 24, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, alignItems: 'center', marginBottom: 16, gap: 10 },
  myLabel: { color: COLORS.muted, fontSize: SIZES.xs, letterSpacing: 3, textTransform: 'uppercase' },
  mySize: { fontSize: SIZES.huge, fontWeight: '900', lineHeight: 56 },
  tierPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6 },
  tierEmoji: { fontSize: 16 },
  tierText: { fontSize: SIZES.sm, fontWeight: '700', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14, alignItems: 'center', gap: 2 },
  statValue: { color: COLORS.gold, fontSize: SIZES.xl, fontWeight: '900' },
  statLabel: { color: COLORS.white, fontSize: SIZES.xs, fontWeight: '700', letterSpacing: 0.5 },
  statSub: { color: COLORS.muted, fontSize: SIZES.xs },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '700', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 },
  bars: { gap: 16 },
  barWrap: { gap: 6 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barLabel: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '600' },
  barLabelYou: { color: COLORS.white, fontWeight: '800' },
  barSize: { fontSize: SIZES.md, fontWeight: '900' },
  barTrack: { height: 10, backgroundColor: COLORS.card, borderRadius: RADIUS.full, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.cardBorder },
  barFill: { height: '100%', borderRadius: RADIUS.full },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, color: COLORS.white, fontSize: SIZES.md },
  results: { marginTop: 8, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  resultName: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  resultRank: { color: COLORS.muted, fontSize: SIZES.sm, marginTop: 2 },
  resultSize: { fontSize: SIZES.lg, fontWeight: '900' },
  compareResult: { marginTop: 12, backgroundColor: `${COLORS.gold}15`, borderRadius: RADIUS.md, borderWidth: 1, borderColor: `${COLORS.gold}40`, padding: 14 },
  compareText: { color: COLORS.gold, fontSize: SIZES.md, fontWeight: '700', textAlign: 'center' },
});
