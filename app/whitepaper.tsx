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
function B({ children }: { children: string }) {
  return <Text style={s.bold}>{children}</Text>;
}
function Divider() {
  return <View style={s.divider} />;
}
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>-</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}
function NumberedStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={s.stepRow}>
      <View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View>
      <Text style={s.stepText}>{children}</Text>
    </View>
  );
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
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.push("/(tabs)" as any)} style={s.backBtn}>
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
            <P>SIZE. is a men's SocialFi protocol on Base that combines verified identity, a token economy, personal memecoin issuance, and token-gated communities into a single integrated platform. Users verify their size via AI, earn and stake $SIZE tokens, launch personal memecoins (DickCoins) through Clanker, and participate in token-gated communities (Circle Jerks) with a five-tier role system.</P>
            <P>The $SIZE token launches as a 100% fair launch — no team allocation, no presale, no insiders — with a fee architecture that distributes 75% of all trading fees directly to stakers. This document describes the full protocol, its mechanisms, and its economic design.</P>
          </View>

          <Divider />

          {/* 1. The Problem */}
          <View style={s.section}>
            <H1>1. The Problem</H1>
            <P>SocialFi has a market failure.</P>
            <P>friend.tech proved that people will pay real money to access social proximity — the ability to buy into someone's world, hold a stake in their community, and get closer to them the more capital you deploy. It generated over $50M in protocol fees in its first month.</P>
            <P>Then it died. Not because the idea was wrong. Because the idea was built on nothing. Keys had no underlying utility. Communities had no native identity. The token had no flywheel. When speculation dried up, there was nothing left.</P>
            <P>The gap in the market is not a SocialFi platform. The gap is a SocialFi platform built around a verified social primitive — one with real identity, real token economics, and a creator economy that compounds on itself.</P>
            <P><B>SIZE. is that platform.</B></P>
          </View>

          <Divider />

          {/* 2. The Product */}
          <View style={s.section}>
            <H1>2. The Product</H1>
            <P>SIZE. is a men's social platform, live today at wheresizematters.com, built as a Progressive Web App on Base. Users verify their size via AI, compete on a global leaderboard, earn in-app tokens through social activity, and communicate directly with other users. It installs directly to the home screen from any mobile browser — no app store required.</P>

            <H2>2.1 AI Verification</H2>
            <P>Users upload a photo alongside a reference object (ruler, credit card, dollar bill). The photo is processed by a Claude Vision AI model running in a Supabase Edge Function. The model performs a two-pass analysis with a girth cross-check for fraud detection. Results in three outcomes: auto-verified (instant checkmark), pending (admin review queue), or rejected.</P>
            <P>Verified users earn 50,000 $SIZE coins, appear on the global leaderboard, and display the checkmark badge everywhere in the app. This verification system is the foundation of everything else in the protocol. It ties every account to a real human performing a real physical action. It is computationally difficult to fake at scale.</P>

            <H2>2.2 Size Tiers</H2>
            <View style={s.table}>
              <TableRow cells={['Tier', 'Range', 'Color']} header />
              <TableRow cells={['Micro', 'Under 4"', 'Gray']} />
              <TableRow cells={['Small', '4-5"', 'Blue']} />
              <TableRow cells={['Average', '5-6"', 'Green']} />
              <TableRow cells={['Above Average', '6-7"', 'Gold']} />
              <TableRow cells={['Large', '7-8"', 'Orange']} />
              <TableRow cells={['Huge', '8-9"', 'Red']} />
              <TableRow cells={['Hung', '9"+', 'Purple']} />
            </View>
            <P>Free users see the tier label. Premium users see the exact measurement (e.g. 7.4" verified) displayed as a holographic gradient badge.</P>

            <H2>2.3 Leaderboard</H2>
            <P>A global ranking of verified users by size, filterable by country and age range. A nearby leaderboard uses device geolocation and a haversine function to show users within a configurable radius. Top three global users receive gold, silver, and bronze badges.</P>

            <H2>2.4 Feed</H2>
            <P>Posts can be discussions (title + body), polls, or media (photo/video). Tags like Hung, OC, Rate Me, and Guess My Size organize content by type. Upvote/downvote scoring. Real-time updates. Non-premium users see a paywall prompt every five posts.</P>

            <H2>2.5 Direct Messaging</H2>
            <P>1:1 DMs with text and media. Media is stored as signed 5-minute URLs — Snapchat-style ephemerality that prevents saving and resharing. Unread counts tracked in real time. Messages marked viewed with a timestamp.</P>

            <H2>2.6 Verified Net Worth</H2>
            <P>Users connect their wallet to display their on-chain crypto balance alongside their verified size on their profile. Total USD equivalent is shown with a checkmark — not a breakdown. Both metrics are verified. Both require action to display. On SIZE., your primary identity is your verified size. Crypto wealth is a secondary flex.</P>

            <H2>2.7 Premium</H2>
            <P>$4.99/month or $29.99/year via Stripe. Premium users see exact measurements everywhere, are eligible for the verified checkmark, can view media posts that are blurred for free users, get priority placement in the feed, and can add bio links to their profile. Alternatively, 250,000 in-app $SIZE coins redeem for one month of premium.</P>
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
              <TableRow cells={['Vesting', 'None']} />
            </View>
            <P>The entire 100 billion token supply goes to liquidity at launch. This is not a promise — it is the launch architecture. Clanker deploys directly into a Uniswap V4 pool on Base. There is no mechanism for team tokens to exist.</P>
            <P>Every token in circulation was bought or earned.</P>
          </View>

          <Divider />

          {/* 4. Fee Architecture */}
          <View style={s.section}>
            <H1>4. Fee Architecture</H1>
            <P>Every $SIZE trade generates LP fees from the Uniswap V4 pool. Those fees split into two streams:</P>
            <View style={s.feeBlock}>
              <View style={s.feeSplit}>
                <Text style={s.feePct}>75%</Text>
                <View style={s.feeInfo}>
                  <Text style={s.feeLabel}>Community (Stakers)</Text>
                  <Text style={s.feeDesc}>Denominated in $SIZE. Distributed proportionally to effective stake weight — staking tier boost applied. An EC2 indexer watches on-chain events continuously, collects fees every six hours, and deposits to SizeStaking.sol for distribution. No intermediary. No DAO vote. No delay beyond the six-hour collection cycle.</Text>
                </View>
              </View>
              <View style={s.feeSplit}>
                <Text style={[s.feePct, { color: COLORS.blue }]}>25%</Text>
                <View style={s.feeInfo}>
                  <Text style={s.feeLabel}>Protocol (ETH)</Text>
                  <Text style={s.feeDesc}>Funds development, infrastructure, and growth. No inflationary printing.</Text>
                </View>
              </View>
            </View>
            <P>There is no emission schedule. There are no team unlocks. The protocol earns when the community trades.</P>
          </View>

          <Divider />

          {/* 5. Staking */}
          <View style={s.section}>
            <H1>5. Staking</H1>
            <P>Staking is on-chain via SizeStaking.sol deployed on Base mainnet (Solidity 0.8.24, OpenZeppelin, ReentrancyGuard, Pausable, emergency withdraw).</P>
            <View style={s.table}>
              <TableRow cells={['Tier', 'Min Stake', 'Boost', 'Target APY']} header />
              <TableRow cells={['Grower', '100,000 $SIZE', '1x', '~8%']} />
              <TableRow cells={['Shower', '1,000,000 $SIZE', '2x', '~18%']} />
              <TableRow cells={['Shlong', '10,000,000 $SIZE', '5x', '~40%']} />
              <TableRow cells={['Whale', '100,000,000 $SIZE', '12x', '~80%']} />
            </View>
            <P><B>Effective stake = tokens staked x tier boost</B></P>
            <P>A Whale staking 100M $SIZE has an effective weight of 1.2 billion. A Grower has 100,000. Fee pool distributions are proportional to effective stake. Whales receive a structurally outsized share. This is intentional — large holders have the most aligned incentive with protocol volume.</P>
            <P>APY figures are variable and volume-driven. They are not emissions. Every dollar of yield comes from a dollar of real trading volume. When volume is high, yields are high.</P>
          </View>

          <Divider />

          {/* 6. Earn Rates */}
          <View style={s.section}>
            <H1>6. In-App Economy</H1>
            <H2>6.1 Base Earn Rates</H2>
            <View style={s.table}>
              <TableRow cells={['Action', 'Base $SIZE', 'Notes']} header />
              <TableRow cells={['Get Verified', '50,000', 'One-time']} />
              <TableRow cells={['Refer a Friend', '25,000', 'Per signup']} />
              <TableRow cells={['Daily Login', '2,000', 'Per day']} />
              <TableRow cells={['Post to Feed', '1,000', 'Daily cap']} />
              <TableRow cells={['Get Upvoted', '1,500', 'Per upvote']} />
              <TableRow cells={['Send a Message', '500', 'Per convo']} />
            </View>

            <H2>6.2 Multiplier Stack</H2>
            <P><B>Formula: effective earn = base rate x staking boost x activity multiplier</B></P>
            <P>The activity multiplier compounds up to approximately 3.3x on top of the staking boost, based on:</P>
            <Bullet>Login streak: up to 1.5x</Bullet>
            <Bullet>Verification status: 1.2x if verified</Bullet>
            <Bullet>Referral count: up to 1.1x (5+ referrals)</Bullet>
            <Bullet>Post frequency: up to 1.0x additional</Bullet>
            <P>A Whale (12x boost) with maximum activity multiplier (3.3x) earns approximately 39.6x the base rate on every action. The protocol is designed to make large holders deeply engaged participants, not passive yield farmers.</P>

            <H2>6.3 Anti-Sybil</H2>
            <Bullet>Photo verification ties every verified account to a real human</Bullet>
            <Bullet>Per-account daily caps enforced atomically in DynamoDB with TTL keys</Bullet>
            <Bullet>AI-assisted pattern monitoring flags suspicious behavior</Bullet>
            <Bullet>All staking and fee distributions fully on-chain and auditable</Bullet>
          </View>

          <Divider />

          {/* 7. DickCoins */}
          <View style={s.section}>
            <H1>7. DickCoins</H1>
            <P>Every verified user on SIZE. can launch their own personal memecoin — a DickCoin — directly from the app. One tap. Deployed via Clanker on Base. Full ERC-20, tradeable on any compatible DEX immediately after launch.</P>
            <P>DickCoins use the same audited Clanker infrastructure as $SIZE itself. There is no custom contract to write or audit. The creator launches, Clanker deploys, the market opens.</P>

            <H2>7.1 Fee Split</H2>
            <P>When a DickCoin trades on Clanker, LP fees split as follows:</P>
            <View style={s.feeBlock}>
              <View style={s.feeSplit}>
                <Text style={s.feePct}>90%</Text>
                <View style={s.feeInfo}>
                  <Text style={s.feeLabel}>DickCoin Creator</Text>
                  <Text style={s.feeDesc}>The verified user who launched it. Earns every time their community trades their coin. Permanently. On-chain. No platform rent-seeking beyond the 10% protocol fee.</Text>
                </View>
              </View>
              <View style={s.feeSplit}>
                <Text style={[s.feePct, { color: COLORS.blue }]}>10%</Text>
                <View style={s.feeInfo}>
                  <Text style={s.feeLabel}>SIZE. Protocol Treasury</Text>
                  <Text style={s.feeDesc}>Funds platform growth and infrastructure.</Text>
                </View>
              </View>
            </View>

            <H2>7.2 Launch Flow</H2>
            <NumberedStep n={1}>User taps "Launch DickCoin" in the app</NumberedStep>
            <NumberedStep n={2}>Enters token name, ticker (max 8 chars), optional description, uploads image</NumberedStep>
            <NumberedStep n={3}>App calls Clanker deployment API</NumberedStep>
            <NumberedStep n={4}>ERC-20 deployed on Base, Uniswap V4 pool opens</NumberedStep>
            <NumberedStep n={5}>Circle Jerk spawns automatically</NumberedStep>

            <H2>7.3 Autostaking</H2>
            <P>When a DickCoin generates 0.5 ETH or more in cumulative trading fees, a lightweight staking contract is automatically deployed for that coin. Holders can then stake their DickCoin to earn a share of ongoing trading fees — the same tier-weighted model as $SIZE staking, applied to each individual DickCoin economy.</P>
          </View>

          <Divider />

          {/* 8. Circle Jerks */}
          <View style={s.section}>
            <H1>8. Circle Jerks</H1>
            <P>Every DickCoin automatically spawns a Circle Jerk: a token-gated group chat inside the SIZE. app, accessible only to holders of that specific coin. No setup required. The Circle Jerk exists the moment the DickCoin launches.</P>
            <P>Holding a DickCoin is not just a financial position — it is membership in a community. How much you hold determines your role.</P>

            <H2>8.1 Role Tiers</H2>
            <View style={s.table}>
              <TableRow cells={['Tier', 'Name', 'Holding', 'Access']} header />
              <TableRow cells={['5', 'Daddy', 'Creator or top holder', 'Full control + Bukake write']} />
              <TableRow cells={['4', 'Finisher', 'Top 10% by balance', 'Full chat + Bukake write']} />
              <TableRow cells={['3', 'Edger', 'Top 25% by balance', 'Full chat participation']} />
              <TableRow cells={['2', 'Stroker', 'Any holder above threshold', 'Full chat access']} />
              <TableRow cells={['1', 'Cuck', 'Smallest holders', 'Read-only']} />
            </View>
            <P>Roles are assigned automatically and update in real time as balances change.</P>

            <H2>8.2 The Bukake</H2>
            <P>Every Circle Jerk has two channels:</P>
            <P><B>General chat</B> — write access for Tier 2 (Stroker) and above. Cucks read-only. The main community conversation.</P>
            <P><B>The Bukake</B> — write access restricted to Tier 4 (Finisher) and Tier 5 (Daddy) only. All tiers can read. Only the most committed holders can post.</P>
            <P>The Bukake is the high-signal layer. It functions as a native announcement channel for the creator's inner circle — the holders with the most capital at stake. General chat is the conversation. The Bukake is the alpha.</P>

            <H2>8.3 Access Control</H2>
            <Bullet>On Circle Jerk load: check holder balance and tier</Bullet>
            <Bullet>Zero balance: gate screen with "Buy on Uniswap" CTA</Bullet>
            <Bullet>Write permissions enforced server-side on every message send</Bullet>
            <Bullet>Tier re-checks on every message to prevent stale tier exploits</Bullet>
          </View>

          <Divider />

          {/* 9. Gifting */}
          <View style={s.section}>
            <H1>9. Gifting</H1>
            <P>Users can send $SIZE coins directly to any other user or tip a feed post. Profile-to-profile and post-to-creator transfers are immediate and atomic. Gifted posts display total tips received alongside upvotes. Most-gifted posts receive a "Tipped" badge.</P>
          </View>

          <Divider />

          {/* 10. The Flywheel */}
          <View style={s.section}>
            <H1>10. The Flywheel</H1>
            <P>Every component of SIZE. feeds every other component.</P>
            <NumberedStep n={1}>User signs up, gets verified, earns 50,000 $SIZE coins</NumberedStep>
            <NumberedStep n={2}>Accumulates coins through daily activity, posts, referrals, upvotes</NumberedStep>
            <NumberedStep n={3}>Stakes $SIZE, enters Grower tier, earns share of fee pool</NumberedStep>
            <NumberedStep n={4}>Higher tier = bigger fee share + boosted earn rates = more accumulation</NumberedStep>
            <NumberedStep n={5}>Launches DickCoin, community buys, Circle Jerk spawns</NumberedStep>
            <NumberedStep n={6}>DickCoin trades generate Clanker fees — 90% to creator, 10% to protocol</NumberedStep>
            <NumberedStep n={7}>$SIZE trades generate Uniswap V4 fees — 75% to stakers, 25% to protocol</NumberedStep>
            <NumberedStep n={8}>Staking yield creates buy pressure, price appreciates, more volume, more fees, more yield</NumberedStep>
            <NumberedStep n={9}>New users see the leaderboard and DickCoin communities, join, verify, repeat</NumberedStep>
            <P>The system is designed so that every user action — logging in, posting, messaging, verifying, staking, launching a coin — makes the protocol more valuable for every other participant.</P>
          </View>

          <Divider />

          {/* 11. Competitive Positioning */}
          <View style={s.section}>
            <H1>11. Competitive Positioning</H1>
            <View style={s.table}>
              <TableRow cells={['Platform', 'Token', 'Creator Econ', 'Identity', 'Community', 'Staking']} header />
              <TableRow cells={['friend.tech', 'Keys (dead)', 'Bonding curve', 'None', 'Chat rooms', 'No']} />
              <TableRow cells={['SIZE.', '$SIZE + DickCoins', 'Fees + yield', 'AI-verified', 'Circle Jerks', '4 tiers']} />
            </View>
            <P>SIZE. is the only platform in this category with verified identity, a staking tier system, a personal memecoin layer, and token-gated communities operating simultaneously. The app was live before the token. Every feature described in this document exists in production or is in active development.</P>
          </View>

          <Divider />

          {/* 12. Architecture */}
          <View style={s.section}>
            <H1>12. Technical Architecture</H1>
            <View style={s.table}>
              <TableRow cells={['Layer', 'Technology']} header />
              <TableRow cells={['Frontend', 'Expo (React Native Web) · Vercel']} />
              <TableRow cells={['Routing', 'expo-router (file-based)']} />
              <TableRow cells={['Auth', 'Supabase (OAuth + X identity)']} />
              <TableRow cells={['Database', 'AWS DynamoDB + Supabase Postgres']} />
              <TableRow cells={['Storage', 'Supabase Storage (signed URLs)']} />
              <TableRow cells={['AI', 'Claude Vision API · Edge Function']} />
              <TableRow cells={['Chain', 'Base mainnet · Chainstack RPC']} />
              <TableRow cells={['Staking', 'SizeStaking.sol · OpenZeppelin']} />
              <TableRow cells={['Fees', 'EC2 indexer · DynamoDB + S3 · 6h cycle']} />
              <TableRow cells={['Payments', 'Stripe (Payment Links + webhook)']} />
              <TableRow cells={['Token Launch', 'Clanker · Uniswap V4 on Base']} />
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

  // Content
  section: { paddingHorizontal: 20, marginBottom: 8 },
  h1: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, marginBottom: 12, marginTop: 20, letterSpacing: 0.5 },
  h2: { fontSize: SIZES.lg, fontWeight: '800', color: COLORS.gold, marginBottom: 8, marginTop: 16 },
  p: { fontSize: SIZES.md, color: COLORS.offWhite, lineHeight: 24, marginBottom: 10 },
  bold: { fontWeight: '800', color: COLORS.white },
  divider: { height: 1, backgroundColor: COLORS.cardBorder, marginHorizontal: 20, marginVertical: 16 },
  tagline: { fontSize: SIZES.lg, fontWeight: '900', color: COLORS.gold, fontStyle: 'italic', marginTop: 8, textAlign: 'center' },

  // Bullets
  bulletRow: { flexDirection: 'row', paddingLeft: 4, marginBottom: 6, gap: 8 },
  bulletDot: { color: COLORS.gold, fontWeight: '900', fontSize: SIZES.md, lineHeight: 24, width: 12 },
  bulletText: { flex: 1, color: COLORS.offWhite, fontSize: SIZES.md, lineHeight: 24 },

  // Numbered steps
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: `${COLORS.gold}20`, borderWidth: 1, borderColor: `${COLORS.gold}40`, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  stepNumText: { color: COLORS.gold, fontWeight: '900', fontSize: SIZES.xs },
  stepText: { flex: 1, color: COLORS.offWhite, fontSize: SIZES.md, lineHeight: 24 },

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
