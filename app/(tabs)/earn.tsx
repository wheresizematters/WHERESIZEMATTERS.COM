import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import PageContainer from '@/components/PageContainer';

const EARN_ACTIONS = [
  { icon: 'shield-checkmark', label: 'Get Verified',       coins: 500,  desc: 'Verify your size to earn coins',          key: 'is_verified' },
  { icon: 'people',           label: 'Refer a Friend',     coins: 250,  desc: 'Earn 250 coins per friend who joins',     key: 'referral' },
  { icon: 'create',           label: 'Post to Feed',       coins: 10,   desc: 'Earn 10 coins per post (daily max)',      key: 'post' },
  { icon: 'chatbubbles',      label: 'Send a Message',     coins: 5,    desc: 'Earn 5 coins per conversation started',  key: 'message' },
  { icon: 'star',             label: 'Get Upvoted',        coins: 15,   desc: 'Earn 15 coins when your post is upvoted',key: 'upvote' },
  { icon: 'calendar',         label: 'Daily Login',        coins: 20,   desc: 'Earn 20 coins just for showing up',      key: 'login' },
];

const REWARDS = [
  { icon: 'ribbon',    label: 'Premium — 1 Month',  cost: 2500, desc: 'Redeem for 1 month of SIZE Premium' },
  { icon: 'flash',     label: 'Feed Boost',          cost: 500,  desc: 'Boost your post to the top of the feed' },
  { icon: 'shirt',     label: 'Exclusive Badge',     cost: 1000, desc: 'Unlock a rare profile badge' },
];

export default function EarnScreen() {
  const { profile, session } = useAuth();
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'earn' | 'rewards'>('earn');

  const loadCoins = useCallback(async () => {
    if (!session?.user.id) { setLoading(false); return; }
    const { data } = await supabase
      .from('profiles')
      .select('size_coins')
      .eq('id', session.user.id)
      .single();
    setCoins(data?.size_coins ?? 0);
    setLoading(false);
    setRefreshing(false);
  }, [session?.user.id]);

  useEffect(() => { loadCoins(); }, [loadCoins]);

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>SIZE.</Text>
            <Text style={styles.title}>EARN</Text>
          </View>
          <View style={styles.coinBadge}>
            <Text style={styles.coinEmoji}>💰</Text>
            {loading
              ? <ActivityIndicator size="small" color={COLORS.gold} />
              : <Text style={styles.coinCount}>{coins.toLocaleString()}</Text>
            }
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCoins(); }} tintColor={COLORS.gold} />}
        >
          {/* Balance card */}
          <LinearGradient
            colors={['#2A1A00', '#1A1000', '#0A0A0A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <LinearGradient
              colors={['rgba(201,168,76,0.2)', 'rgba(232,80,10,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.balanceInner}
            >
              <Text style={styles.balanceLabel}>YOUR $SIZE BALANCE</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.coinBig}>💰</Text>
                <Text style={styles.balanceAmount}>{loading ? '—' : coins.toLocaleString()}</Text>
              </View>
              <Text style={styles.balanceSub}>$SIZE Coins · Earn more below</Text>
            </LinearGradient>
          </LinearGradient>

          {/* Tab toggle */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'earn' && styles.tabBtnActive]}
              onPress={() => setTab('earn')}
            >
              <Text style={[styles.tabBtnText, tab === 'earn' && styles.tabBtnTextActive]}>How to Earn</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'rewards' && styles.tabBtnActive]}
              onPress={() => setTab('rewards')}
            >
              <Text style={[styles.tabBtnText, tab === 'rewards' && styles.tabBtnTextActive]}>Rewards</Text>
            </TouchableOpacity>
          </View>

          {tab === 'earn' ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>WAYS TO EARN $SIZE COINS</Text>
              {EARN_ACTIONS.map((action, i) => (
                <View key={i} style={styles.actionCard}>
                  <View style={styles.actionIcon}>
                    <Ionicons name={action.icon as any} size={20} color={COLORS.gold} />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionLabel}>{action.label}</Text>
                    <Text style={styles.actionDesc}>{action.desc}</Text>
                  </View>
                  <View style={styles.actionCoins}>
                    <Text style={styles.actionCoinText}>+{action.coins}</Text>
                    <Text style={styles.actionCoinSub}>💰</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>REDEEM YOUR COINS</Text>
              {REWARDS.map((reward, i) => (
                <TouchableOpacity key={i} style={styles.rewardCard} activeOpacity={0.8}
                  onPress={() => {}}
                >
                  <View style={[styles.actionIcon, { backgroundColor: `${COLORS.gold}25` }]}>
                    <Ionicons name={reward.icon as any} size={20} color={COLORS.gold} />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionLabel}>{reward.label}</Text>
                    <Text style={styles.actionDesc}>{reward.desc}</Text>
                  </View>
                  <View style={[styles.actionCoins, coins >= reward.cost ? styles.redeemActive : styles.redeemLocked]}>
                    <Text style={[styles.actionCoinText, { color: coins >= reward.cost ? COLORS.gold : COLORS.muted }]}>
                      {reward.cost.toLocaleString()}
                    </Text>
                    <Text style={styles.actionCoinSub}>💰</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <Text style={styles.comingSoon}>More rewards coming soon</Text>
            </View>
          )}
        </ScrollView>
      </PageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  logo: { fontSize: 14, fontWeight: '900', color: COLORS.gold, letterSpacing: 3 },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  coinBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${COLORS.gold}15`, borderWidth: 1, borderColor: `${COLORS.gold}40`, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
  coinEmoji: { fontSize: 18 },
  coinCount: { color: COLORS.gold, fontWeight: '900', fontSize: SIZES.md },
  scroll: { paddingBottom: 100 },

  // Balance card
  balanceCard: { marginHorizontal: 16, marginBottom: 20, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: `${COLORS.gold}35`, overflow: 'hidden' },
  balanceInner: { padding: 28, alignItems: 'center', gap: 8 },
  balanceLabel: { color: COLORS.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coinBig: { fontSize: 40 },
  balanceAmount: { color: COLORS.white, fontSize: 52, fontWeight: '900', letterSpacing: -1 },
  balanceSub: { color: COLORS.muted, fontSize: SIZES.sm },

  // Tab bar
  tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 3 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: RADIUS.full },
  tabBtnActive: { backgroundColor: `${COLORS.gold}20`, borderWidth: 1, borderColor: `${COLORS.gold}50` },
  tabBtnText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '700' },
  tabBtnTextActive: { color: COLORS.gold },

  // Section
  section: { paddingHorizontal: 16, gap: 10 },
  sectionLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },

  // Action cards
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14 },
  rewardCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14 },
  actionIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: `${COLORS.gold}15`, borderWidth: 1, borderColor: `${COLORS.gold}25`, alignItems: 'center', justifyContent: 'center' },
  actionInfo: { flex: 1 },
  actionLabel: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  actionDesc: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2 },
  actionCoins: { alignItems: 'center' },
  actionCoinText: { color: COLORS.gold, fontWeight: '900', fontSize: SIZES.md },
  actionCoinSub: { fontSize: 14 },
  redeemActive: {},
  redeemLocked: { opacity: 0.45 },
  comingSoon: { color: COLORS.muted, fontSize: SIZES.xs, textAlign: 'center', paddingVertical: 16 },
});
