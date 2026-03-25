import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import PageContainer from '@/components/PageContainer';
import StakingTierBadge from '@/components/StakingTierBadge';
import {
  getStakeInfo, approveStaking, stakeTokens, unstakeTokens,
  claimStakingRewards, formatTokenAmount, parseTokenAmount,
  TIER_NAMES, TIER_COLORS, TIER_APY, TIER_BOOST, TIER_MIN,
  STAKING_CONTRACT_ADDRESS, StakeInfoResult,
} from '@/lib/staking';
import { getSizeTokenBalance } from '@/lib/web3';
import { fetchStakingPosition, fetchActivityScore, fetchStakingHistory } from '@/lib/staking-api';
import type { StakingEventAPI, ActivityScoreAPI } from '@/lib/staking-api';

type Action = 'stake' | 'unstake';

export default function StakingScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const walletAddress = profile?.wallet_address ?? null;

  const [stakeInfo, setStakeInfo] = useState<StakeInfoResult | null>(null);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [activity, setActivity] = useState<ActivityScoreAPI | null>(null);
  const [history, setHistory] = useState<StakingEventAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [action, setAction] = useState<Action>('stake');
  const [amount, setAmount] = useState('');
  const [txPending, setTxPending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!walletAddress) { setLoading(false); return; }
    try {
      const [info, bal, act, hist] = await Promise.all([
        getStakeInfo(walletAddress),
        getSizeTokenBalance(walletAddress),
        fetchActivityScore(walletAddress),
        fetchStakingHistory(walletAddress),
      ]);
      setStakeInfo(info);
      setTokenBalance(bal);
      setActivity(act);
      setHistory(hist?.events ?? []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [walletAddress]);

  useEffect(() => { loadData(); }, [loadData]);

  const tier = stakeInfo?.tier ?? 0;
  const stakedDisplay = stakeInfo ? formatTokenAmount(stakeInfo.stakedAmount) : '0';
  const rewardsDisplay = stakeInfo ? formatTokenAmount(stakeInfo.pendingRewards) : '0';
  const baseAPY = TIER_APY[tier] ?? 0;
  const actMul = activity?.activityMultiplier ?? 1.0;
  const effectiveAPY = Math.round(baseAPY * actMul * 100) / 100;

  // Next tier info
  const nextTier = tier < 4 ? tier + 1 : null;
  const nextTierMin = nextTier ? TIER_MIN[nextTier] : null;
  const stakedNum = stakeInfo ? Number(stakeInfo.stakedAmount) / 1e18 : 0;
  const progressToNext = nextTierMin ? Math.min(stakedNum / nextTierMin, 1) : 1;

  async function handleAction() {
    if (!walletAddress || !amount || txPending) return;
    const wei = parseTokenAmount(amount);
    if (wei === 0n) return;

    setTxPending(true);
    setTxHash(null);
    setTxError(null);

    try {
      if (action === 'stake') {
        // Approve first, then stake
        await approveStaking(wei);
        const hash = await stakeTokens(wei);
        setTxHash(hash);
      } else {
        const hash = await unstakeTokens(wei);
        setTxHash(hash);
      }
      setAmount('');
      // Refresh after a short delay for chain state to update
      setTimeout(() => loadData(), 3000);
    } catch (err: any) {
      if (err?.code !== 4001) { // user rejected
        setTxError(err?.message?.slice(0, 100) ?? 'Transaction failed');
      }
    } finally {
      setTxPending(false);
    }
  }

  async function handleClaim() {
    if (!walletAddress || txPending) return;
    setTxPending(true);
    setTxHash(null);
    setTxError(null);
    try {
      const hash = await claimStakingRewards();
      setTxHash(hash);
      setTimeout(() => loadData(), 3000);
    } catch (err: any) {
      if (err?.code !== 4001) {
        setTxError(err?.message?.slice(0, 100) ?? 'Claim failed');
      }
    } finally {
      setTxPending(false);
    }
  }

  function setMaxAmount() {
    if (action === 'stake') {
      // Use raw balance string from web3 (already formatted)
      setAmount(tokenBalance.replace(/,/g, ''));
    } else if (stakeInfo) {
      const staked = Number(stakeInfo.stakedAmount) / 1e18;
      setAmount(Math.floor(staked).toString());
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.logo}>SIZE.</Text>
            <Text style={styles.title}>STAKE</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.gold} />}
        >
          {!walletAddress ? (
            <View style={styles.noWallet}>
              <Ionicons name="wallet-outline" size={48} color={COLORS.muted} />
              <Text style={styles.noWalletTitle}>Connect your wallet first</Text>
              <Text style={styles.noWalletSub}>Go to the Earn tab and connect your wallet to start staking</Text>
              <TouchableOpacity style={styles.goEarnBtn} onPress={() => router.push('/(tabs)/earn')}>
                <Text style={styles.goEarnText}>Go to Earn</Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={COLORS.gold} />
            </View>
          ) : (
            <>
              {/* Overview card */}
              <LinearGradient
                colors={['#2A1A00', '#1A0800', '#0A0A0A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.overviewCard}
              >
                <LinearGradient
                  colors={[`${TIER_COLORS[tier]}20`, 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.overviewInner}
                >
                  <View style={styles.overviewTop}>
                    <View>
                      <Text style={styles.overviewLabel}>STAKED</Text>
                      <Text style={styles.overviewAmount}>{stakedDisplay}</Text>
                      <Text style={styles.overviewUnit}>$SIZE</Text>
                    </View>
                    <StakingTierBadge tier={tier} />
                  </View>

                  <View style={styles.overviewStats}>
                    <View style={styles.overviewStat}>
                      <Text style={styles.statLabel}>PENDING</Text>
                      <Text style={styles.statValue}>{rewardsDisplay}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.overviewStat}>
                      <Text style={styles.statLabel}>APY</Text>
                      <Text style={[styles.statValue, { color: COLORS.green }]}>{effectiveAPY}%</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.overviewStat}>
                      <Text style={styles.statLabel}>BOOST</Text>
                      <Text style={[styles.statValue, { color: TIER_COLORS[tier] }]}>{TIER_BOOST[tier] ?? 0}x</Text>
                    </View>
                  </View>

                  {/* Claim button */}
                  {stakeInfo && stakeInfo.pendingRewards > 0n && (
                    <TouchableOpacity style={styles.claimBtn} onPress={handleClaim} disabled={txPending}>
                      {txPending ? (
                        <ActivityIndicator size="small" color={COLORS.bg} />
                      ) : (
                        <Text style={styles.claimBtnText}>Claim {rewardsDisplay} $SIZE</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </LinearGradient>
              </LinearGradient>

              {/* Tier progress */}
              {nextTier && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>TIER PROGRESS</Text>
                  <View style={styles.progressCard}>
                    <View style={styles.progressLabels}>
                      <Text style={[styles.progressTier, { color: TIER_COLORS[tier] }]}>
                        {TIER_NAMES[tier]}
                      </Text>
                      <Text style={[styles.progressTier, { color: TIER_COLORS[nextTier] }]}>
                        {TIER_NAMES[nextTier]}
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progressToNext * 100}%`, backgroundColor: TIER_COLORS[tier] }]} />
                    </View>
                    <Text style={styles.progressSub}>
                      {formatTokenAmount(BigInt(Math.floor(stakedNum * 1e18)))} / {(nextTierMin! / 1_000_000).toFixed(0)}M $SIZE to {TIER_NAMES[nextTier]}
                    </Text>
                  </View>
                </View>
              )}

              {/* Stake / Unstake controls */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>
                  {action === 'stake' ? 'STAKE $SIZE' : 'UNSTAKE $SIZE'}
                </Text>
                <View style={styles.actionCard}>
                  {/* Toggle */}
                  <View style={styles.actionToggle}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, action === 'stake' && styles.toggleBtnActive]}
                      onPress={() => { setAction('stake'); setAmount(''); }}
                    >
                      <Text style={[styles.toggleText, action === 'stake' && styles.toggleTextActive]}>Stake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, action === 'unstake' && styles.toggleBtnActive]}
                      onPress={() => { setAction('unstake'); setAmount(''); }}
                    >
                      <Text style={[styles.toggleText, action === 'unstake' && styles.toggleTextActive]}>Unstake</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Balance line */}
                  <Text style={styles.balanceLine}>
                    {action === 'stake' ? `Wallet: ${tokenBalance} $SIZE` : `Staked: ${stakedDisplay} $SIZE`}
                  </Text>

                  {/* Input */}
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor={COLORS.mutedDark}
                      keyboardType="numeric"
                      value={amount}
                      onChangeText={setAmount}
                    />
                    <TouchableOpacity style={styles.maxBtn} onPress={setMaxAmount}>
                      <Text style={styles.maxBtnText}>MAX</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Submit */}
                  <TouchableOpacity
                    style={[styles.submitBtn, (!amount || txPending) && styles.submitBtnDisabled]}
                    onPress={handleAction}
                    disabled={!amount || txPending}
                  >
                    {txPending ? (
                      <ActivityIndicator size="small" color={COLORS.bg} />
                    ) : (
                      <Text style={styles.submitBtnText}>
                        {action === 'stake' ? 'Approve & Stake' : 'Unstake'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* TX feedback */}
                  {txHash && (
                    <View style={styles.txFeedback}>
                      <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
                      <Text style={styles.txHashText} numberOfLines={1}>
                        TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                      </Text>
                    </View>
                  )}
                  {txError && (
                    <View style={styles.txFeedback}>
                      <Ionicons name="close-circle" size={16} color={COLORS.red} />
                      <Text style={[styles.txHashText, { color: COLORS.red }]} numberOfLines={2}>{txError}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Activity multiplier */}
              {activity && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>ACTIVITY MULTIPLIER</Text>
                  <View style={styles.activityCard}>
                    <View style={styles.activityTotal}>
                      <Text style={styles.activityTotalLabel}>YOUR MULTIPLIER</Text>
                      <Text style={styles.activityTotalValue}>{activity.activityMultiplier}x</Text>
                    </View>
                    <View style={styles.activityRows}>
                      <ActivityRow label="Login Streak" value={`${activity.loginStreak} days`} />
                      <ActivityRow label="Posts This Week" value={activity.postsThisWeek.toString()} />
                      <ActivityRow label="Verified" value={activity.isVerified ? 'Yes' : 'No'} color={activity.isVerified ? COLORS.green : COLORS.muted} />
                      <ActivityRow label="Referrals" value={activity.referralCount.toString()} />
                    </View>
                  </View>
                </View>
              )}

              {/* Tier table */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>STAKING TIERS</Text>
                <View style={styles.tierTableCard}>
                  {[1, 2, 3, 4].map((t) => (
                    <View key={t} style={[styles.tierRow, tier === t && styles.tierRowActive, t === 4 && styles.tierRowLast]}>
                      <View style={styles.tierNameCell}>
                        <View style={[styles.tierDot, { backgroundColor: TIER_COLORS[t] }]} />
                        <Text style={[styles.tierName, { color: TIER_COLORS[t] }]}>{TIER_NAMES[t]}</Text>
                      </View>
                      <Text style={styles.tierCell}>{(TIER_MIN[t] / 1_000_000) < 1 ? `${TIER_MIN[t] / 1_000}K` : `${TIER_MIN[t] / 1_000_000}M`}+</Text>
                      <Text style={[styles.tierCell, { color: COLORS.gold }]}>{TIER_BOOST[t]}x</Text>
                      <Text style={[styles.tierCell, { color: TIER_COLORS[t], fontWeight: '900' }]}>{TIER_APY[t]}%</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* History */}
              {history.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>RECENT ACTIVITY</Text>
                  {history.slice(0, 10).map((e, i) => (
                    <View key={i} style={styles.historyRow}>
                      <Ionicons
                        name={e.type === 'staked' ? 'arrow-down-circle' : e.type === 'unstaked' ? 'arrow-up-circle' : 'gift'}
                        size={18}
                        color={e.type === 'staked' ? COLORS.green : e.type === 'claimed' ? COLORS.gold : COLORS.red}
                      />
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyType}>{e.type.charAt(0).toUpperCase() + e.type.slice(1)}</Text>
                        <Text style={styles.historyDate}>{new Date(e.timestamp * 1000).toLocaleDateString()}</Text>
                      </View>
                      <Text style={styles.historyAmount}>
                        {e.type === 'unstaked' ? '-' : '+'}{formatTokenAmount(BigInt(e.amount))}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </PageContainer>
    </SafeAreaView>
  );
}

function ActivityRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.actRow}>
      <Text style={styles.actLabel}>{label}</Text>
      <Text style={[styles.actValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  headerTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  logo: { fontSize: 24, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  title: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
  scroll: { paddingBottom: 100 },
  loadingWrap: { flex: 1, paddingTop: 100, alignItems: 'center' },

  // No wallet
  noWallet: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  noWalletTitle: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '700' },
  noWalletSub: { color: COLORS.muted, fontSize: SIZES.sm, textAlign: 'center' },
  goEarnBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  goEarnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.md },

  // Overview card
  overviewCard: { marginHorizontal: 16, marginBottom: 20, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: `${COLORS.gold}35`, overflow: 'hidden' },
  overviewInner: { padding: 24, gap: 16 },
  overviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  overviewLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  overviewAmount: { color: COLORS.white, fontSize: 36, fontWeight: '900', marginTop: 4 },
  overviewUnit: { color: COLORS.gold, fontSize: SIZES.sm, fontWeight: '700', letterSpacing: 1 },
  overviewStats: { flexDirection: 'row', alignItems: 'center' },
  overviewStat: { flex: 1, alignItems: 'center' },
  statLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  statValue: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '900', marginTop: 4 },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.cardBorder },
  claimBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  claimBtnText: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.md },

  // Section
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionHeader: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 10 },

  // Tier progress
  progressCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, gap: 8 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTier: { fontSize: SIZES.sm, fontWeight: '800' },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: COLORS.cardBorder, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressSub: { color: COLORS.muted, fontSize: SIZES.xs },

  // Action card
  actionCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, gap: 12 },
  actionToggle: { flexDirection: 'row', backgroundColor: COLORS.bg, borderRadius: RADIUS.full, padding: 3 },
  toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.full },
  toggleBtnActive: { backgroundColor: `${COLORS.gold}20`, borderWidth: 1, borderColor: `${COLORS.gold}50` },
  toggleText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '700' },
  toggleTextActive: { color: COLORS.gold },
  balanceLine: { color: COLORS.muted, fontSize: SIZES.xs },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.white, fontSize: SIZES.lg, fontWeight: '700' },
  maxBtn: { backgroundColor: `${COLORS.gold}20`, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: `${COLORS.gold}40` },
  maxBtnText: { color: COLORS.gold, fontWeight: '800', fontSize: SIZES.xs },
  submitBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.md },
  txFeedback: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txHashText: { color: COLORS.green, fontSize: SIZES.xs, fontFamily: 'monospace', flex: 1 },

  // Activity
  activityCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, gap: 12 },
  activityTotal: { alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  activityTotalLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  activityTotalValue: { color: COLORS.gold, fontSize: 32, fontWeight: '900', marginTop: 4 },
  activityRows: { gap: 8 },
  actRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  actLabel: { color: COLORS.muted, fontSize: SIZES.sm },
  actValue: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '700' },

  // Tier table
  tierTableCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 12 },
  tierRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  tierRowActive: { backgroundColor: `${COLORS.gold}08`, borderRadius: RADIUS.md },
  tierRowLast: { borderBottomWidth: 0 },
  tierNameCell: { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierName: { fontSize: SIZES.sm, fontWeight: '800' },
  tierCell: { flex: 1, fontSize: SIZES.sm, fontWeight: '600', color: COLORS.offWhite },

  // History
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: COLORS.cardBorder },
  historyInfo: { flex: 1 },
  historyType: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '700' },
  historyDate: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 1 },
  historyAmount: { color: COLORS.gold, fontSize: SIZES.md, fontWeight: '900' },
});
