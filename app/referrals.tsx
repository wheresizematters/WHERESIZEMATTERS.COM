import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { fetchUserRank, getMyWallets, fetchFollowersLeaderboard, fetchReferralStats, fetchReferralList, RankResult } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

function formatNetWorth(val: number): string {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${Math.round(val).toLocaleString()}`;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ReferralsScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const [rankResult, setRankResult] = useState<RankResult | null>(null);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const [xFollowers, setXFollowers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [referralCount, setReferralCount] = useState(0);
  const [referralEarnings, setReferralEarnings] = useState(0);
  const [referrals, setReferrals] = useState<{ username: string; joined: string; isVerified: boolean }[]>([]);

  const userId = session?.user.id;
  const referralLink = userId ? `https://wheresizematters.com/invite/${userId}` : '';

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    async function load() {
      const [rank, wallets, followers, stats, list] = await Promise.all([
        fetchUserRank(userId!),
        getMyWallets(),
        fetchFollowersLeaderboard(),
        fetchReferralStats(),
        fetchReferralList(),
      ]);
      setRankResult(rank.rank > 0 ? rank : null);
      setTotalNetWorth(wallets.totalNetWorth);
      setReferralCount(stats.totalReferred);
      setReferralEarnings(stats.totalRewardEarned);
      setReferrals(list.referrals.map((r: any) => ({
        username: r.username ?? 'unknown',
        joined: r.joinedAt ?? r.createdAt,
        isVerified: !!r.isVerified,
      })));
      const me = followers.find(f => f.id === userId);
      if (me) setXFollowers(me.x_followers);
      else if ((profile as any)?.x_followers) setXFollowers((profile as any).x_followers);
      setLoading(false);
    }
    load();
  }, [userId]);

  function buildShareMessage(): string {
    const rank = rankResult?.rank ?? 0;
    const rankStr = rank > 0 ? `#${rank.toLocaleString()}` : 'unranked';
    const nw = totalNetWorth > 0 ? formatNetWorth(totalNetWorth) : '$0';
    const staked = '0'; // placeholder — would come from staking API
    const xf = xFollowers > 0 ? formatFollowers(xFollowers) : '0';
    const refCount = referralCount;

    return `I'm ranked ${rankStr} on SIZE. \u2014 the SocialFi measuring contest.\n\n\u{1F3C6} Net Worth: ${nw}\n\u{1F4CA} Staked: ${staked} $SIZE\n\u{1F465} X Followers: ${xf}\n\u{1F517} Referrals: ${refCount} people\n\nJoin with my link and I earn 5% of your staking rewards forever.\n\n${referralLink}`;
  }

  async function handleShare() {
    const message = buildShareMessage();
    if (Platform.OS === 'web') {
      try {
        await navigator.share({ title: 'Join me on SIZE.', text: message, url: referralLink });
        return;
      } catch {}
      try {
        await navigator.clipboard.writeText(message);
        window.alert('Share message copied to clipboard!');
      } catch {
        window.alert(`Share:\n${referralLink}`);
      }
      return;
    }
    await Share.share({ message, url: referralLink });
  }

  async function handleCopyLink() {
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Referrals</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingWrap}>
          <Text style={{ color: COLORS.muted }}>Sign in to see your referrals</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); } else { router.push('/(tabs)' as any); } }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Referrals</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inner}>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.gold} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Hero card */}
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
                <Ionicons name="people" size={32} color={COLORS.gold} />
                <Text style={styles.heroTitle}>Earn from Referrals</Text>
                <Text style={styles.heroSub}>
                  5% of your referrals' staking rewards {'\u2014'} forever.{'\n'}
                  Every person who joins with your link earns you passive $SIZE.
                </Text>
              </LinearGradient>
            </LinearGradient>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{referralCount}</Text>
                <Text style={styles.statLabel}>Referred</Text>
              </View>
              <View style={[styles.statBox, styles.statBoxBorder]}>
                <Text style={styles.statVal}>{referralEarnings.toLocaleString()}</Text>
                <Text style={styles.statLabel}>$SIZE Earned</Text>
              </View>
            </View>

            {/* Referral link */}
            <View style={styles.linkCard}>
              <Text style={styles.linkCardLabel}>YOUR REFERRAL LINK</Text>
              <View style={styles.linkRow}>
                <Text style={styles.linkText} numberOfLines={1}>{referralLink}</Text>
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLink}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={COLORS.bg} />
                  <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Big share button */}
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <LinearGradient
                colors={['#FF6B2B', '#E8500A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.shareBtnGrad}
              >
                <Ionicons name="share-social" size={20} color="#fff" />
                <Text style={styles.shareBtnText}>Share Your Stats</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* How it works */}
            <View style={styles.howCard}>
              <Text style={styles.howTitle}>HOW IT WORKS</Text>
              {[
                { icon: 'link-outline' as const, text: 'Share your unique referral link with friends' },
                { icon: 'person-add-outline' as const, text: 'They sign up using your link' },
                { icon: 'flash-outline' as const, text: 'You earn 500 $SIZE per signup + 5% of their staking rewards' },
                { icon: 'infinite-outline' as const, text: 'Rewards continue forever — no cap, no expiration' },
              ].map((step, i) => (
                <View key={i} style={styles.howStep}>
                  <View style={styles.howStepIcon}>
                    <Ionicons name={step.icon} size={16} color={COLORS.gold} />
                  </View>
                  <Text style={styles.howStepText}>{step.text}</Text>
                </View>
              ))}
            </View>

            {/* Referral list */}
            {referrals.length > 0 && (
              <View style={styles.listCard}>
                <Text style={styles.listTitle}>YOUR REFERRALS</Text>
                {referrals.map((ref, i) => (
                  <View key={i} style={[styles.listRow, i < referrals.length - 1 && styles.listRowBorder]}>
                    <View style={styles.listAvatar}>
                      <Text style={styles.listAvatarText}>{ref.username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.listUsername}>@{ref.username}</Text>
                        {ref.isVerified && (
                          <Ionicons name="checkmark-circle" size={12} color={COLORS.gold} />
                        )}
                      </View>
                      <Text style={styles.listJoined}>{timeAgo(ref.joined)}</Text>
                    </View>
                    <Text style={styles.listEarned}>+500 $SIZE</Text>
                  </View>
                ))}
              </View>
            )}

            {referrals.length === 0 && (
              <View style={styles.emptyCard}>
                <Ionicons name="person-add-outline" size={36} color={COLORS.muted} />
                <Text style={styles.emptyText}>No referrals yet</Text>
                <Text style={styles.emptySub}>Share your link to start earning</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  backBtn: { width: 40, alignItems: 'flex-start' } as any,
  headerTitle: { flex: 1, color: COLORS.white, fontWeight: '800', fontSize: SIZES.md, textAlign: 'center' },
  inner: { paddingBottom: 100, paddingHorizontal: 16, gap: 16, paddingTop: 16 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Hero
  heroCard: { borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(232,80,10,0.3)', overflow: 'hidden' },
  heroInner: { padding: 24, alignItems: 'center', gap: 10 },
  heroTitle: { color: COLORS.gold, fontSize: SIZES.xl, fontWeight: '900' },
  heroSub: { color: COLORS.muted, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 },

  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  statBox: { flex: 1, padding: 20, alignItems: 'center' },
  statBoxBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.cardBorder },
  statVal: { color: COLORS.gold, fontSize: SIZES.xxl, fontWeight: '900' },
  statLabel: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 4, letterSpacing: 0.5 },

  // Link card
  linkCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, gap: 10 },
  linkCardLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkText: { flex: 1, color: COLORS.offWhite, fontSize: SIZES.sm, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.gold, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
  copyBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.xs },

  // Share button
  shareBtn: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  shareBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  shareBtnText: { color: '#fff', fontWeight: '900', fontSize: SIZES.lg, letterSpacing: 0.5 },

  // How it works
  howCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, gap: 14 },
  howTitle: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  howStep: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howStepIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: `${COLORS.gold}15`, alignItems: 'center', justifyContent: 'center' },
  howStepText: { flex: 1, color: COLORS.offWhite, fontSize: SIZES.sm, lineHeight: 20 },

  // Referral list
  listCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, gap: 12 },
  listTitle: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  listAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.mutedDark, alignItems: 'center', justifyContent: 'center' },
  listAvatarText: { color: COLORS.white, fontWeight: '800', fontSize: SIZES.sm },
  listUsername: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.sm },
  listJoined: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 1 },
  listEarned: { color: COLORS.gold, fontWeight: '800', fontSize: SIZES.sm },

  // Empty state
  emptyCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { color: COLORS.muted, fontSize: SIZES.md, fontWeight: '700' },
  emptySub: { color: COLORS.muted, fontSize: SIZES.sm },
});
