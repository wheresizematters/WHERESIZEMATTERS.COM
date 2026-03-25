import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import PageContainer from '@/components/PageContainer';
import { BASE_CHAIN_ID } from '@/lib/web3';

const TOTAL_SUPPLY = '100,000,000,000';
const CHAIN = 'Base';

const ALLOCATION = [
  { label: 'Liquidity Pool',    pct: 100, color: COLORS.gold, icon: 'water', desc: '100% of supply goes to DEX liquidity — no team tokens, no airdrops, no insiders' },
];

const FEE_SPLIT = [
  { label: 'Back to Community',  pct: 75, color: COLORS.gold,   icon: 'people',      desc: 'Distributed as $SIZE to stakers and active users — proportional to holdings and activity' },
  { label: 'Protocol Revenue',   pct: 25, color: COLORS.blue,   icon: 'flash',       desc: 'ETH fees fund development, infrastructure, and growth' },
];

const STAKING_TIERS = [
  { label: 'Grower',    min: '100K',   max: '1M',    boost: '1x',   apy: '8%',   color: COLORS.muted },
  { label: 'Shower',    min: '1M',     max: '10M',   boost: '2x',   apy: '18%',  color: COLORS.blue },
  { label: 'Shlong',    min: '10M',  max: '100M',  boost: '5x',   apy: '40%',  color: COLORS.purple },
  { label: 'Whale',     min: '100M',   max: '1B+',   boost: '12x',  apy: '80%',  color: COLORS.gold },
];

const EARN_RATES = [
  { action: 'Get Verified',    tokens: '50,000',  icon: 'shield-checkmark', note: 'One-time bonus' },
  { action: 'Daily Login',     tokens: '2,000',    icon: 'calendar',         note: 'Per day' },
  { action: 'Post to Feed',    tokens: '1,000',    icon: 'create',           note: 'Daily cap applies' },
  { action: 'Get Upvoted',     tokens: '1,500',    icon: 'star',             note: 'Per upvote received' },
  { action: 'Send a Message',  tokens: '500',      icon: 'chatbubbles',      note: 'Per new conversation' },
  { action: 'Refer a Friend',  tokens: '25,000',   icon: 'people',           note: 'Per signup' },
];

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function AllocationBar() {
  return (
    <View style={styles.barContainer}>
      <View style={styles.bar}>
        {ALLOCATION.map((a, i) => (
          <View key={i} style={[styles.barSegment, { flex: a.pct, backgroundColor: a.color }]} />
        ))}
      </View>
      {ALLOCATION.map((a, i) => (
        <View key={i} style={styles.allocRow}>
          <View style={[styles.allocDot, { backgroundColor: a.color }]} />
          <View style={styles.allocInfo}>
            <Text style={styles.allocLabel}>{a.label}</Text>
            <Text style={styles.allocDesc}>{a.desc}</Text>
          </View>
          <Text style={[styles.allocPct, { color: a.color }]}>{a.pct}%</Text>
        </View>
      ))}
    </View>
  );
}

export default function TokenomicsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("/(tabs)" as any)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.logo}>SIZE.</Text>
            <Text style={styles.title}>$SIZE</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Hero */}
          <LinearGradient
            colors={['#2A1A00', '#1A0800', '#0A0A0A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <LinearGradient
              colors={['rgba(232,80,10,0.25)', 'rgba(201,168,76,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.heroInner}
            >
              <Ionicons name="logo-usd" size={48} color={COLORS.gold} />
              <Text style={styles.heroTitle}>$SIZE Token</Text>
              <Text style={styles.heroSub}>The reward token for the SIZE. ecosystem</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>TOTAL SUPPLY</Text>
                  <Text style={styles.heroStatValue}>100B</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>CHAIN</Text>
                  <Text style={styles.heroStatValue}>{CHAIN}</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>TYPE</Text>
                  <Text style={styles.heroStatValue}>ERC-20</Text>
                </View>
              </View>
            </LinearGradient>
          </LinearGradient>

          {/* What is $SIZE */}
          <View style={styles.section}>
            <SectionHeader title="WHAT IS $SIZE?" />
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                $SIZE is a 100% fair launch token. No team allocation. No presale. No insiders. The entire supply goes to liquidity — every token in circulation was bought or earned.
              </Text>
              <Text style={[styles.infoText, { marginTop: 10 }]}>
                Every trade generates fees. 75% of those fees are redistributed as $SIZE to the community — stakers and active users. The more you hold and stake, the bigger your cut. Early users who stack and stake compound an outsized advantage.
              </Text>
              <Text style={[styles.infoText, { marginTop: 10 }]}>
                Gift tokens to other users in-app. Connect your wallet or don't — no crypto experience required to use SIZE., but holders eat first.
              </Text>
            </View>
          </View>

          {/* Allocation */}
          <View style={styles.section}>
            <SectionHeader title="TOKEN ALLOCATION" />
            <View style={styles.infoCard}>
              <Text style={styles.supplyLine}>Total Supply: <Text style={styles.supplyBold}>{TOTAL_SUPPLY} $SIZE</Text></Text>
              <AllocationBar />
              <View style={styles.fairLaunchBadge}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
                <Text style={styles.fairLaunchText}>Fair launch — no team allocation, no presale, no insiders</Text>
              </View>
            </View>
          </View>

          {/* Fee split */}
          <View style={styles.section}>
            <SectionHeader title="TRADING FEE DISTRIBUTION" />
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Every $SIZE trade generates fees. 75% flows back to the community as $SIZE tokens — distributed to stakers and active users. 25% is taken as ETH to fund protocol development.
              </Text>
              <View style={styles.feeSplitContainer}>
                <View style={styles.bar}>
                  {FEE_SPLIT.map((f, i) => (
                    <View key={i} style={[styles.barSegment, { flex: f.pct, backgroundColor: f.color }]} />
                  ))}
                </View>
                {FEE_SPLIT.map((f, i) => (
                  <View key={i} style={styles.allocRow}>
                    <View style={[styles.allocDot, { backgroundColor: f.color }]} />
                    <View style={styles.allocInfo}>
                      <Text style={styles.allocLabel}>{f.label}</Text>
                      <Text style={styles.allocDesc}>{f.desc}</Text>
                    </View>
                    <Text style={[styles.allocPct, { color: f.color }]}>{f.pct}%</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.tierFootnote}>
                The more $SIZE you hold and stake, the larger your share of the 75% community pool.
              </Text>
            </View>
          </View>

          {/* Earn rates */}
          <View style={styles.section}>
            <SectionHeader title="HOW TO EARN" />
            {EARN_RATES.map((e, i) => (
              <View key={i} style={styles.earnCard}>
                <View style={styles.earnIcon}>
                  <Ionicons name={e.icon as any} size={18} color={COLORS.gold} />
                </View>
                <View style={styles.earnInfo}>
                  <Text style={styles.earnAction}>{e.action}</Text>
                  <Text style={styles.earnNote}>{e.note}</Text>
                </View>
                <View style={styles.earnReward}>
                  <Text style={styles.earnTokens}>+{e.tokens}</Text>
                  <Text style={styles.earnUnit}>$SIZE</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Staking tiers */}
          <View style={styles.section}>
            <SectionHeader title="STAKING — HOLD MORE, EARN MORE" />
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Stake your $SIZE to earn a share of trading fees. Bigger bags unlock higher tiers with exponentially better rewards. Diamond hands eat — paper hands watch.
              </Text>
              <View style={styles.tierTable}>
                <View style={styles.tierHeaderRow}>
                  <Text style={[styles.tierHeaderCell, { flex: 2 }]}>TIER</Text>
                  <Text style={styles.tierHeaderCell}>HOLD</Text>
                  <Text style={styles.tierHeaderCell}>BOOST</Text>
                  <Text style={styles.tierHeaderCell}>APY</Text>
                </View>
                {STAKING_TIERS.map((t, i) => (
                  <View key={i} style={[styles.tierRow, i === STAKING_TIERS.length - 1 && styles.tierRowLast]}>
                    <View style={[styles.tierNameCell, { flex: 2 }]}>
                      <View style={[styles.tierDot, { backgroundColor: t.color }]} />
                      <Text style={[styles.tierName, { color: t.color }]}>{t.label}</Text>
                    </View>
                    <Text style={styles.tierCell}>{t.min}+</Text>
                    <Text style={[styles.tierCell, styles.tierBoost]}>{t.boost}</Text>
                    <Text style={[styles.tierCell, { color: t.color, fontWeight: '900' }]}>{t.apy}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.tierFootnote}>
                Yield comes from real trading fees — 75% of all $SIZE trading volume flows back to the community. Early stakers eat first.
              </Text>
            </View>
          </View>

          {/* Flywheel */}
          <View style={styles.section}>
            <SectionHeader title="THE $SIZE FLYWHEEL" />
            <View style={styles.infoCard}>
              <View style={styles.flywheelStep}>
                <View style={[styles.flywheelNum, { backgroundColor: `${COLORS.gold}25` }]}>
                  <Text style={styles.flywheelNumText}>1</Text>
                </View>
                <View style={styles.flywheelInfo}>
                  <Text style={styles.flywheelTitle}>Use the app</Text>
                  <Text style={styles.flywheelDesc}>Post, verify, engage, refer — earn $SIZE for every action</Text>
                </View>
              </View>
              <View style={styles.flywheelArrow}>
                <Ionicons name="arrow-down" size={16} color={COLORS.gold} />
              </View>
              <View style={styles.flywheelStep}>
                <View style={[styles.flywheelNum, { backgroundColor: `${COLORS.blue}25` }]}>
                  <Text style={styles.flywheelNumText}>2</Text>
                </View>
                <View style={styles.flywheelInfo}>
                  <Text style={styles.flywheelTitle}>Accumulate & stake</Text>
                  <Text style={styles.flywheelDesc}>The more $SIZE you hold and stake, the higher your tier and yield</Text>
                </View>
              </View>
              <View style={styles.flywheelArrow}>
                <Ionicons name="arrow-down" size={16} color={COLORS.gold} />
              </View>
              <View style={styles.flywheelStep}>
                <View style={[styles.flywheelNum, { backgroundColor: `${COLORS.purple}25` }]}>
                  <Text style={styles.flywheelNumText}>3</Text>
                </View>
                <View style={styles.flywheelInfo}>
                  <Text style={styles.flywheelTitle}>Bigger bag = bigger boost</Text>
                  <Text style={styles.flywheelDesc}>Staking boosts multiply ALL your earn rates — whales earn 12x per action</Text>
                </View>
              </View>
              <View style={styles.flywheelArrow}>
                <Ionicons name="arrow-down" size={16} color={COLORS.gold} />
              </View>
              <View style={styles.flywheelStep}>
                <View style={[styles.flywheelNum, { backgroundColor: `${COLORS.green}25` }]}>
                  <Text style={styles.flywheelNumText}>4</Text>
                </View>
                <View style={styles.flywheelInfo}>
                  <Text style={styles.flywheelTitle}>Demand increases</Text>
                  <Text style={styles.flywheelDesc}>More volume → more fees → more $SIZE redistributed → more people want to hold → buy pressure → repeat</Text>
                </View>
              </View>
            </View>
          </View>

          {/* DickCoins */}
          <View style={styles.section}>
            <SectionHeader title="DICKCOINS — PERSONAL MEMECOINS" />
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Every verified user can launch their own personal memecoin — a DickCoin — directly from the app. One tap. Deployed via Clanker on Base. Full ERC-20, tradeable on any DEX immediately.
              </Text>
              <View style={{ gap: 12, marginTop: 14 }}>
                <View style={styles.feeSplitRow}>
                  <Text style={styles.feeSplitPct}>90%</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feeSplitLabel}>ETH fees to DickCoin creator</Text>
                    <Text style={styles.feeSplitDesc}>Permanent. On-chain. Every time your community trades.</Text>
                  </View>
                </View>
                <View style={styles.feeSplitRow}>
                  <Text style={[styles.feeSplitPct, { color: COLORS.blue }]}>10%</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feeSplitLabel}>SIZE. protocol treasury</Text>
                    <Text style={styles.feeSplitDesc}>Funds platform growth and infrastructure.</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Autostaking */}
          <View style={styles.section}>
            <SectionHeader title="DICKCOIN AUTOSTAKING" />
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                When a DickCoin generates 0.5 ETH or more in cumulative trading fees, a lightweight staking contract is automatically deployed for that coin. Same tier-weighted model as $SIZE staking — applied to each individual DickCoin economy.
              </Text>
              <View style={styles.protectRow}>
                <Ionicons name="flash" size={20} color={COLORS.gold} />
                <Text style={styles.protectText}>Staking contracts auto-deploy once a DickCoin hits the fee threshold</Text>
              </View>
              <View style={styles.protectRow}>
                <Ionicons name="trending-up" size={20} color={COLORS.gold} />
                <Text style={styles.protectText}>DickCoin holders stake to earn a share of that coin's trading fees</Text>
              </View>
              <View style={styles.protectRow}>
                <Ionicons name="layers" size={20} color={COLORS.gold} />
                <Text style={styles.protectText}>Same 4-tier system as $SIZE — Grower to Whale — per DickCoin</Text>
              </View>
            </View>
          </View>

          {/* Circle Jerks */}
          <View style={styles.section}>
            <SectionHeader title="CIRCLE JERKS — TOKEN-GATED COMMUNITIES" />
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Every DickCoin automatically spawns a Circle Jerk — a token-gated group chat accessible only to holders. How much you hold determines your role.
              </Text>
              <View style={styles.tierTable}>
                <View style={styles.tierHeaderRow}>
                  <Text style={[styles.tierHeaderCell, { flex: 1.5 }]}>NAME</Text>
                  <Text style={styles.tierHeaderCell}>HOLDING</Text>
                  <Text style={[styles.tierHeaderCell, { flex: 1.5 }]}>ACCESS</Text>
                </View>
                {[
                  { name: 'Daddy', hold: 'Creator/Top', access: 'Full + Bukake', color: COLORS.gold },
                  { name: 'Finisher', hold: 'Top 10%', access: 'Full + Bukake', color: '#FF6B2B' },
                  { name: 'Edger', hold: 'Top 25%', access: 'Full chat', color: COLORS.purple },
                  { name: 'Stroker', hold: 'Any holder', access: 'Chat access', color: COLORS.blue },
                  { name: 'Cuck', hold: 'Minimum', access: 'Read-only', color: COLORS.muted },
                ].map((t, i, arr) => (
                  <View key={i} style={[styles.tierRow, i === arr.length - 1 && styles.tierRowLast]}>
                    <Text style={[styles.tierName, { flex: 1.5, color: t.color }]}>{t.name}</Text>
                    <Text style={styles.tierCell}>{t.hold}</Text>
                    <Text style={[styles.tierCell, { flex: 1.5 }]}>{t.access}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.infoText, { marginTop: 12 }]}>
                The Bukake is the high-signal channel — only Finisher and Daddy can post, but all tiers can read. General chat is the conversation. The Bukake is the alpha.
              </Text>
            </View>
          </View>

          {/* Anti-sybil */}
          <View style={styles.section}>
            <SectionHeader title="ANTI-SYBIL PROTECTION" />
            <View style={styles.infoCard}>
              <View style={styles.protectRow}>
                <Ionicons name="shield-checkmark" size={20} color={COLORS.green} />
                <Text style={styles.protectText}>Daily earning caps per account prevent farming</Text>
              </View>
              <View style={styles.protectRow}>
                <Ionicons name="eye" size={20} color={COLORS.green} />
                <Text style={styles.protectText}>AI-assisted monitoring flags suspicious patterns</Text>
              </View>
              <View style={styles.protectRow}>
                <Ionicons name="finger-print" size={20} color={COLORS.green} />
                <Text style={styles.protectText}>Photo verification ties accounts to real users</Text>
              </View>
              <View style={styles.protectRow}>
                <Ionicons name="analytics" size={20} color={COLORS.green} />
                <Text style={styles.protectText}>All interactions — likes, posts, messages — are recorded on-chain</Text>
              </View>
            </View>
          </View>

          {/* Verified Net Worth */}
          <View style={styles.section}>
            <SectionHeader title="VERIFIED NET WORTH" />
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Connect your wallet to verify your on-chain net worth. SIZE. displays your verified crypto balance alongside your profile — a real flex alongside your other stats.
              </Text>
              <Text style={[styles.infoText, { marginTop: 10 }]}>
                Inspired by TwoCents, where profiles are defined by verified wealth. On SIZE., your identity is your verified size — crypto net worth is just the cherry on top.
              </Text>
              <View style={styles.nwPreview}>
                <View style={styles.nwStat}>
                  <Text style={styles.nwLabel}>VERIFIED SIZE</Text>
                  <Text style={styles.nwValue}>7.2"</Text>
                  <Text style={styles.nwBadge}>AI Verified</Text>
                </View>
                <View style={styles.nwDivider} />
                <View style={styles.nwStat}>
                  <Text style={styles.nwLabel}>CRYPTO NET WORTH</Text>
                  <Text style={styles.nwValue}>$42.0K</Text>
                  <Text style={styles.nwBadge}>On-Chain</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Gift / Transfer */}
          <View style={styles.section}>
            <SectionHeader title="GIFT $SIZE" />
            <View style={styles.infoCard}>
              <View style={styles.giftRow}>
                <View style={styles.giftIcon}>
                  <Ionicons name="gift-outline" size={28} color={COLORS.gold} />
                </View>
                <View style={styles.giftInfo}>
                  <Text style={styles.giftTitle}>Send $SIZE to anyone</Text>
                  <Text style={styles.giftDesc}>
                    Tip your favorite creators, reward great posts, or gift tokens to friends — all within the app. Just tap their profile and send.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Chain info */}
          <View style={styles.section}>
            <SectionHeader title="BUILT ON BASE" />
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                $SIZE lives on Base — Coinbase's L2 chain. Low gas fees, fast transactions, and seamless wallet support through MetaMask and Coinbase Wallet.
              </Text>
              <View style={styles.chainDetails}>
                <View style={styles.chainRow}>
                  <Text style={styles.chainLabel}>Network</Text>
                  <Text style={styles.chainValue}>Base Mainnet</Text>
                </View>
                <View style={styles.chainRow}>
                  <Text style={styles.chainLabel}>Chain ID</Text>
                  <Text style={styles.chainValue}>{BASE_CHAIN_ID}</Text>
                </View>
                <View style={styles.chainRow}>
                  <Text style={styles.chainLabel}>Token Standard</Text>
                  <Text style={styles.chainValue}>ERC-20</Text>
                </View>
                <View style={styles.chainRow}>
                  <Text style={styles.chainLabel}>Contract</Text>
                  <Text style={styles.chainValue}>TBA</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Whitepaper link */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.wpLink}
              activeOpacity={0.8}
              onPress={() => router.push('/whitepaper' as any)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <Ionicons name="document-text-outline" size={18} color={COLORS.gold} />
                <View>
                  <Text style={styles.wpLinkTitle}>Read the Full Whitepaper</Text>
                  <Text style={styles.wpLinkSub}>v1.0 · $SIZE protocol, DickCoins, Circle Jerks</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.gold} />
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>$SIZE is a community token. Not financial advice. DYOR.</Text>
        </ScrollView>
      </PageContainer>
    </SafeAreaView>
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

  // Hero
  heroCard: { marginHorizontal: 16, marginBottom: 20, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: `${COLORS.gold}35`, overflow: 'hidden' },
  heroInner: { padding: 28, alignItems: 'center', gap: 8 },
  heroEmoji: { fontSize: 48 },
  heroTitle: { fontSize: SIZES.xxl, fontWeight: '900', color: COLORS.white, letterSpacing: 1 },
  heroSub: { fontSize: SIZES.sm, color: COLORS.muted, textAlign: 'center' },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 0 },
  heroStat: { alignItems: 'center', flex: 1 },
  heroStatLabel: { fontSize: 9, fontWeight: '800', color: COLORS.muted, letterSpacing: 2 },
  heroStatValue: { fontSize: SIZES.lg, fontWeight: '900', color: COLORS.gold, marginTop: 4 },
  heroDivider: { width: 1, height: 30, backgroundColor: COLORS.cardBorder },

  // Sections
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionHeader: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 10 },

  // Info card
  infoCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16 },
  infoText: { color: COLORS.offWhite, fontSize: SIZES.md, lineHeight: 22 },

  // Fair launch badge
  fairLaunchBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  fairLaunchText: { color: COLORS.green, fontSize: SIZES.sm, fontWeight: '700', flex: 1 },

  // Fee split
  feeSplitContainer: { marginTop: 16, gap: 10 },

  // Supply
  supplyLine: { color: COLORS.muted, fontSize: SIZES.sm, marginBottom: 14 },
  supplyBold: { color: COLORS.gold, fontWeight: '900' },

  // Allocation bar
  barContainer: { gap: 10 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  barSegment: { borderRadius: 5 },
  allocRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  allocDot: { width: 10, height: 10, borderRadius: 5 },
  allocInfo: { flex: 1 },
  allocLabel: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.sm },
  allocDesc: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 1 },
  allocPct: { fontWeight: '900', fontSize: SIZES.md },

  // Earn rates
  earnCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14, marginBottom: 8 },
  earnIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: `${COLORS.gold}15`, borderWidth: 1, borderColor: `${COLORS.gold}25`, alignItems: 'center', justifyContent: 'center' },
  earnInfo: { flex: 1 },
  earnAction: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  earnNote: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 1 },
  earnReward: { alignItems: 'flex-end' },
  earnTokens: { color: COLORS.gold, fontWeight: '900', fontSize: SIZES.md },
  earnUnit: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '700' },

  // Staking tiers table
  tierTable: { marginTop: 16, gap: 0 },
  tierHeaderRow: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  tierHeaderCell: { flex: 1, color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  tierRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  tierRowLast: { borderBottomWidth: 0 },
  tierNameCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierName: { fontSize: SIZES.sm, fontWeight: '800' },
  tierCell: { flex: 1, color: COLORS.offWhite, fontSize: SIZES.sm, fontWeight: '600' },
  tierBoost: { color: COLORS.gold, fontWeight: '900' },
  tierFootnote: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 12, fontStyle: 'italic' },

  // Flywheel
  flywheelStep: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flywheelArrow: { alignItems: 'center', paddingVertical: 4, paddingLeft: 15 },
  flywheelNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  flywheelNumText: { color: COLORS.white, fontWeight: '900', fontSize: SIZES.sm },
  flywheelInfo: { flex: 1 },
  flywheelTitle: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  flywheelDesc: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2, lineHeight: 16 },

  // DickCoin fee split
  feeSplitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 12 },
  feeSplitPct: { fontSize: 24, fontWeight: '900', color: COLORS.gold, width: 56, textAlign: 'center' },
  feeSplitLabel: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.sm },
  feeSplitDesc: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 1 },

  // Whitepaper link
  wpLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}30`, padding: 14 },
  wpLinkTitle: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  wpLinkSub: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 1 },

  // Anti-sybil
  protectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  protectText: { color: COLORS.offWhite, fontSize: SIZES.sm, flex: 1, lineHeight: 18 },

  // Net worth preview
  nwPreview: { flexDirection: 'row', marginTop: 16, backgroundColor: COLORS.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16 },
  nwStat: { flex: 1, alignItems: 'center', gap: 4 },
  nwDivider: { width: 1, backgroundColor: COLORS.cardBorder, marginHorizontal: 8 },
  nwLabel: { fontSize: 9, fontWeight: '800', color: COLORS.muted, letterSpacing: 1.5 },
  nwValue: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white },
  nwBadge: { fontSize: SIZES.xs, color: COLORS.green, fontWeight: '600' },

  // Gift
  giftRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  giftIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: `${COLORS.gold}15`, borderWidth: 1, borderColor: `${COLORS.gold}25`, alignItems: 'center', justifyContent: 'center' },
  giftInfo: { flex: 1 },
  giftTitle: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.base },
  giftDesc: { color: COLORS.muted, fontSize: SIZES.sm, marginTop: 4, lineHeight: 18 },

  // Chain details
  chainDetails: { marginTop: 12, gap: 8 },
  chainRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  chainLabel: { color: COLORS.muted, fontSize: SIZES.sm },
  chainValue: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '600', fontFamily: 'monospace' },

  // Footer
  footer: { color: COLORS.mutedDark, fontSize: SIZES.xs, textAlign: 'center', paddingVertical: 24, paddingHorizontal: 16 },
});
