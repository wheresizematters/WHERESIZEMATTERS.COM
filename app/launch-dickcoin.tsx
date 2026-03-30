import { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import PageContainer from '@/components/PageContainer';
import { getToken, getApiUrl } from '@/lib/supabase';
import { launchDickCoin } from '@/lib/dickcoin';
import * as ImagePicker from 'expo-image-picker';

type Step = 'info' | 'form' | 'launching' | 'success' | 'error';

const FEATURES = [
  { icon: 'flash', title: '90% of Fees', desc: 'You earn 90% of every trade fee on your coin. Forever. On-chain.' },
  { icon: 'people', title: 'Circle Jerk', desc: 'Your coin auto-spawns a token-gated community. Holders get roles based on how much they hold.' },
  { icon: 'trending-up', title: 'Autostaking', desc: 'At 0.5 ETH in fees, staking auto-deploys for your coin. Holders earn yield.' },
  { icon: 'shield-checkmark', title: 'Clanker Infra', desc: 'Deployed via Clanker on Base. Audited contracts. Uniswap V4 pool. Instant liquidity.' },
];

const STEPS_INFO = [
  { n: 1, text: 'Choose a name, ticker, and image for your coin' },
  { n: 2, text: 'Your ERC-20 token deploys on Base via Clanker' },
  { n: 3, text: 'A Uniswap V4 liquidity pool opens immediately' },
  { n: 4, text: 'A Circle Jerk community spawns for your holders' },
  { n: 5, text: 'You earn 90% of every trade fee — forever' },
];

export default function LaunchDickCoinScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();

  const [step, setStep] = useState<Step>('info');
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [txHash, setTxHash] = useState('');
  const [generatingLogo, setGeneratingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoRemaining, setLogoRemaining] = useState(3);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function generateLogo() {
    if (!name.trim() || !ticker.trim()) {
      setError('Enter a name and ticker first');
      return;
    }
    setGeneratingLogo(true);
    setError('');
    try {
      const token = getToken();
      const res = await fetch(`${getApiUrl()}/api/v1/logo/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ coinName: name.trim(), ticker: ticker.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setLogoUrl(data.logoUrl);
        setImageUri(data.logoUrl); // Use as the coin image
        setLogoRemaining(data.remaining);
      }
    } catch {
      setError('Logo generation failed. Try again.');
    } finally {
      setGeneratingLogo(false);
    }
  }

  async function handleLaunch() {
    if (!session?.user.id || !profile?.wallet_address) {
      setError('Connect your wallet first (go to Grow tab)');
      return;
    }
    if (!profile?.is_verified) {
      setError('You must be verified to launch a DickCoin');
      return;
    }
    if (!name.trim()) { setError('Enter a name'); return; }
    if (!ticker.trim() || ticker.length > 9) { setError('Ticker must be 1-8 characters'); return; }

    setStep('launching');
    setError('');

    try {
      let imageUrl = '';
      const API = getApiUrl();
      const authToken = getToken() ?? '';

      if (imageUri) {
        const ext = imageUri.split('.').pop() ?? 'jpg';
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        const urlRes = await fetch(`${API}/api/v1/storage/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ bucket: 'dickcoin-images', path, contentType: 'image/jpeg' }),
        });
        if (urlRes.ok) {
          const { uploadUrl, publicUrl } = await urlRes.json();
          const response = await fetch(imageUri);
          const blob = await response.blob();
          await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
          imageUrl = publicUrl;
        }
      }

      const result = await launchDickCoin({
        name: name.trim(),
        ticker: ticker.trim().replace('$', '').toUpperCase(),
        description: description.trim() || undefined,
        imageUrl,
        creatorAddress: profile.wallet_address!,
      }, authToken);

      if (result.error) {
        setError(result.error);
        setStep('error');
        return;
      }

      setContractAddress(result.contractAddress);
      setTxHash(result.txHash);
      setStep('success');
    } catch (err: any) {
      console.error('Launch error:', err);
      setError(err?.message ?? 'Connection failed — check your internet and try again');
      setStep('error');
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <PageContainer>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); } else { router.push('/(tabs)' as any); } }} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={s.headerText}>Launch DickCoin</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── INFO STEP ── */}
          {step === 'info' && (
            <>
              {/* Hero */}
              <LinearGradient
                colors={['#2A1200', '#1A0800', '#0A0A0A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.heroCard}
              >
                <LinearGradient
                  colors={['rgba(232,80,10,0.2)', 'rgba(255,107,43,0.08)', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.heroInner}
                >
                  <Ionicons name="rocket" size={40} color={COLORS.gold} />
                  <Text style={s.heroTitle}>Launch Your Personal Memecoin</Text>
                  <Text style={s.heroSub}>Deploy an ERC-20 token on Base in one tap. Your coin gets instant liquidity on Uniswap V4 and a token-gated Circle Jerk community.</Text>
                </LinearGradient>
              </LinearGradient>

              {/* Fee split */}
              <View style={s.section}>
                <Text style={s.sectionLabel}>FEE SPLIT</Text>
                <View style={s.feeBar}>
                  <View style={[s.feeSegment, { flex: 90, backgroundColor: COLORS.gold }]}>
                    <Text style={s.feeSegText}>90% YOU</Text>
                  </View>
                  <View style={[s.feeSegment, { flex: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder }]}>
                    <Text style={[s.feeSegText, { color: COLORS.muted, fontSize: 8 }]}>8%</Text>
                  </View>
                  <View style={[s.feeSegment, { flex: 2, backgroundColor: COLORS.green }]}>
                  </View>
                </View>
                <View style={s.feeLabels}>
                  <Text style={s.feeLabel}><Text style={{ color: COLORS.gold, fontWeight: '900' }}>90%</Text> to you (creator)</Text>
                  <Text style={s.feeLabel}><Text style={{ color: COLORS.muted, fontWeight: '900' }}>8%</Text> protocol</Text>
                  <Text style={s.feeLabel}><Text style={{ color: COLORS.green, fontWeight: '900' }}>2%</Text> gas</Text>
                </View>
              </View>

              {/* Features */}
              <View style={s.section}>
                <Text style={s.sectionLabel}>WHAT YOU GET</Text>
                {FEATURES.map((f, i) => (
                  <View key={i} style={s.featureCard}>
                    <View style={s.featureIcon}>
                      <Ionicons name={f.icon as any} size={20} color={COLORS.gold} />
                    </View>
                    <View style={s.featureInfo}>
                      <Text style={s.featureTitle}>{f.title}</Text>
                      <Text style={s.featureDesc}>{f.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* How it works */}
              <View style={s.section}>
                <Text style={s.sectionLabel}>HOW IT WORKS</Text>
                {STEPS_INFO.map((st, i) => (
                  <View key={i} style={s.stepRow}>
                    <View style={s.stepCircle}><Text style={s.stepNum}>{st.n}</Text></View>
                    {i < STEPS_INFO.length - 1 && <View style={s.stepLine} />}
                    <Text style={s.stepText}>{st.text}</Text>
                  </View>
                ))}
              </View>

              {/* Requirements */}
              <View style={s.section}>
                <Text style={s.sectionLabel}>REQUIREMENTS</Text>
                <View style={s.reqCard}>
                  <View style={s.reqRow}>
                    <Ionicons name={profile?.is_verified ? 'checkmark-circle' : 'close-circle'} size={18} color={profile?.is_verified ? COLORS.green : COLORS.red} />
                    <Text style={s.reqText}>Verified account (X or size verification)</Text>
                    {!profile?.is_verified && (
                      <TouchableOpacity onPress={() => router.push('/verify' as any)}>
                        <Text style={s.reqLink}>Get Verified</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={s.reqRow}>
                    <Ionicons name={profile?.wallet_address ? 'checkmark-circle' : 'close-circle'} size={18} color={profile?.wallet_address ? COLORS.green : COLORS.red} />
                    <Text style={s.reqText}>Wallet connected</Text>
                    {!profile?.wallet_address && (
                      <TouchableOpacity onPress={() => router.push('/(tabs)/earn' as any)}>
                        <Text style={s.reqLink}>Connect</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={[s.ctaBtn, (!profile?.is_verified || !profile?.wallet_address) && s.ctaBtnDisabled]}
                onPress={() => setStep('form')}
                disabled={!profile?.is_verified || !profile?.wallet_address}
              >
                <Ionicons name="rocket" size={18} color={COLORS.bg} />
                <Text style={s.ctaBtnText}>Create Your DickCoin</Text>
              </TouchableOpacity>

              <Text style={s.ctaSub}>Free to launch. No upfront cost. You earn from day one.</Text>
            </>
          )}

          {/* ── FORM STEP ── */}
          {step === 'form' && (
            <>
              <View style={s.section}>
                <Text style={s.sectionLabel}>TOKEN NAME</Text>
                <TextInput style={s.input} placeholder="e.g. JackCoin" placeholderTextColor={COLORS.mutedDark} value={name} onChangeText={setName} maxLength={32} />
              </View>

              <View style={s.section}>
                <Text style={s.sectionLabel}>TICKER</Text>
                <TextInput style={s.input} placeholder="e.g. $JACK" placeholderTextColor={COLORS.mutedDark} value={ticker} onChangeText={t => setTicker(t.toUpperCase().slice(0, 9))} autoCapitalize="characters" maxLength={9} />
              </View>

              <View style={s.section}>
                <Text style={s.sectionLabel}>DESCRIPTION (OPTIONAL)</Text>
                <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="What's your coin about? Max 280 chars." placeholderTextColor={COLORS.mutedDark} value={description} onChangeText={setDescription} multiline maxLength={280} />
                <Text style={s.charCount}>{description.length}/280</Text>
              </View>

              <View style={s.section}>
                <Text style={s.sectionLabel}>COIN IMAGE</Text>

                {/* AI Generated Logo */}
                {logoUrl ? (
                  <View style={s.logoResultWrap}>
                    <Image source={{ uri: logoUrl }} style={s.logoResult} resizeMode="cover" />
                    <View style={s.logoActions}>
                      {logoRemaining > 0 && (
                        <TouchableOpacity style={s.regenBtn} onPress={generateLogo} disabled={generatingLogo}>
                          {generatingLogo ? (
                            <ActivityIndicator size="small" color={COLORS.gold} />
                          ) : (
                            <>
                              <Ionicons name="refresh" size={16} color={COLORS.gold} />
                              <Text style={s.regenBtnText}>Regenerate ({logoRemaining} left)</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={s.uploadBtn} onPress={pickImage}>
                        <Ionicons name="cloud-upload-outline" size={16} color={COLORS.muted} />
                        <Text style={s.uploadBtnText}>Upload own</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={s.logoGenWrap}>
                    <TouchableOpacity style={s.genBtn} onPress={generateLogo} disabled={generatingLogo}>
                      {generatingLogo ? (
                        <View style={s.genLoading}>
                          <ActivityIndicator size="small" color={COLORS.gold} />
                          <Text style={s.genLoadingText}>Generating logo...</Text>
                        </View>
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={24} color={COLORS.gold} />
                          <Text style={s.genBtnTitle}>Generate AI Logo</Text>
                          <Text style={s.genBtnSub}>
                            {profile?.is_verified ? 'Free for verified users' : '500 $SIZE coins per generation'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <Text style={s.orText}>— or —</Text>
                    <TouchableOpacity style={s.imagePicker} onPress={pickImage}>
                      <View style={s.imagePreview}>
                        <Ionicons name="image-outline" size={24} color={COLORS.muted} />
                        <Text style={s.imagePickerText}>Upload your own (1:1 square)</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity style={s.ctaBtn} onPress={handleLaunch}>
                <Ionicons name="rocket" size={18} color={COLORS.bg} />
                <Text style={s.ctaBtnText}>Launch DickCoin</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.backLink} onPress={() => setStep('info')}>
                <Text style={s.backLinkText}>Back to info</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── LAUNCHING ── */}
          {step === 'launching' && (
            <View style={s.center}>
              <ActivityIndicator size="large" color={COLORS.gold} />
              <Text style={s.launchingTitle}>Deploying on Base...</Text>
              <Text style={s.launchingSub}>Your token is being deployed via Clanker into a Uniswap V4 pool. This takes about 30 seconds.</Text>
            </View>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <View style={s.center}>
              <Ionicons name="checkmark-circle" size={64} color={COLORS.green} />
              <Text style={s.successTitle}>{name} is live</Text>
              <Text style={s.successTicker}>{ticker}</Text>
              <Text style={s.successDesc}>Your DickCoin is deployed on Base and tradeable now.</Text>

              <View style={s.addressCard}>
                <Text style={s.addressLabel}>CONTRACT</Text>
                <Text style={s.addressValue} selectable>{contractAddress}</Text>
              </View>

              <TouchableOpacity style={s.actionBtn} onPress={() => { if (typeof window !== 'undefined') window.open(`https://basescan.org/token/${contractAddress}`, '_blank'); }}>
                <Ionicons name="open-outline" size={16} color={COLORS.gold} />
                <Text style={s.actionBtnText}>View on Basescan</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.actionBtn} onPress={() => router.push(`/circle-jerk/${contractAddress}` as any)}>
                <Ionicons name="chatbubbles-outline" size={16} color={COLORS.gold} />
                <Text style={s.actionBtnText}>Enter your Circle Jerk</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.ctaBtn} onPress={() => router.push('/(tabs)' as any)}>
                <Text style={s.ctaBtnText}>Back to Feed</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <View style={s.center}>
              <Ionicons name="close-circle" size={64} color={COLORS.red} />
              <Text style={s.errorTitle}>Launch Failed</Text>
              <Text style={s.errorDesc}>{error}</Text>
              <TouchableOpacity style={s.ctaBtn} onPress={() => { setStep('form'); setError(''); }}>
                <Text style={s.ctaBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </PageContainer>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  headerText: { fontSize: SIZES.lg, fontWeight: '900', color: COLORS.white, letterSpacing: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },

  // Hero
  heroCard: { borderRadius: RADIUS.xl, borderWidth: 1, borderColor: `${COLORS.gold}35`, overflow: 'hidden', marginBottom: 20 },
  heroInner: { padding: 28, alignItems: 'center', gap: 12 },
  heroTitle: { fontSize: SIZES.xxl, fontWeight: '900', color: COLORS.white, textAlign: 'center', letterSpacing: 0.5 },
  heroSub: { fontSize: SIZES.md, color: COLORS.muted, textAlign: 'center', lineHeight: 22 },

  // Sections
  section: { marginBottom: 20 },
  sectionLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 10 },

  // Fee bar
  feeBar: { flexDirection: 'row', height: 40, borderRadius: RADIUS.md, overflow: 'hidden', gap: 2 },
  feeSegment: { borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  feeSegText: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.sm },
  feeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  feeLabel: { color: COLORS.muted, fontSize: SIZES.xs },

  // Features
  featureCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14, marginBottom: 8 },
  featureIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: `${COLORS.gold}15`, borderWidth: 1, borderColor: `${COLORS.gold}25`, alignItems: 'center', justifyContent: 'center' },
  featureInfo: { flex: 1 },
  featureTitle: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  featureDesc: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2, lineHeight: 16 },

  // Steps
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14, position: 'relative' as any },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: `${COLORS.gold}20`, borderWidth: 1, borderColor: `${COLORS.gold}40`, alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: COLORS.gold, fontWeight: '900', fontSize: SIZES.xs },
  stepLine: { position: 'absolute' as any, left: 13, top: 28, width: 1, height: 14, backgroundColor: COLORS.cardBorder },
  stepText: { flex: 1, color: COLORS.offWhite, fontSize: SIZES.sm, lineHeight: 20, paddingTop: 4 },

  // Requirements
  reqCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14, gap: 10 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reqText: { flex: 1, color: COLORS.offWhite, fontSize: SIZES.sm },
  reqLink: { color: COLORS.gold, fontWeight: '700', fontSize: SIZES.sm },

  // CTA
  ctaBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  ctaBtnDisabled: { opacity: 0.3 },
  ctaBtnText: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.base },
  ctaSub: { color: COLORS.muted, fontSize: SIZES.xs, textAlign: 'center', marginTop: 8 },

  // Form
  input: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.white, fontSize: SIZES.base },
  charCount: { color: COLORS.mutedDark, fontSize: SIZES.xs, textAlign: 'right', marginTop: 4 },
  imagePicker: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, padding: 20, alignItems: 'center' },
  imagePreview: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  imagePickerText: { color: COLORS.muted, fontSize: SIZES.sm },
  // Logo generation
  logoGenWrap: { gap: 12 },
  genBtn: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: `${COLORS.gold}40`, borderRadius: RADIUS.lg, padding: 24, alignItems: 'center', gap: 8 },
  genBtnTitle: { color: COLORS.gold, fontSize: SIZES.lg, fontWeight: '800' },
  genBtnSub: { color: COLORS.muted, fontSize: SIZES.xs },
  genLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  genLoadingText: { color: COLORS.gold, fontSize: SIZES.md, fontWeight: '700' },
  orText: { color: COLORS.mutedDark, fontSize: SIZES.xs, textAlign: 'center', letterSpacing: 2 },
  logoResultWrap: { alignItems: 'center', gap: 12 },
  logoResult: { width: 200, height: 200, borderRadius: 100, borderWidth: 3, borderColor: COLORS.gold, backgroundColor: COLORS.card },
  logoActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  regenBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${COLORS.gold}15`, borderWidth: 1, borderColor: `${COLORS.gold}40`, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
  regenBtnText: { color: COLORS.gold, fontSize: SIZES.sm, fontWeight: '700' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8 },
  uploadBtnText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '600' },
  error: { color: COLORS.red, fontSize: SIZES.sm, textAlign: 'center', marginVertical: 8 },
  backLink: { alignItems: 'center', marginTop: 12 },
  backLinkText: { color: COLORS.muted, fontSize: SIZES.sm },

  // States
  center: { alignItems: 'center', paddingTop: 40, gap: 12 },
  launchingTitle: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white },
  launchingSub: { fontSize: SIZES.sm, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 24 },
  successTitle: { fontSize: SIZES.xxl, fontWeight: '900', color: COLORS.white },
  successTicker: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.gold },
  successDesc: { fontSize: SIZES.sm, color: COLORS.muted, textAlign: 'center' },
  addressCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14, width: '100%', marginTop: 16, gap: 4 },
  addressLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  addressValue: { color: COLORS.white, fontSize: SIZES.sm, fontFamily: 'monospace' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.cardBorder, paddingVertical: 12, paddingHorizontal: 20, marginTop: 8, width: '100%', justifyContent: 'center' },
  actionBtnText: { color: COLORS.gold, fontWeight: '700', fontSize: SIZES.sm },
  errorTitle: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white },
  errorDesc: { fontSize: SIZES.sm, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 24 },
});
