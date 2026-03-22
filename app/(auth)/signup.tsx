import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import AuthContainer from '@/components/AuthContainer';

const AGE_RANGES = ['18–24', '25–34', '35–44', '45–54', '55+'];

type OAuthProvider = 'google' | 'x';
const SOCIAL_PROVIDERS: { provider: OAuthProvider; label: string; icon: any; bg: string; color: string }[] = [
  { provider: 'x', label: 'Sign up with X', icon: 'logo-twitter', bg: '#000', color: '#fff' },
  { provider: 'google', label: 'Sign up with Google', icon: 'logo-google', bg: '#fff', color: '#444' },
];

export default function SignupScreen() {
  const { signUp, signInWithOAuth } = useAuth();
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  async function handleOAuth(provider: OAuthProvider) {
    setOauthLoading(provider);
    await signInWithOAuth(provider);
    setOauthLoading(null);
  }
  const [step, setStep] = useState<'account' | 'size'>('account');

  // Step 1
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [agreedTo18, setAgreedTo18] = useState(false);

  // Step 2
  const [sizeInput, setSizeInput] = useState('');
  const [unit, setUnit] = useState<'in' | 'cm'>('in');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function getSizeInches() {
    const val = parseFloat(sizeInput);
    if (isNaN(val)) return 0;
    return unit === 'cm' ? val / 2.54 : val;
  }

  function handleNextStep() {
    if (!email || !password || !username || !ageRange) {
      setError('Fill in all fields'); return;
    }
    if (!agreedTo18) {
      setError('You must be 18+ to join'); return;
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters'); return;
    }
    setError('');
    setStep('size');
  }

  async function handleSignup() {
    const inches = getSizeInches();
    if (!sizeInput || inches <= 0 || inches > 16) {
      setError('Enter a valid size'); return;
    }
    setLoading(true);
    setError('');
    const { error } = await signUp(email.trim(), password, username.trim(), inches, ageRange || undefined);
    if (error) setError(error);
    setLoading(false);
  }

  const tier = sizeInput ? getSizeTier(getSizeInches()) : null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthContainer>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>SIZE.</Text>
          {step === 'account'
            ? <Text style={styles.subtitle}>Create your account</Text>
            : <Text style={styles.subtitle}>Enter your size</Text>
          }
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, step === 'account' && styles.stepActive]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step === 'size' && styles.stepActive]} />
        </View>

        {step === 'account' && (
          <>
            <View style={styles.socialGroup}>
              {SOCIAL_PROVIDERS.map(({ provider, label, icon, bg, color }) => (
                <TouchableOpacity
                  key={provider}
                  style={[styles.socialBtn, { backgroundColor: bg }]}
                  onPress={() => handleOAuth(provider)}
                  disabled={oauthLoading !== null}
                  activeOpacity={0.85}
                >
                  {oauthLoading === provider
                    ? <ActivityIndicator size="small" color={color} />
                    : <>
                        <Ionicons name={icon} size={18} color={color} />
                        <Text style={[styles.socialBtnText, { color }]}>{label}</Text>
                      </>
                  }
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign up with email</Text>
              <View style={styles.dividerLine} />
            </View>
          </>
        )}

        {step === 'account' ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input} placeholder="Username"
              placeholderTextColor={COLORS.muted} value={username}
              onChangeText={setUsername} autoCapitalize="none"
            />
            <TextInput
              style={styles.input} placeholder="Email"
              placeholderTextColor={COLORS.muted} value={email}
              onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
            />
            <TextInput
              style={styles.input} placeholder="Password (min 8 chars)"
              placeholderTextColor={COLORS.muted} value={password}
              onChangeText={setPassword} secureTextEntry autoComplete="new-password"
            />

            <Text style={styles.label}>Age Range</Text>
            <View style={styles.chipRow}>
              {AGE_RANGES.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.chip, ageRange === a && styles.chipActive]}
                  onPress={() => setAgeRange(a)}
                >
                  <Text style={[styles.chipText, ageRange === a && styles.chipTextActive]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.checkRow} onPress={() => setAgreedTo18(!agreedTo18)}>
              <View style={[styles.checkbox, agreedTo18 && styles.checkboxChecked]}>
                {agreedTo18 && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>I confirm I am 18 years of age or older</Text>
            </TouchableOpacity>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.btn} onPress={handleNextStep} activeOpacity={0.85}>
              <Text style={styles.btnText}>CONTINUE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.sizeDesc}>
              Self-reported and stays private by default.{'\n'}Only your size tier is shown publicly.
            </Text>

            {/* Unit toggle */}
            <View style={styles.unitRow}>
              {(['in', 'cm'] as const).map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                  onPress={() => {
                    if (u === unit) return;
                    const val = parseFloat(sizeInput);
                    if (!isNaN(val)) {
                      setSizeInput(u === 'cm' ? (val * 2.54).toFixed(1) : (val / 2.54).toFixed(1));
                    }
                    setUnit(u);
                  }}
                >
                  <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>
                    {u === 'in' ? 'Inches' : 'Centimeters'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sizeInputRow}>
              <TextInput
                style={[styles.input, styles.sizeInput]}
                placeholder={unit === 'in' ? 'e.g. 6.5' : 'e.g. 16.5'}
                placeholderTextColor={COLORS.muted}
                value={sizeInput}
                onChangeText={setSizeInput}
                keyboardType="decimal-pad"
              />
              <Text style={styles.sizeUnit}>{unit === 'in' ? '"' : 'cm'}</Text>
            </View>

            {tier && sizeInput ? (
              <View style={[styles.tierBadge, { borderColor: tier.color }]}>
                <Text style={styles.tierEmoji}>{tier.emoji}</Text>
                <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={COLORS.bg} />
                : <Text style={styles.btnText}>JOIN SIZE.</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => { setStep('account'); setError(''); }}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
      </AuthContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { padding: 28, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 48, fontWeight: '900', color: COLORS.gold, letterSpacing: 6 },
  subtitle: { color: COLORS.muted, fontSize: SIZES.md, marginTop: 8, letterSpacing: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32, gap: 8 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.mutedDark },
  stepActive: { backgroundColor: COLORS.gold },
  stepLine: { width: 40, height: 2, backgroundColor: COLORS.mutedDark },
  socialGroup: { gap: 10, marginBottom: 4 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: RADIUS.md, paddingVertical: 15, paddingHorizontal: 20 },
  socialBtnText: { fontSize: SIZES.md, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.cardBorder },
  dividerText: { color: COLORS.muted, fontSize: SIZES.sm },
  form: { gap: 14 },
  input: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md, paddingHorizontal: 18, paddingVertical: 16,
    color: COLORS.white, fontSize: SIZES.base,
  },
  label: { color: COLORS.muted, fontSize: SIZES.sm, letterSpacing: 1, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.card,
  },
  chipActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}20` },
  chipText: { color: COLORS.muted, fontSize: SIZES.sm },
  chipTextActive: { color: COLORS.gold, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { borderColor: COLORS.gold, backgroundColor: COLORS.gold },
  checkmark: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.sm },
  checkLabel: { color: COLORS.muted, fontSize: SIZES.md, flex: 1, lineHeight: 20 },
  error: { color: COLORS.red, fontSize: SIZES.sm, textAlign: 'center' },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: RADIUS.md,
    paddingVertical: 18, alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.base, letterSpacing: 2 },
  sizeDesc: { color: COLORS.muted, fontSize: SIZES.sm, lineHeight: 20, textAlign: 'center' },
  unitRow: { flexDirection: 'row', gap: 10 },
  unitBtn: {
    flex: 1, paddingVertical: 12, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, alignItems: 'center',
  },
  unitBtnActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}20` },
  unitText: { color: COLORS.muted, fontSize: SIZES.md },
  unitTextActive: { color: COLORS.gold, fontWeight: '700' },
  sizeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sizeInput: { flex: 1 },
  sizeUnit: { color: COLORS.gold, fontSize: SIZES.xl, fontWeight: '700', width: 40 },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: RADIUS.md,
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: COLORS.card,
  },
  tierEmoji: { fontSize: 22 },
  tierLabel: { fontSize: SIZES.base, fontWeight: '700', letterSpacing: 1 },
  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backText: { color: COLORS.muted, fontSize: SIZES.md },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: COLORS.muted, fontSize: SIZES.md },
  footerLink: { color: COLORS.gold, fontSize: SIZES.md, fontWeight: '700' },
});
