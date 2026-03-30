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
import { useFeatureFlags } from '@/context/FeatureFlagsContext';
import { getToken, getApiUrl } from '@/lib/supabase';
import PageContainer from '@/components/PageContainer';
import PaywallModal from '@/components/PaywallModal';
import { switchToBase } from '@/lib/web3';
import {
  getStakeInfo, StakeInfoResult, TIER_NAMES, formatTokenAmount,
  claimStakingRewards,
} from '@/lib/staking';

const EARN_ACTIONS = [
  { icon: 'shield-checkmark', label: 'Get Verified',       pct: '10×', desc: 'Highest weight in the daily reward pool',                  key: 'is_verified' },
  { icon: 'people',           label: 'Refer a Friend',     pct: '8×',  desc: 'Each referral earns weight + 5% of their staking rewards forever', key: 'referral' },
  { icon: 'star',             label: 'Get Upvoted',        pct: '5×',  desc: 'Quality content earns more — cap: 20/day',                key: 'upvote' },
  { icon: 'create',           label: 'Post to Feed',       pct: '3×',  desc: 'Every post earns a proportional share — cap: 5/day',      key: 'post' },
  { icon: 'calendar',         label: 'Daily Login',        pct: '1×',  desc: 'Show up daily to claim your share',                       key: 'login' },
  { icon: 'chatbubbles',      label: 'Send a Message',     pct: '1×',  desc: 'Active conversations earn from the pool — cap: 10/day',   key: 'message' },
];

const REWARDS = [
  { icon: 'flash',     label: 'Feed Boost',    cost: '5K $SIZE',  desc: 'Burn 5,000 $SIZE to boost your post to the top' },
];

export default function EarnScreen() {
  const { profile, session, updateProfile } = useAuth();
  const { isPremium } = usePurchase();
  const flags = useFeatureFlags();
  const router = useRouter();
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'earn' | 'rewards'>('earn');
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(profile?.wallet_address ?? null);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [stakeInfo, setStakeInfo] = useState<StakeInfoResult | null>(null);

  const loadCoins = useCallback(async () => {
    if (!session?.user.id) { setLoading(false); return; }
    setCoins(profile?.size_coins ?? 0);
    setLoading(false);
    setRefreshing(false);
  }, [session?.user.id, profile?.size_coins]);

  useEffect(() => { loadCoins(); }, [loadCoins]);

  // Load staking info when wallet is connected
  useEffect(() => {
    if (!walletAddress) { setStakeInfo(null); return; }
    getStakeInfo(walletAddress).then(info => setStakeInfo(info)).catch(() => {});
  }, [walletAddress]);

  async function connectWallet() {
    if (Platform.OS !== 'web') return;
    const eth = (window as any).ethereum ?? (window as any).okxwallet;
    if (!eth) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.alert(
          'To connect your wallet on mobile, open this site inside your wallet app:\n\n' +
          '• MetaMask → Browser tab → wheresizematters.com\n' +
          '• OKX Wallet → Discover → enter URL\n' +
          '• Phantom → Browse → enter URL\n' +
          '• Coinbase Wallet → Browser → enter URL\n\n' +
          'Mobile browsers can\'t access wallet extensions directly.'
        );
      } else {
        window.alert('No wallet detected. Install MetaMask, Coinbase Wallet, or OKX Wallet browser extension.');
      }
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

    if (reward.label === 'Get Verified') {
      router.push('/verify' as any);
      return;
    }

    if (reward.label === 'Feed Boost') {
      if (!window.confirm('Burn 5,000 $SIZE to boost your next post?')) return;
      window.alert('Feed Boost activated! Your next post will be prioritized.');
      return;
    }

    if (reward.label === 'AI Logo Gen') {
      router.push('/launch-dickcoin' as any);
      return;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Text style={styles.logo}>SIZE.</Text>
            <Text style={styles.title}>GROW</Text>
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
              <Text style={styles.balanceSub}>Your share of daily trading fees</Text>
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
                <Text style={styles.walletConnectedText}>Connected · $SIZE is live on Base</Text>
              </View>
            ) : (
              <Text style={styles.walletHint}>Works with MetaMask, Coinbase Wallet, and all browser wallets</Text>
            )}
          </View>

          {/* Staking section inline */}
          {flags.staking && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>STAKING</Text>
            <View style={styles.stakingCard}>
              <View style={styles.stakingRow}>
                <View style={styles.stakingStat}>
                  <Text style={styles.stakingStatLabel}>YOUR TIER</Text>
                  <Text style={styles.stakingStatValue}>{stakeInfo ? TIER_NAMES[stakeInfo.tier] ?? '--' : '--'}</Text>
                </View>
                <View style={styles.stakingStatDivider} />
                <View style={styles.stakingStat}>
                  <Text style={styles.stakingStatLabel}>STAKED</Text>
                  <Text style={styles.stakingStatValue}>{stakeInfo ? formatTokenAmount(stakeInfo.stakedAmount) : '0'}</Text>
                </View>
                <View style={styles.stakingStatDivider} />
                <View style={styles.stakingStat}>
                  <Text style={styles.stakingStatLabel}>REWARDS</Text>
                  <Text style={styles.stakingStatValue}>{stakeInfo ? formatTokenAmount(stakeInfo.pendingRewards) : '0'}</Text>
                </View>
              </View>
              {stakeInfo && stakeInfo.pendingRewards > 0n && (
                <TouchableOpacity
                  style={[styles.stakingBtn, { marginBottom: 4 }]}
                  onPress={async () => {
                    try { await claimStakingRewards(); } catch (e: any) {
                      if (typeof window !== 'undefined') window.alert(e?.message ?? 'Claim failed');
                    }
                  }}
                >
                  <Text style={styles.stakingBtnText}>Claim Rewards</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.stakingBtn} onPress={() => router.push('/staking' as any)}>
                <Text style={styles.stakingBtnText}>Manage Staking</Text>
              </TouchableOpacity>
            </View>
          </View>
          )}

          {/* $SIZE Token — chart + trade */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>$SIZE TOKEN</Text>
            {flags.charting && (
            <TouchableOpacity
              style={styles.tokenCard}
              activeOpacity={0.85}
              onPress={() => router.push('/coin/0x21F2D807421e456be5b4BFcC30E5278049eC8b07' as any)}
            >
              <View style={styles.tokenCardHeader}>
                <Ionicons name="analytics" size={20} color={COLORS.gold} />
                <Text style={styles.tokenCardTitle}>View Chart + Trade</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
              </View>
              <Text style={styles.tokenCardDesc}>Live price chart, swap widget, market data, and Circle Jerk community — all in one place.</Text>
            </TouchableOpacity>
            )}

            {/* Quick buy section */}
            {flags.quickBuy && (
            <View style={styles.quickBuyCard}>
              <Text style={styles.quickBuyTitle}>Quick Buy $SIZE</Text>
              <View style={styles.quickBuyRow}>
                {['0.01', '0.05', '0.1', '0.5'].map(amt => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.quickBuyBtn}
                    onPress={async () => {
                      const eth = (window as any)?.ethereum;
                      if (!eth) { window.alert('Connect a wallet to buy'); return; }
                      if (window.confirm(`Buy $SIZE with ${amt} ETH? (1% fee to protocol)`)) {
                        router.push('/coin/0x21F2D807421e456be5b4BFcC30E5278049eC8b07' as any);
                      }
                    }}
                  >
                    <Text style={styles.quickBuyBtnText}>{amt} ETH</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.buyFee}>1% of swaps via SIZE. goes to the protocol</Text>
            </View>
            )}
          </View>

          {/* Launch DickCoin CTA */}
          {flags.launchDickCoin && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CREATE</Text>
            <TouchableOpacity
              style={styles.launchCta}
              activeOpacity={0.85}
              onPress={() => router.push('/launch-dickcoin' as any)}
            >
              <View style={styles.launchCtaInner}>
                <Ionicons name="rocket" size={22} color={COLORS.bg} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.launchCtaTitle}>Launch a DickCoin</Text>
                  <Text style={styles.launchCtaSub}>Deploy your personal memecoin on Base. Earn 90% of trading fees. Get a Circle Jerk community instantly.</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
          )}

          {/* Tab toggle */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'earn' && styles.tabBtnActive]}
              onPress={() => setTab('earn')}
            >
              <Text style={[styles.tabBtnText, tab === 'earn' && styles.tabBtnTextActive]}>How to Grow</Text>
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
                    <Text style={styles.actionCoinText}>{action.pct}</Text>
                    <Ionicons name="cash-outline" size={14} color={COLORS.gold} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>BURN $SIZE</Text>
              {REWARDS.map((reward, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.rewardCard, false && styles.rewardCardLocked]}
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
                  <View style={[styles.actionCoins, true ? styles.redeemActive : styles.redeemLocked]}>
                    {redeeming === reward.label
                      ? <ActivityIndicator size="small" color={COLORS.gold} />
                      : <>
                          <Text style={[styles.actionCoinText, { color: true ? COLORS.gold : COLORS.muted }]}>
                            {reward.cost}
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

  // Buy $SIZE
  buyCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}30`, padding: 16, gap: 10 },
  buyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buyTitle: { color: COLORS.white, fontWeight: '800', fontSize: SIZES.md },
  buyDesc: { color: COLORS.muted, fontSize: SIZES.xs, lineHeight: 18 },
  // Token card
  tokenCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}30`, padding: 14, marginBottom: 8 },
  tokenCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tokenCardTitle: { flex: 1, color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  tokenCardDesc: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 6, lineHeight: 16 },
  quickBuyCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14, gap: 10 },
  quickBuyTitle: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  quickBuyRow: { flexDirection: 'row', gap: 8 },
  quickBuyBtn: { flex: 1, backgroundColor: `${COLORS.gold}15`, borderWidth: 1, borderColor: `${COLORS.gold}35`, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  quickBuyBtnText: { color: COLORS.gold, fontWeight: '800', fontSize: SIZES.sm },
  buyFee: { color: COLORS.mutedDark, fontSize: 9, textAlign: 'center' as any },

  // Section
  section: { paddingHorizontal: 16, marginBottom: 16 },

  // Staking inline
  stakingCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, gap: 12 },
  stakingRow: { flexDirection: 'row', alignItems: 'center' },
  stakingStat: { flex: 1, alignItems: 'center' },
  stakingStatLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  stakingStatValue: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '900', marginTop: 4 },
  stakingStatDivider: { width: 1, height: 28, backgroundColor: COLORS.cardBorder },
  stakingBtn: { backgroundColor: `${COLORS.gold}20`, borderRadius: RADIUS.md, borderWidth: 1, borderColor: `${COLORS.gold}40`, paddingVertical: 10, alignItems: 'center' },
  stakingBtnText: { color: COLORS.gold, fontWeight: '700', fontSize: SIZES.sm },

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
