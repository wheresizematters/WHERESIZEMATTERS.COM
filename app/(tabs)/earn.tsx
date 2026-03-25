import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePurchase } from '@/context/PurchaseContext';
import { getToken, getApiUrl } from '@/lib/supabase';
import PageContainer from '@/components/PageContainer';
import PaywallModal from '@/components/PaywallModal';
import { switchToBase } from '@/lib/web3';

const EARN_ACTIONS = [
  { icon: 'shield-checkmark', label: 'Get Verified',       weight: 5, desc: 'Highest reward weight — verified users earn more',  key: 'is_verified' },
  { icon: 'people',           label: 'Refer a Friend',     weight: 4, desc: 'Bring users in, earn a share of the daily pool',   key: 'referral' },
  { icon: 'create',           label: 'Post to Feed',       weight: 2, desc: 'Every post earns you a share of daily rewards',    key: 'post' },
  { icon: 'chatbubbles',      label: 'Send a Message',     weight: 1, desc: 'Active conversations earn daily pool share',       key: 'message' },
  { icon: 'star',             label: 'Get Upvoted',        weight: 3, desc: 'Quality content earns more from the fee pool',     key: 'upvote' },
  { icon: 'calendar',         label: 'Daily Login',        weight: 1, desc: 'Show up daily to claim your share',               key: 'login' },
];

const REWARDS = [
  { icon: 'ribbon',    label: 'Premium — 1 Month',  cost: 250000,  desc: 'Redeem for 1 month of SIZE Premium' },
  { icon: 'flash',     label: 'Feed Boost',          cost: 50000,   desc: 'Boost your post to the top of the feed' },
  { icon: 'shirt',     label: 'Exclusive Badge',     cost: 100000,  desc: 'Unlock a rare profile badge' },
];

export default function EarnScreen() {
  const { profile, session, updateProfile } = useAuth();
  const { isPremium } = usePurchase();
  const router = useRouter();
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'earn' | 'rewards'>('earn');
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(profile?.wallet_address ?? null);
  const [connectingWallet, setConnectingWallet] = useState(false);

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

  async function connectWallet() {
    if (Platform.OS !== 'web') return;
    const eth = (window as any).ethereum;
    if (!eth) {
      window.alert('No wallet detected. Install MetaMask or Coinbase Wallet to connect.');
      return;
    }
    setConnectingWallet(true);
    try {
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      if (address) {
        setWalletAddress(address);
        await updateProfile({ wallet_address: address } as any);
        // Switch to Base mainnet automatically
        await switchToBase();
      }
    } catch (err: any) {
      if (err?.code !== 4001) {
        window.alert('Failed to connect wallet. Please try again.');
      }
    } finally {
      setConnectingWallet(false);
    }
  }

  async function disconnectWallet() {
    setWalletAddress(null);
    await updateProfile({ wallet_address: null } as any);
  }

  function truncateAddress(addr: string) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  async function redeemReward(reward: typeof REWARDS[number]) {
    if (!session?.user.id) return;
    if (coins < reward.cost) {
      const msg = `You need ${(reward.cost - coins).toLocaleString()} more coins to redeem this reward.`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Not enough coins', msg);
      return;
    }

    const confirm = await new Promise<boolean>(resolve => {
      const msg = `Redeem "${reward.label}" for ${reward.cost.toLocaleString()} coins?`;
      if (Platform.OS === 'web') {
        resolve(window.confirm(msg));
      } else {
        Alert.alert('Confirm Redemption', msg, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Redeem', style: 'default', onPress: () => resolve(true) },
        ]);
      }
    });
    if (!confirm) return;

    setRedeeming(reward.label);

    // Build atomic update — deduct coins + grant reward in one DB call
    const updateData: Record<string, any> = { size_coins: coins - reward.cost };
    if (reward.label === 'Premium — 1 Month') {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      updateData.is_premium = true;
      updateData.premium_expires_at = expiresAt;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', session.user.id);

    setRedeeming(null);

    if (error) {
      if (Platform.OS === 'web') window.alert('Redemption failed. Please try again.');
      else Alert.alert('Error', 'Redemption failed. Please try again.');
      return;
    }

    setCoins(prev => prev - reward.cost);

    if (reward.label === 'Premium — 1 Month') {
      if (Platform.OS === 'web') window.alert('Premium unlocked for 30 days! Refresh to see your benefits.');
      else Alert.alert('Premium Unlocked', 'You have 30 days of SIZE. Premium.');
    } else if (reward.label === 'Feed Boost') {
      if (Platform.OS === 'web') window.alert('Feed Boost activated! Your next post will be prioritized in the feed.');
      else Alert.alert('Feed Boost Activated', 'Your next post will be prioritized in the feed.');
    } else if (reward.label === 'Exclusive Badge') {
      if (Platform.OS === 'web') window.alert('Exclusive badge coming soon! We\'ll add it to your profile shortly.');
      else Alert.alert('Badge Incoming', 'Your exclusive badge will appear on your profile soon.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Text style={styles.logo}>SIZE.</Text>
            <Text style={styles.title}>EARN</Text>
          </View>
          <View style={styles.coinBadge}>
            <Ionicons name="cash-outline" size={18} color={COLORS.gold} />
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
                <Ionicons name="cash" size={40} color={COLORS.gold} />
                <Text style={styles.balanceAmount}>{loading ? '—' : coins.toLocaleString()}</Text>
              </View>
              <Text style={styles.balanceSub}>Your share of daily fee rewards</Text>
            </LinearGradient>
          </LinearGradient>

          {/* Wallet card */}
          <View style={styles.walletCard}>
            <View style={styles.walletTop}>
              <View style={styles.walletIconWrap}>
                <Ionicons name="wallet-outline" size={20} color={COLORS.gold} />
              </View>
              <View style={styles.walletInfo}>
                <Text style={styles.walletTitle}>$SIZE Wallet</Text>
                {walletAddress
                  ? <Text style={styles.walletAddress}>{truncateAddress(walletAddress)}</Text>
                  : <Text style={styles.walletSub}>Connect to receive $SIZE tokens</Text>
                }
              </View>
              {walletAddress ? (
                <TouchableOpacity style={styles.walletDisconnectBtn} onPress={disconnectWallet}>
                  <Text style={styles.walletDisconnectText}>Disconnect</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.walletConnectBtn} onPress={connectWallet} disabled={connectingWallet}>
                  {connectingWallet
                    ? <ActivityIndicator size="small" color={COLORS.bg} />
                    : <Text style={styles.walletConnectText}>Connect</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
            {walletAddress ? (
              <View style={styles.walletConnectedBadge}>
                <View style={styles.walletDot} />
                <Text style={styles.walletConnectedText}>Connected · Ready for $SIZE token launch</Text>
              </View>
            ) : (
              <Text style={styles.walletHint}>Works with MetaMask, Coinbase Wallet, and all browser wallets</Text>
            )}
          </View>

          {/* Tokenomics link */}
          <TouchableOpacity
            style={styles.tokenomicsLink}
            activeOpacity={0.8}
            onPress={() => router.push('/tokenomics' as any)}
          >
            <View style={styles.tokenomicsLeft}>
              <Ionicons name="logo-usd" size={18} color={COLORS.gold} />
              <View>
                <Text style={styles.tokenomicsTitle}>$SIZE Tokenomics</Text>
                <Text style={styles.tokenomicsSub}>100B supply · Base chain · Learn more</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.gold} />
          </TouchableOpacity>

          {/* Staking link */}
          <TouchableOpacity
            style={styles.tokenomicsLink}
            activeOpacity={0.8}
            onPress={() => router.push('/staking' as any)}
          >
            <View style={styles.tokenomicsLeft}>
              <Ionicons name="trending-up" size={18} color={COLORS.gold} />
              <View>
                <Text style={styles.tokenomicsTitle}>Stake $SIZE</Text>
                <Text style={styles.tokenomicsSub}>Earn up to 80% APY · Hold more, earn more</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.gold} />
          </TouchableOpacity>

          {/* Launch DickCoin CTA */}
          <TouchableOpacity
            style={styles.launchCta}
            activeOpacity={0.85}
            onPress={() => router.push('/launch-dickcoin' as any)}
          >
            <View style={styles.launchCtaInner}>
              <Ionicons name="rocket" size={22} color={COLORS.bg} />
              <View style={{ flex: 1 }}>
                <Text style={styles.launchCtaTitle}>Launch a DickCoin</Text>
                <Text style={styles.launchCtaSub}>Deploy your personal memecoin on Base. Earn 90% of all trading fees. Your community gets a Circle Jerk instantly.</Text>
              </View>
            </View>
          </TouchableOpacity>

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
              <Text style={styles.sectionLabel}>HOW REWARDS WORK</Text>
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
                    <Text style={styles.actionCoinText}>{action.weight}x</Text>
                    <Ionicons name="cash-outline" size={14} color={COLORS.gold} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>REDEEM YOUR COINS</Text>
              {REWARDS.map((reward, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.rewardCard, coins < reward.cost && styles.rewardCardLocked]}
                  activeOpacity={0.8}
                  disabled={redeeming === reward.label}
                  onPress={() => redeemReward(reward)}
                >
                  <View style={[styles.actionIcon, { backgroundColor: `${COLORS.gold}25` }]}>
                    <Ionicons name={reward.icon as any} size={20} color={COLORS.gold} />
                  </View>
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionLabel}>{reward.label}</Text>
                    <Text style={styles.actionDesc}>{reward.desc}</Text>
                  </View>
                  <View style={[styles.actionCoins, coins >= reward.cost ? styles.redeemActive : styles.redeemLocked]}>
                    {redeeming === reward.label
                      ? <ActivityIndicator size="small" color={COLORS.gold} />
                      : <>
                          <Text style={[styles.actionCoinText, { color: coins >= reward.cost ? COLORS.gold : COLORS.muted }]}>
                            {reward.cost.toLocaleString()}
                          </Text>
                          <Ionicons name="cash-outline" size={14} color={COLORS.gold} />
                        </>
                    }
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
  headerTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  logo: { fontSize: 28, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  title: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
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
  rewardCardLocked: { opacity: 0.5 },
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

  // Wallet card
  walletCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}30`, padding: 16, gap: 10 },
  walletTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: `${COLORS.gold}15`, borderWidth: 1, borderColor: `${COLORS.gold}25`, alignItems: 'center', justifyContent: 'center' },
  walletIcon: { fontSize: 20 },
  walletInfo: { flex: 1 },
  walletTitle: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  walletAddress: { color: COLORS.gold, fontSize: SIZES.sm, fontWeight: '600', marginTop: 2, fontFamily: 'monospace' },
  walletSub: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2 },
  walletConnectBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 8 },
  walletConnectText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.sm },
  walletDisconnectBtn: { backgroundColor: `${COLORS.red}15`, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: `${COLORS.red}30` },
  walletDisconnectText: { color: COLORS.red, fontWeight: '700', fontSize: SIZES.xs },
  walletConnectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  walletConnectedText: { color: COLORS.green, fontSize: SIZES.xs, fontWeight: '600' },
  walletHint: { color: COLORS.mutedDark, fontSize: SIZES.xs, lineHeight: 16 },

  // Launch DickCoin CTA
  launchCta: { marginHorizontal: 16, marginBottom: 16, backgroundColor: COLORS.gold, borderRadius: RADIUS.lg, padding: 16 },
  launchCtaInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  launchCtaTitle: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.base },
  launchCtaSub: { color: 'rgba(10,10,10,0.7)', fontSize: SIZES.xs, marginTop: 2, lineHeight: 16 },

  // Tokenomics link
  tokenomicsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}30`, padding: 14 },
  tokenomicsLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tokenomicsTitle: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  tokenomicsSub: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 1 },
});
