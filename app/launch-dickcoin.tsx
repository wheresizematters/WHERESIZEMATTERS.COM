import { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import PageContainer from '@/components/PageContainer';
import { getToken, getApiUrl, SUPABASE_READY } from '@/lib/supabase';
import { launchDickCoin } from '@/lib/dickcoin';
import * as ImagePicker from 'expo-image-picker';

type Step = 'form' | 'launching' | 'success' | 'error';

export default function LaunchDickCoinScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();

  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState(profile?.username ? `${profile.username}Coin` : '');
  const [ticker, setTicker] = useState(profile?.username ? `$${profile.username.toUpperCase().slice(0, 7)}` : '');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Success data
  const [contractAddress, setContractAddress] = useState('');
  const [txHash, setTxHash] = useState('');

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

  async function handleLaunch() {
    if (!session?.user.id || !profile?.wallet_address) {
      setError('Connect your wallet first (go to Earn tab)');
      return;
    }
    if (!profile?.is_verified) {
      setError('You must be verified to launch a DickCoin');
      return;
    }
    if (!name.trim()) { setError('Enter a name'); return; }
    if (!ticker.trim() || ticker.length > 9) { setError('Ticker must be 1-8 characters'); return; }
    if (!imageUri) { setError('Upload an image for your coin'); return; }

    setStep('launching');
    setError('');

    try {
      // Upload image via S3 presigned URL
      let imageUrl = '';
      const API = getApiUrl();
      const authToken = getToken() ?? '';
      if (SUPABASE_READY && imageUri && API) {
        const ext = imageUri.split('.').pop() ?? 'jpg';
        const path = `dickcoin-images/${session.user.id}/${Date.now()}.${ext}`;
        const contentType = 'image/jpeg';
        const urlRes = await fetch(`${API}/api/v1/storage/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ bucket: 'dickcoin-images', path, contentType }),
        });
        if (!urlRes.ok) { setError('Image upload failed'); setStep('form'); return; }
        const { uploadUrl, publicUrl } = await urlRes.json();
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const uploadRes = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
        if (!uploadRes.ok) { setError('Image upload failed'); setStep('form'); return; }
        imageUrl = publicUrl;
      }

      const token = authToken;

      // Launch via backend → Clanker
      const result = await launchDickCoin({
        name: name.trim(),
        ticker: ticker.trim().replace('$', '').toUpperCase(),
        description: description.trim() || undefined,
        imageUrl,
        creatorAddress: profile.wallet_address!,
      }, token);

      if (result.error) {
        setError(result.error);
        setStep('error');
        return;
      }

      setContractAddress(result.contractAddress);
      setTxHash(result.txHash);
      setStep('success');
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
      setStep('error');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push("/(tabs)" as any)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerText}>Launch DickCoin</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {step === 'form' && (
            <>
              {/* Explainer */}
              <View style={styles.explainer}>
                <Ionicons name="rocket-outline" size={32} color={COLORS.gold} />
                <Text style={styles.explainerTitle}>Launch your personal memecoin</Text>
                <Text style={styles.explainerDesc}>
                  Deploy an ERC-20 token on Base via Clanker. Your coin gets a Uniswap V4 pool and a Circle Jerk community instantly. You earn 90% of all trading fees forever.
                </Text>
              </View>

              {/* Form */}
              <View style={styles.formSection}>
                <Text style={styles.label}>TOKEN NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. JackCoin"
                  placeholderTextColor={COLORS.mutedDark}
                  value={name}
                  onChangeText={setName}
                  maxLength={32}
                />

                <Text style={styles.label}>TICKER</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. $JACK"
                  placeholderTextColor={COLORS.mutedDark}
                  value={ticker}
                  onChangeText={(t) => setTicker(t.toUpperCase().slice(0, 9))}
                  autoCapitalize="characters"
                  maxLength={9}
                />

                <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  placeholder="What's your coin about? Max 280 characters."
                  placeholderTextColor={COLORS.mutedDark}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={280}
                />
                <Text style={styles.charCount}>{description.length}/280</Text>

                <Text style={styles.label}>COIN IMAGE</Text>
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                  {imageUri ? (
                    <View style={styles.imagePreview}>
                      <Ionicons name="checkmark-circle" size={24} color={COLORS.green} />
                      <Text style={styles.imagePickerText}>Image selected</Text>
                    </View>
                  ) : (
                    <View style={styles.imagePreview}>
                      <Ionicons name="image-outline" size={24} color={COLORS.muted} />
                      <Text style={styles.imagePickerText}>Tap to upload (1:1 square)</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Fee info */}
              <View style={styles.feeInfo}>
                <Text style={styles.feeTitle}>Fee Split on Every Trade</Text>
                <View style={styles.feeRow}>
                  <View style={styles.feeDot} />
                  <Text style={styles.feeText}><Text style={{ color: COLORS.gold, fontWeight: '900' }}>90%</Text> of ETH fees go to you (the creator)</Text>
                </View>
                <View style={styles.feeRow}>
                  <View style={[styles.feeDot, { backgroundColor: COLORS.blue }]} />
                  <Text style={styles.feeText}><Text style={{ color: COLORS.blue, fontWeight: '900' }}>10%</Text> goes to SIZE. protocol</Text>
                </View>
              </View>

              {/* What happens */}
              <View style={styles.stepsCard}>
                <Text style={styles.stepsTitle}>What happens when you launch</Text>
                <StepItem n={1} text="Your ERC-20 token deploys on Base via Clanker" />
                <StepItem n={2} text="A Uniswap V4 liquidity pool opens immediately" />
                <StepItem n={3} text="A Circle Jerk (token-gated group chat) spawns for holders" />
                <StepItem n={4} text="You earn 90% of every trade fee — forever, on-chain" />
                <StepItem n={5} text="At 0.5 ETH in fees, staking auto-deploys for your coin" />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* Requirements */}
              {!profile?.is_verified && (
                <View style={styles.reqCard}>
                  <Ionicons name="alert-circle" size={18} color={COLORS.gold} />
                  <Text style={styles.reqText}>You need to be verified to launch a DickCoin</Text>
                  <TouchableOpacity onPress={() => router.push('/verify' as any)}>
                    <Text style={styles.reqLink}>Get Verified</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!profile?.wallet_address && (
                <View style={styles.reqCard}>
                  <Ionicons name="wallet-outline" size={18} color={COLORS.gold} />
                  <Text style={styles.reqText}>Connect your wallet first</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/earn' as any)}>
                    <Text style={styles.reqLink}>Go to Earn</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.launchBtn, (!profile?.is_verified || !profile?.wallet_address) && styles.launchBtnDisabled]}
                onPress={handleLaunch}
                disabled={!profile?.is_verified || !profile?.wallet_address}
              >
                <Ionicons name="rocket" size={18} color={COLORS.bg} />
                <Text style={styles.launchBtnText}>Launch DickCoin</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'launching' && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={COLORS.gold} />
              <Text style={styles.launchingTitle}>Deploying on Base...</Text>
              <Text style={styles.launchingDesc}>This takes about 30 seconds. Your token is being deployed via Clanker into a Uniswap V4 pool.</Text>
            </View>
          )}

          {step === 'success' && (
            <View style={styles.center}>
              <Ionicons name="checkmark-circle" size={64} color={COLORS.green} />
              <Text style={styles.successTitle}>{name} is live</Text>
              <Text style={styles.successTicker}>{ticker}</Text>
              <Text style={styles.successDesc}>Your DickCoin is deployed on Base and tradeable now.</Text>

              <View style={styles.addressCard}>
                <Text style={styles.addressLabel}>CONTRACT ADDRESS</Text>
                <Text style={styles.addressValue} selectable>{contractAddress}</Text>
              </View>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => { if (typeof window !== 'undefined') window.open(`https://basescan.org/token/${contractAddress}`, '_blank'); }}
              >
                <Ionicons name="open-outline" size={16} color={COLORS.gold} />
                <Text style={styles.actionBtnText}>View on Basescan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push(`/circle-jerk/${contractAddress}` as any)}
              >
                <Ionicons name="chatbubbles-outline" size={16} color={COLORS.gold} />
                <Text style={styles.actionBtnText}>Enter your Circle Jerk</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.launchBtn, { marginTop: 20 }]}
                onPress={() => router.push("/(tabs)" as any)}
              >
                <Text style={styles.launchBtnText}>Back to Feed</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'error' && (
            <View style={styles.center}>
              <Ionicons name="close-circle" size={64} color={COLORS.red} />
              <Text style={styles.errorTitle}>Launch Failed</Text>
              <Text style={styles.errorDesc}>{error}</Text>
              <TouchableOpacity style={styles.launchBtn} onPress={() => { setStep('form'); setError(''); }}>
                <Text style={styles.launchBtnText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </PageContainer>
    </SafeAreaView>
  );
}

function StepItem({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepCircle}><Text style={styles.stepNum}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  headerText: { fontSize: SIZES.lg, fontWeight: '900', color: COLORS.white, letterSpacing: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },

  // Explainer
  explainer: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  explainerTitle: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, textAlign: 'center' },
  explainerDesc: { fontSize: SIZES.md, color: COLORS.muted, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },

  // Form
  formSection: { gap: 6, marginBottom: 20 },
  label: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 12 },
  input: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.white, fontSize: SIZES.base },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { color: COLORS.mutedDark, fontSize: SIZES.xs, textAlign: 'right' },
  imagePicker: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, padding: 20, alignItems: 'center' },
  imagePreview: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  imagePickerText: { color: COLORS.muted, fontSize: SIZES.sm },

  // Fee info
  feeInfo: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, marginBottom: 16, gap: 10 },
  feeTitle: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md, marginBottom: 4 },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold },
  feeText: { color: COLORS.offWhite, fontSize: SIZES.sm, flex: 1 },

  // Steps
  stepsCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, marginBottom: 16, gap: 8 },
  stepsTitle: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md, marginBottom: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: `${COLORS.gold}20`, borderWidth: 1, borderColor: `${COLORS.gold}40`, alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: COLORS.gold, fontWeight: '900', fontSize: 11 },
  stepText: { flex: 1, color: COLORS.offWhite, fontSize: SIZES.sm, lineHeight: 20 },

  // Requirements
  reqCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${COLORS.gold}10`, borderRadius: RADIUS.md, borderWidth: 1, borderColor: `${COLORS.gold}30`, padding: 12, marginBottom: 10 },
  reqText: { flex: 1, color: COLORS.offWhite, fontSize: SIZES.sm },
  reqLink: { color: COLORS.gold, fontWeight: '700', fontSize: SIZES.sm },

  // Launch button
  launchBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  launchBtnDisabled: { opacity: 0.3 },
  launchBtnText: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.base },

  error: { color: COLORS.red, fontSize: SIZES.sm, textAlign: 'center', marginVertical: 8 },

  // States
  center: { alignItems: 'center', paddingTop: 60, gap: 12 },
  launchingTitle: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white },
  launchingDesc: { fontSize: SIZES.sm, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 24 },
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
