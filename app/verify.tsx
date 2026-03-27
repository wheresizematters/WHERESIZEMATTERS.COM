import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ActivityIndicator, ScrollView, Image, Platform, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getToken } from '@/lib/supabase';
import { usePurchase } from '@/context/PurchaseContext';
import PaywallModal from '@/components/PaywallModal';
import {
  fetchMyVerificationRequest,
  submitVerificationPhoto,
  runVerification,
  awardCoins,
} from '@/lib/api';

type Step = 'checking' | 'already_verified' | 'pending_review' | 'instructions' | 'girth' | 'photo' | 'uploading' | 'result_verified' | 'result_pending' | 'error';

const REFERENCE_OBJECTS = [
  { icon: 'card', label: 'Credit card', detail: '3.37" wide — lay it flat beside the subject' },
  { icon: 'cash', label: 'Dollar bill', detail: '6.14" long — place alongside' },
  { icon: 'ruler', label: 'Ruler / tape', detail: 'Most accurate — measure directly' },
];

export default function VerifyScreen() {
  const router = useRouter();
  const { profile, session, updateProfile } = useAuth();
  const { isPremium } = usePurchase();
  const [step, setStep] = useState<Step>('checking');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [girthInput, setGirthInput] = useState(profile?.girth_inches?.toString() ?? '');
  const [girthError, setGirthError] = useState('');
  const [pendingSource, setPendingSource] = useState<'camera' | 'library'>('camera');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [verifyType, setVerifyType] = useState<'size' | 'face' | 'bra'>('size');

  useEffect(() => {
    if (!session?.user.id) return;
    if (profile?.is_verified) { setStep('already_verified'); return; }

    fetchMyVerificationRequest(session.user.id).then(req => {
      if (!req) { setStep('instructions'); return; }
      if (req.status === 'pending') setStep('pending_review');
      else setStep('instructions'); // rejected — can retry
    }).catch(() => setStep('instructions'));
  }, [session?.user.id, profile?.is_verified]);

  function goToGirth(source: 'camera' | 'library') {
    setPendingSource(source);
    setGirthError('');
    setStep('girth');
  }

  async function confirmGirthAndProceed() {
    setGirthError('');
    // Girth is optional — save if provided, skip if not
    const val = parseFloat(girthInput);
    if (girthInput.trim() && !isNaN(val) && val > 0 && val <= 12) {
      await updateProfile({ girth_inches: val });
    }
    if (pendingSource === 'camera') {
      await pickPhoto();
    } else {
      await pickFromLibrary();
    }
  }

  async function pickPhoto() {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermission.granted) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;
      setPhotoUri(result.assets[0].uri);
      setStep('photo');
    } else {
      const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!library.granted) { setErrorMsg('Camera or photo library access is required.'); setStep('error'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      setPhotoUri(result.assets[0].uri);
      setStep('photo');
    }
  }

  async function pickFromLibrary() {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { setErrorMsg('Photo library access is required.'); setStep('error'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;
    setPhotoUri(result.assets[0].uri);
    setStep('photo');
  }

  async function submitPhoto() {
    if (!photoUri || !session?.user.id || !profile) return;
    setStep('uploading');

    const { imagePath, error: uploadError } = await submitVerificationPhoto(
      session.user.id,
      photoUri,
      profile.size_inches,
    );

    if (uploadError || !imagePath) {
      setErrorMsg(uploadError ?? 'Upload failed.');
      setStep('error');
      return;
    }

    const result = await runVerification(imagePath, profile.size_inches, profile.girth_inches, verifyType);

    if (result.status === 'auto_verified') {
      await updateProfile({ is_verified: true });
      setStep('result_verified');
    } else if (result.status === 'rejected') {
      setErrorMsg(result.reason ?? 'Verification failed. Try again with a clearer photo and a reference object.');
      setStep('error');
    } else {
      // Shouldn't happen anymore but handle gracefully
      setStep('result_verified');
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push('/profile' as any)} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>VERIFY SIZE</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* ── Checking ── */}
        {step === 'checking' && (
          <View style={s.centered}>
            <ActivityIndicator color={COLORS.gold} size="large" />
          </View>
        )}

        {/* ── Already verified ── */}
        {step === 'already_verified' && (
          <View style={s.centered}>
            <View style={s.iconCircle}>
              <Ionicons name="shield-checkmark" size={48} color={COLORS.gold} />
            </View>
            <Text style={s.resultTitle}>Already Verified</Text>
            <Text style={s.resultSub}>Your size has been confirmed. The verified badge is active on your profile and leaderboard entry.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/profile' as any)}>
              <Text style={s.primaryBtnText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Pending review ── */}
        {step === 'pending_review' && (
          <View style={s.centered}>
            <View style={[s.iconCircle, { backgroundColor: `${COLORS.blue}20` }]}>
              <Ionicons name="time-outline" size={48} color={COLORS.blue} />
            </View>
            <Text style={s.resultTitle}>Under Review</Text>
            <Text style={s.resultSub}>Your verification photo has been submitted and is awaiting manual review. You'll be verified shortly.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/profile' as any)}>
              <Text style={s.primaryBtnText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Instructions ── */}
        {step === 'instructions' && (
          <>
              {/* Hero */}
              <View style={s.heroSection}>
                <View style={s.iconCircle}>
                  <Ionicons name="shield-checkmark-outline" size={40} color={COLORS.gold} />
                </View>
                <Text style={s.heroTitle}>Get Verified</Text>
                <Text style={s.heroSub}>
                  Verify with AI, card, or $SIZE tokens. Choose what you want to verify.
                </Text>
              </View>

              {/* Verification type selector */}
              
              <View style={s.typeRow}>
                <TouchableOpacity
                  style={[s.typeCard, verifyType === 'size' && s.typeCardActive]}
                  onPress={() => setVerifyType('size')}
                >
                  <Ionicons name="resize" size={22} color={verifyType === 'size' ? COLORS.gold : COLORS.muted} />
                  <Text style={[s.typeCardLabel, verifyType === 'size' && s.typeCardLabelActive]}>Size</Text>
                  
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.typeCard, verifyType === 'face' && s.typeCardActive]}
                  onPress={() => setVerifyType('face')}
                >
                  <Ionicons name="person-circle" size={22} color={verifyType === 'face' ? COLORS.gold : COLORS.muted} />
                  <Text style={[s.typeCardLabel, verifyType === 'face' && s.typeCardLabelActive]}>Face</Text>
                  
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.typeCard, verifyType === 'bra' && s.typeCardActive]}
                  onPress={() => setVerifyType('bra')}
                >
                  <Ionicons name="heart" size={22} color={verifyType === 'bra' ? COLORS.purple : COLORS.muted} />
                  <Text style={[s.typeCardLabel, verifyType === 'bra' && { color: COLORS.purple }]}>Other</Text>
                  
                </TouchableOpacity>
              </View>

              {/* Payment cards */}
              <Text style={s.sectionLabel}>PAY TO VERIFY</Text>
              <View style={s.payCards}>
                <TouchableOpacity
                  style={s.payCard}
                  onPress={() => {
                    const { stripeCheckout } = require('@/lib/purchases');
                    stripeCheckout('monthly', session?.user.id ?? '');
                  }}
                >
                  <Text style={s.payCardPrice}>$10</Text>
                  <Text style={s.payCardMethod}>Pay with Card</Text>
                  <Text style={s.payCardDesc}>via Stripe</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.payCard, s.payCardToken]}
                  onPress={async () => {
                    if (!profile?.wallet_address) {
                      window.alert('Connect your wallet first (go to Grow tab)');
                      return;
                    }
                    try {
                      const res = await fetch('/api/v1/verifications/token-verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
                        body: JSON.stringify({ walletAddress: profile.wallet_address }),
                      });
                      const data = await res.json();
                      if (data.error) {
                        window.alert(data.error);
                      } else if (data.status === 'verified') {
                        await updateProfile({ is_verified: true });
                        setStep('result_verified');
                      }
                    } catch {
                      window.alert('Failed to verify with tokens');
                    }
                  }}
                >
                  <Text style={s.payCardPrice}>$20</Text>
                  <Text style={s.payCardMethod}>Pay with $SIZE</Text>
                  <Text style={s.payCardDesc}>50% burned / 50% to protocol</Text>
                  <Text style={s.payCardNote}>2x premium — supports the ecosystem</Text>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={s.orDivider}>
                <View style={s.orLine} />
                <Text style={s.orText}>or verify for free with AI</Text>
                <View style={s.orLine} />
              </View>

              {/* AI verification flow */}
              <>
                <View style={s.heroSection}>
                  <View style={s.iconCircle}>
                    <Ionicons name="shield-checkmark-outline" size={40} color={COLORS.gold} />
                  </View>
                  <Text style={s.heroTitle}>Get Verified</Text>
                  <Text style={s.heroSub}>
                    Submit a photo with a reference object in frame. Our AI measures the scale and confirms your size.
                  </Text>
                </View>

                <Text style={s.sectionLabel}>REFERENCE OBJECTS</Text>
                <View style={s.refList}>
                  {REFERENCE_OBJECTS.map(item => (
                    <View key={item.label} style={s.refRow}>
                      <Text style={s.refIcon}>{item.icon}</Text>
                      <View style={s.refText}>
                        <Text style={s.refLabel}>{item.label}</Text>
                        <Text style={s.refDetail}>{item.detail}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <Text style={s.sectionLabel}>PHOTO TIPS</Text>
                <View style={s.tipList}>
                  {[
                    'Shoot from directly above in good lighting',
                    'Keep both the subject and reference object fully in frame',
                    'Measure erect length from base to tip along the top',
                    'Your photo is deleted immediately after review',
                  ].map((tip, i) => (
                    <View key={i} style={s.tipRow}>
                      <View style={s.tipDot} />
                      <Text style={s.tipText}>{tip}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.privacyNote}>
                  <Ionicons name="lock-closed-outline" size={14} color={COLORS.muted} />
                  <Text style={s.privacyText}>
                    Photos are stored encrypted, never shared, and permanently deleted after verification — whether approved or rejected.
                  </Text>
                </View>

                <TouchableOpacity style={s.primaryBtn} onPress={() => goToGirth('camera')}>
                  <Ionicons name="camera-outline" size={18} color={COLORS.bg} />
                  <Text style={s.primaryBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => goToGirth('library')}>
                  <Ionicons name="images-outline" size={18} color={COLORS.gold} />
                  <Text style={s.secondaryBtnText}>Choose from Library</Text>
                </TouchableOpacity>

              </>
          </>
        )}

        {/* ── Girth entry (required for verification) ── */}
        {step === 'girth' && (
          <>
            <View style={s.heroSection}>
              <View style={s.iconCircle}>
                <Ionicons name="expand-outline" size={40} color={COLORS.gold} />
              </View>
              <Text style={s.heroTitle}>Enter Your Girth</Text>
              <Text style={s.heroSub}>
                Girth is optional. If provided, our AI can cross-check both dimensions for higher confidence.
              </Text>
            </View>

            <Text style={s.sectionLabel}>GIRTH (optional)</Text>
            <View style={s.girthRow}>
              <TextInput
                style={s.girthInput}
                value={girthInput}
                onChangeText={setGirthInput}
                keyboardType="decimal-pad"
                placeholder='e.g. 5.0"'
                placeholderTextColor={COLORS.muted}
                autoFocus
              />
              <Text style={s.girthUnit}>inches</Text>
            </View>
            {girthError ? <Text style={s.girthError}>{girthError}</Text> : null}

            <TouchableOpacity style={[s.primaryBtn, { marginTop: 24 }]} onPress={confirmGirthAndProceed}>
              <Text style={s.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryBtn} onPress={() => setStep('instructions')}>
              <Text style={s.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Photo preview ── */}
        {step === 'photo' && photoUri && (
          <>
            <Text style={s.sectionLabel}>REVIEW PHOTO</Text>
            <Image source={{ uri: photoUri }} style={s.preview} resizeMode="cover" />
            <Text style={s.previewHint}>Make sure a reference object is clearly visible alongside the subject.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={submitPhoto}>
              <Ionicons name="cloud-upload-outline" size={18} color={COLORS.bg} />
              <Text style={s.primaryBtnText}>Submit for Verification</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryBtn} onPress={() => { setPhotoUri(null); setStep('instructions'); }}>
              <Text style={s.secondaryBtnText}>Retake Photo</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Uploading ── */}
        {step === 'uploading' && (
          <View style={s.centered}>
            <ActivityIndicator color={COLORS.gold} size="large" />
            <Text style={s.uploadingText}>Analyzing photo...</Text>
            <Text style={s.uploadingSub}>Our AI is checking your reference object and estimating your size.</Text>
          </View>
        )}

        {/* ── Auto verified ── */}
        {step === 'result_verified' && (
          <View style={s.centered}>
            <View style={s.iconCircle}>
              <Ionicons name="shield-checkmark" size={48} color={COLORS.gold} />
            </View>
            <Text style={s.resultTitle}>Verified!</Text>
            <Text style={s.resultSub}>Your size has been confirmed by our AI. The verified badge is now active on your profile.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/profile' as any)}>
              <Text style={s.primaryBtnText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Pending manual review ── */}
        {step === 'result_pending' && (
          <View style={s.centered}>
            <View style={[s.iconCircle, { backgroundColor: `${COLORS.blue}20` }]}>
              <Ionicons name="time-outline" size={48} color={COLORS.blue} />
            </View>
            <Text style={s.resultTitle}>Under Review</Text>
            <Text style={s.resultSub}>Our AI couldn't auto-verify from this photo. Your submission has been queued for manual review — you'll be verified shortly.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/profile' as any)}>
              <Text style={s.primaryBtnText}>Back to Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Error ── */}
        {step === 'error' && (
          <View style={s.centered}>
            <View style={[s.iconCircle, { backgroundColor: `${COLORS.red}20` }]}>
              <Ionicons name="alert-circle-outline" size={48} color={COLORS.red} />
            </View>
            <Text style={s.resultTitle}>Something went wrong</Text>
            <Text style={s.resultSub}>{errorMsg}</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={() => setStep('instructions')}>
              <Text style={s.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        trigger="Get verified with a SIZE. Premium subscription"
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // Type selector
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 12, alignItems: 'center', gap: 4 },
  typeCardActive: { borderColor: `${COLORS.gold}60`, backgroundColor: `${COLORS.gold}10` },
  typeCardLabel: { color: COLORS.muted, fontWeight: '700', fontSize: SIZES.sm },
  typeCardLabelActive: { color: COLORS.gold },
  typeCardDesc: { color: COLORS.mutedDark, fontSize: 9, textAlign: 'center' as any },

  // Payment cards
  payCards: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  payCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, alignItems: 'center', gap: 4 },
  payCardToken: { borderColor: `${COLORS.gold}40`, backgroundColor: `${COLORS.gold}08` },
  payCardPrice: { fontSize: SIZES.xxl, fontWeight: '900', color: COLORS.gold },
  payCardMethod: { fontSize: SIZES.sm, fontWeight: '700', color: COLORS.white },
  payCardDesc: { fontSize: SIZES.xs, color: COLORS.muted },
  payCardNote: { fontSize: 9, color: COLORS.gold, fontWeight: '600', marginTop: 4, textAlign: 'center' as any },
  orDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.cardBorder },
  orText: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '600' },

  // Token verify
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.cardBorder },
  dividerLabel: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '600' },
  tokenVerifyCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}30`, padding: 16, gap: 10 },
  tokenVerifyTitle: { color: COLORS.white, fontWeight: '800', fontSize: SIZES.md },
  tokenVerifyDesc: { color: COLORS.muted, fontSize: SIZES.xs, lineHeight: 18 },
  tokenVerifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 14 },
  tokenVerifyBtnText: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.sm },

  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: SIZES.md, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  body: { padding: 20, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 16 },

  heroSection: { alignItems: 'center', gap: 12, marginBottom: 28 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${COLORS.gold}20`, borderWidth: 1, borderColor: `${COLORS.gold}40`,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: SIZES.xxl, fontWeight: '900', color: COLORS.white },
  heroSub: { color: COLORS.muted, fontSize: SIZES.md, textAlign: 'center', lineHeight: 22 },

  sectionLabel: {
    color: COLORS.gold, fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 2,
    marginBottom: 12, marginTop: 4,
  },
  refList: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.cardBorder, marginBottom: 24, overflow: 'hidden',
  },
  refRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  refIcon: { fontSize: 24 },
  refText: { flex: 1 },
  refLabel: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '700' },
  refDetail: { color: COLORS.muted, fontSize: SIZES.sm, marginTop: 2 },

  tipList: { gap: 10, marginBottom: 24 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.gold, marginTop: 6 },
  tipText: { color: COLORS.offWhite, fontSize: SIZES.md, flex: 1, lineHeight: 20 },

  privacyNote: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: `${COLORS.muted}10`, borderRadius: RADIUS.md, padding: 14,
    borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 24,
  },
  privacyText: { color: COLORS.muted, fontSize: SIZES.sm, flex: 1, lineHeight: 18 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 16,
    marginBottom: 12,
  },
  primaryBtnText: { color: COLORS.bg, fontSize: SIZES.md, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md, paddingVertical: 16,
    borderWidth: 1, borderColor: `${COLORS.gold}40`, marginBottom: 12,
  },
  secondaryBtnText: { color: COLORS.gold, fontSize: SIZES.md, fontWeight: '700' },

  girthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  girthInput: {
    flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md, paddingHorizontal: 18, paddingVertical: 16,
    color: COLORS.white, fontSize: SIZES.base,
  },
  girthUnit: { color: COLORS.gold, fontSize: SIZES.lg, fontWeight: '700', width: 52 },
  girthError: { color: COLORS.red, fontSize: SIZES.sm, textAlign: 'center', marginBottom: 8 },

  preview: { width: '100%', height: 320, borderRadius: RADIUS.lg, marginBottom: 12 },
  previewHint: { color: COLORS.muted, fontSize: SIZES.sm, textAlign: 'center', marginBottom: 20 },

  uploadingText: { color: COLORS.white, fontSize: SIZES.xl, fontWeight: '800', marginTop: 16 },
  uploadingSub: { color: COLORS.muted, fontSize: SIZES.md, textAlign: 'center', lineHeight: 22, paddingHorizontal: 24 },

  resultTitle: { fontSize: SIZES.xxl, fontWeight: '900', color: COLORS.white, textAlign: 'center' },
  resultSub: { color: COLORS.muted, fontSize: SIZES.md, textAlign: 'center', lineHeight: 22, paddingHorizontal: 24, marginBottom: 8 },
});
