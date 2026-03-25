import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import PageContainer from '@/components/PageContainer';

function H1({ children }: { children: string }) {
  return <Text style={s.h1}>{children}</Text>;
}
function H2({ children }: { children: string }) {
  return <Text style={s.h2}>{children}</Text>;
}
function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>;
}
function Bold({ children }: { children: string }) {
  return <Text style={s.bold}>{children}</Text>;
}
function Divider() {
  return <View style={s.divider} />;
}

function TableRow({ cells, header }: { cells: string[]; header?: boolean }) {
  return (
    <View style={[s.tableRow, header && s.tableHeaderRow]}>
      {cells.map((c, i) => (
        <Text key={i} style={[s.tableCell, header && s.tableHeaderCell, i === 0 && { flex: 2 }]}>{c}</Text>
      ))}
    </View>
  );
}

export default function WhitepaperScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.container}>
      <PageContainer maxWidth={800}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <View style={s.headerTitle}>
            <Text style={s.logo}>SIZE.</Text>
            <Text style={s.title}>WHITEPAPER</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Hero */}
          <LinearGradient
            colors={['#2A1A00', '#1A0800', '#0A0A0A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            <LinearGradient
              colors={['rgba(232,80,10,0.25)', 'rgba(201,168,76,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.heroInner}
            >
              <Text style={s.heroVersion}>v1.0</Text>
              <Text style={s.heroTitle}>SIZE. Whitepaper</Text>
              <Text style={s.heroSub}>$SIZE · Base · 100B Supply · Fair Launch</Text>
              <Text style={s.heroUrl}>wheresizematters.com</Text>
            </LinearGradient>
          </LinearGradient>

          {/* Abstract */}
          <View style={s.section}>
            <H1>Abstract</H1>
            <P>
              SIZE. is a men's SocialFi protocol on Base that combines verified identity, a token economy, personal memecoin issuance, and token-gated communities into a single integrated platform. Users verify their size via AI, earn and stake $SIZE tokens, launch personal memecoins (DickCoins) through Clanker, and participate in token-gated communities (Circle Jerks) with a five-tier role system.
            </P>
            <P>
              The $SIZE token launches as a 100% fair launch — no team allocation, no presale, no insiders — with a fee architecture that distributes 75% of all trading fees directly to stakers. This document describes the full protocol, its mechanisms, and its economic design.
            </P>
          </View>

          <Divider />

          {/* 1. The Problem */}
          <View style={s.section}>
            <H1>1. The Problem</H1>
            <P>
              SocialFi has a market failure. friend.tech proved that people will pay real money to access social proximity — the ability to buy into someone's world, hold a stake in their community, and get closer to them the more capital you deploy. It generated over $50M in protocol fees in its first month.
            </P>
            <P>
              Then it died. Not because the idea was wrong. Because the idea was built on nothing. Keys had no underlying utility. Communities had no native identity. The token had no flywheel. When speculation dried up, there was nothing left.
            </P>
            <P>
              The gap in the market is not a SocialFi platform. The gap is a SocialFi platform built around a verified social primitive — one with real identity, real token economics, and a creator economy that compounds on itself.
            </P>
          </View>

          <Divider />

          {/* 2. The Product */}
          <View style={s.section}>
            <H1>2. The Product</H1>
            <P>
              SIZE. is a men's social platform, live today at wheresizematters.com, built as a Progressive Web App on Base. Users verify their size via AI, compete on a global leaderboard, earn in-app tokens through social activity, and communicate directly with other users.
            </P>

            <H2>AI Verification</H2>
            <P>
              Users upload a photo alongside a reference object (ruler, credit card, dollar bill). The photo is processed by a Claude Vision AI model. The model performs a two-pass analysis with a girth cross-check for fraud detection. Verified users earn 50,000 $SIZE coins, appear on the global leaderboard, and display the checkmark badge everywhere in the app.
            </P>

            <H2>Size Tiers</H2>
            <View style={s.table}>
              <TableRow cells={['Tier', 'Range', 'Color']} header />
              <TableRow cells={['Micro', 'Under 4"', 'Gray']} />
              <TableRow cells={['Small', '4–5"', 'Blue']} />
              <TableRow cells={['Average', '5–6"', 'Green']} />
              <TableRow cells={['Above Average', '6–7"', 'Gold']} />
              <TableRow cells={['Large', '7–8"', 'Orange']} />
              <TableRow cells={['Huge', '8–9"', 'Red']} />
              <TableRow cells={['Hung', '9"+', 'Purple']} />
            </View>

            <H2>Leaderboard</H2>
            <P>Global ranking of verified users by size, filterable by country and age range. Nearby leaderboard via geolocation. Top three receive gold, silver, and bronze badges.</P>

            <H2>Feed</H2>
            <P>Discussions, polls, media posts. Tags: Hung, OC, Rate Me, Guess My Size. Upvote/downvote scoring. Real-time updates.</P>

            <H2>Direct Messaging</H2>
            <P>1:1 DMs with text and media. Media stored as signed 5-minute URLs — Snapchat-style ephemerality. Read receipts.</P>

            <H2>Verified Net Worth</H2>
            <P>Connect your wallet to display on-chain crypto balance alongside verified size on your profile. Total USD equivalent with checkmark. Identity = verified size. Wealth is a secondary flex.</P>
          </View>

          <Divider />

          {/* 3. The Token */}
          <View style={s.section}>
            <H1>3. The $SIZE Token</H1>
            <View style={s.table}>
              <TableRow cells={['Property', 'Value']} header />
              <TableRow cells={['Name', '$SIZE']} />
              <TableRow cells={['Chain', 'Base (Ethereum L2)']} />
              <TableRow cells={['Standard', 'ERC-20, 18 decimals']} />
              <TableRow cells={['Total Supply', '100,000,000,000']} />
              <TableRow cells={['Launch Platform', 'Clanker (Uniswap V4)']} />
              <TableRow cells={['Team Allocation', 'None']} />
              <TableRow cells={['Presale', 'None']} />
              <TableRow cells={['Insider Allocation', 'None']} />
            </View>
            <P>
              The entire 100 billion token supply goes to liquidity at launch. This is not a promise — it is the launch architecture. Clanker deploys directly into a Uniswap V4 pool on Base. There is no mechanism for team tokens to exist. Every token in circulation was bought or earned.
            </P>
          </View>

          <Divider />

          {/* 4. Fee Architecture */}
          <View style={s.section}>
            <H1>4. Fee Architecture</H1>
            <P>
              Every $SIZE trade generates LP fees from the Uniswap V4 pool. Those fees split into two streams:
            </P>
            <View style={s.feeBlock}>
              <View style={s.feeSplit}>
                <Text style={s.feePct}>75%</Text>
                <View style={s.feeInfo}>
                  <Text style={s.feeLabel}>Community (Stakers)</Text>
                  <Text style={s.feeDesc}>Distributed as $SIZE proportional to effective stake weight. Collected every 6 hours.</Text>
                </View>
              </View>
              <View style={s.feeSplit}>
                <Text style={[s.feePct, { color: COLORS.blue }]}>25%</Text>
                <View style={s.feeInfo}>
                  <Text style={s.feeLabel}>Protocol (ETH)</Text>
                  <Text style={s.feeDesc}>Development, infrastructure, and growth. No inflationary printing.</Text>
                </View>
              </View>
            </View>
            <P>There is no emission schedule. There are no team unlocks. The protocol earns when the community trades.</P>
          </View>

          <Divider />

          {/* 5. Staking */}
          <View style={s.section}>
            <H1>5. Staking</H1>
            <P>Staking is on-chain via SizeStaking.sol on Base mainnet.</P>
            <View style={s.table}>
              <TableRow cells={['Tier', 'Min Stake', 'Boost', 'APY']} header />
              <TableRow cells={['Grower', '100K', '1x', '~8%']} />
              <TableRow cells={['Shower', '1M', '2x', '~18%']} />
              <TableRow cells={['Shlong', '10M', '5x', '~40%']} />
              <TableRow cells={['Whale', '100M', '12x', '~80%']} />
            </View>
            <P>
              Effective stake = tokens staked x tier boost. A Whale staking 100M has an effective weight of 1.2 billion vs a Grower's 100,000. Whales receive a structurally outsized share. APY is variable and volume-driven — not emissions.
            </P>
          </View>

          <Divider />

          {/* 6. Earn Rates */}
          <View style={s.section}>
            <H1>6. In-App Economy</H1>
            <View style={s.table}>
              <TableRow cells={['Action', 'Base $SIZE', 'Notes']} header />
              <TableRow cells={['Get Verified', '50,000', 'One-time']} />
              <TableRow cells={['Refer a Friend', '25,000', 'Per signup']} />
              <TableRow cells={['Daily Login', '2,000', 'Per day']} />
              <TableRow cells={['Post to Feed', '1,000', 'Daily cap']} />
              <TableRow cells={['Get Upvoted', '1,500', 'Per upvote']} />
              <TableRow cells={['Send a Message', '500', 'Per convo']} />
            </View>
            <P>
              Formula: effective earn = base rate x staking boost x activity multiplier. Maximum: Whale (12x) x max activity (3.3x) = 39.6x base rate on every action.
            </P>
          </View>

          <Divider />

          {/* 7. DickCoins */}
          <View style={s.section}>
            <H1>7. DickCoins</H1>
            <P>
              Every verified user can launch a personal memecoin — a DickCoin — directly from the app. One tap. Deployed via Clanker on Base. Full ERC-20, tradeable immediately.
            </P>
            <H2>DickCoin Fee Split</H2>
            <View style={s.feeBlock}>
              <View style={s.feeSplit}>
                <Text style={s.feePct}>90%</Text>
                <View style={s.feeInfo}>
                  <Text style={s.feeLabel}>DickCoin Creator</Text>
                  <Text style={s.feeDesc}>ETH fees from every trade. Permanent. On-chain.</Text>
                </View>
              </View>
              <View style={s.feeSplit}>
                <Text style={[s.feePct, { color: COLORS.blue }]}>10%</Text>
                <View style={s.feeInfo}>
                  <Text style={s.feeLabel}>SIZE. Protocol</Text>
                  <Text style={s.feeDesc}>Funds platform growth and infrastructure.</Text>
                </View>
              </View>
            </View>

            <H2>Autostaking</H2>
            <P>
              When a DickCoin generates 0.5 ETH or more in cumulative fees, a lightweight staking contract is automatically deployed for that coin. Holders can then stake their DickCoin to earn a share of ongoing trading fees — the same tier-weighted model as $SIZE staking, applied to each individual DickCoin economy.
            </P>
          </View>

          <Divider />

          {/* 8. Circle Jerks */}
          <View style={s.section}>
            <H1>8. Circle Jerks</H1>
            <P>
              Every DickCoin automatically spawns a Circle Jerk: a token-gated group chat inside the SIZE. app, accessible only to holders. No setup required. How much you hold determines your role.
            </P>

            <H2>Role Tiers</H2>
            <View style={s.table}>
              <TableRow cells={['Tier', 'Name', 'Holding', 'Access']} header />
              <TableRow cells={['5', 'Daddy', 'Creator/Top', 'Full + Bukake']} />
              <TableRow cells={['4', 'Finisher', 'Top 10%', 'Full + Bukake']} />
              <TableRow cells={['3', 'Edger', 'Top 25%', 'Full chat']} />
              <TableRow cells={['2', 'Stroker', 'Any holder', 'Chat access']} />
              <TableRow cells={['1', 'Cuck', 'Minimum', 'Read-only']} />
            </View>

            <H2>The Bukake</H2>
            <P>
              Every Circle Jerk has two channels. General chat — open to all holders Tier 2+. The Bukake — write access restricted to Tier 4 (Finisher) and Tier 5 (Daddy) only. All tiers can read. The Bukake is the high-signal layer. Only the most committed holders can post.
            </P>
          </View>

          <Divider />

          {/* 9. Gifting */}
          <View style={s.section}>
            <H1>9. Gifting</H1>
            <P>
              Users can send $SIZE coins directly to any other user or tip a feed post. Profile-to-profile and post-to-creator transfers are immediate and atomic. Most-gifted posts receive a "Tipped" badge.
            </P>
          </View>

          <Divider />

          {/* 10. The Flywheel */}
          <View style={s.section}>
            <H1>10. The Flywheel</H1>
            <P>1. User signs up, gets verified, earns 50,000 $SIZE</P>
            <P>2. Accumulates coins through daily activity, posts, referrals, upvotes</P>
            <P>3. Stakes $SIZE, enters Grower tier, earns share of fee pool</P>
            <P>4. Higher tier = bigger fee share + boosted earn rates</P>
            <P>5. Launches DickCoin, community buys, Circle Jerk spawns</P>
            <P>6. DickCoin trades generate Clanker fees — 90% to creator, 10% to protocol</P>
            <P>7. $SIZE trades generate Uniswap fees — 75% to stakers, 25% to protocol</P>
            <P>8. Staking yield creates buy pressure, price appreciates, more volume, more fees</P>
            <P>9. New users see the leaderboard and DickCoin communities, join, verify, repeat</P>
          </View>

          <Divider />

          {/* 11. Anti-Sybil */}
          <View style={s.section}>
            <H1>11. Anti-Sybil</H1>
            <P>Photo verification ties every account to a real human performing a physical action. Per-account daily caps enforced atomically with TTL keys. AI-assisted pattern monitoring flags suspicious behavior. All staking and fee distributions fully on-chain and auditable.</P>
          </View>

          <Divider />

          {/* 12. Architecture */}
          <View style={s.section}>
            <H1>12. Technical Architecture</H1>
            <View style={s.table}>
              <TableRow cells={['Layer', 'Technology']} header />
              <TableRow cells={['Frontend', 'Expo (React Native Web) · Vercel']} />
              <TableRow cells={['Auth', 'Supabase OAuth']} />
              <TableRow cells={['Database', 'AWS DynamoDB']} />
              <TableRow cells={['AI', 'Claude Vision API']} />
              <TableRow cells={['Chain', 'Base · Chainstack RPC']} />
              <TableRow cells={['Staking', 'SizeStaking.sol · OpenZeppelin']} />
              <TableRow cells={['Fees', 'EC2 indexer · 6h cycle']} />
              <TableRow cells={['Token Launch', 'Clanker · Uniswap V4']} />
              <TableRow cells={['Payments', 'Stripe']} />
            </View>
          </View>

          <Divider />

          {/* 13. Launch */}
          <View style={s.section}>
            <H1>13. Launch</H1>
            <P>100% fair launch. 100B supply. No insiders.</P>
            <P>wheresizematters.com</P>
            <Text style={s.tagline}>Where size matters.</Text>
          </View>

          <Text style={s.footer}>$SIZE Whitepaper v1.0 · Not financial advice · DYOR</Text>
        </ScrollView>
      </PageContainer>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  headerTitle: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  logo: { fontSize: 24, fontWeight: '900', color: COLORS.gold, letterSpacing: 4 },
  title: { fontSize: SIZES.lg, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
  scroll: { paddingBottom: 100 },

  // Hero
  heroCard: { marginHorizontal: 16, marginBottom: 24, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: `${COLORS.gold}35`, overflow: 'hidden' },
  heroInner: { padding: 32, alignItems: 'center', gap: 8 },
  heroVersion: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 3 },
  heroTitle: { fontSize: 32, fontWeight: '900', color: COLORS.white, letterSpacing: 1 },
  heroSub: { fontSize: SIZES.sm, color: COLORS.gold, fontWeight: '700', letterSpacing: 1 },
  heroUrl: { fontSize: SIZES.xs, color: COLORS.muted, marginTop: 4 },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 8 },
  h1: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, marginBottom: 12, marginTop: 20, letterSpacing: 0.5 },
  h2: { fontSize: SIZES.lg, fontWeight: '800', color: COLORS.gold, marginBottom: 8, marginTop: 16 },
  p: { fontSize: SIZES.md, color: COLORS.offWhite, lineHeight: 24, marginBottom: 10 },
  bold: { fontWeight: '800', color: COLORS.white },
  divider: { height: 1, backgroundColor: COLORS.cardBorder, marginHorizontal: 20, marginVertical: 16 },
  tagline: { fontSize: SIZES.lg, fontWeight: '900', color: COLORS.gold, fontStyle: 'italic', marginTop: 8, textAlign: 'center' },

  // Tables
  table: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden', marginVertical: 12 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  tableHeaderRow: { backgroundColor: `${COLORS.gold}10` },
  tableCell: { flex: 1, fontSize: SIZES.sm, color: COLORS.offWhite },
  tableHeaderCell: { fontWeight: '800', color: COLORS.gold, fontSize: SIZES.xs, letterSpacing: 1 },

  // Fee blocks
  feeBlock: { gap: 12, marginVertical: 12 },
  feeSplit: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14 },
  feePct: { fontSize: 28, fontWeight: '900', color: COLORS.gold, width: 70, textAlign: 'center' },
  feeInfo: { flex: 1 },
  feeLabel: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  feeDesc: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2, lineHeight: 16 },

  // Footer
  footer: { color: COLORS.mutedDark, fontSize: SIZES.xs, textAlign: 'center', paddingVertical: 24, paddingHorizontal: 16 },
});
