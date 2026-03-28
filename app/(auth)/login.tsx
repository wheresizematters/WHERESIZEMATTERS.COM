import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import AuthContainer from '@/components/AuthContainer';
import { setToken } from '@/lib/supabase';

type OAuthProvider = 'x';

const SOCIAL_PROVIDERS: { provider: OAuthProvider; label: string; icon: any; bg: string; color: string }[] = [
  { provider: 'x', label: 'Continue with X', icon: 'logo-twitter', bg: '#222', color: '#fff' },
];

// Detect mobile browser (not in-app wallet browser)
function isMobileWithoutWallet(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const hasWallet = !!(window as any)?.ethereum || !!(window as any)?.okxwallet || !!(window as any)?.phantom?.ethereum;
  return isMobile && !hasWallet;
}

// Wallet connect
async function connectWalletLogin(): Promise<{ address: string } | null> {
  // Support MetaMask, Coinbase Wallet, OKX, and other EIP-1193 wallets
  const eth = (window as any)?.ethereum ?? (window as any)?.okxwallet;
  if (!eth) {
    if (isMobileWithoutWallet()) {
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
    return null;
  }
  try {
    const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
    if (!accounts[0]) return null;
    return { address: accounts[0] };
  } catch (err: any) {
    if (err?.code === 4001) return null; // user rejected
    console.error('Wallet connect error:', err);
    window.alert('Failed to connect wallet. Try again.');
    return null;
  }
}

export default function LoginScreen() {
  const { signIn, signInWithOAuth } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [error, setError]       = useState('');

  async function handleLogin() {
    if (!email || !password) { setError('Fill in all fields'); return; }
    setLoading(true);
    setError('');
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error);
    setLoading(false);
  }

  async function handleOAuth(provider: OAuthProvider) {
    setOauthLoading(provider);
    setError('');
    const { error } = await signInWithOAuth(provider);
    if (error) setError(error);
    setOauthLoading(null);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AuthContainer>
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>SIZE.</Text>
          <Text style={styles.tagline}>Know where you stand.</Text>
        </View>

        {/* Wallet + Social login */}
        <View style={styles.socialGroup}>
          <TouchableOpacity
            style={[styles.socialBtn, { backgroundColor: '#E8500A' }]}
            onPress={async () => {
              setError('');
              const wallet = await connectWalletLogin();
              if (!wallet) return;
              setLoading(true);
              try {
                // console.log('[WALLET] Got address:', wallet.address);
                const res = await fetch('/api/v1/auth/wallet', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ walletAddress: wallet.address }),
                });
                // console.log('[WALLET] API status:', res.status);
                const data = await res.json();
                // console.log('[WALLET] Has token:', !!data.token);
                if (data.token) {
                  setToken(data.token);
                  // console.log('[WALLET] Token saved, redirecting...');
                  window.location.href = '/earn';
                  return; // don't setLoading(false) — we're navigating away
                } else {
                  setError(data.error ?? 'Wallet login failed');
                }
              } catch (e: any) {
                // console.error('[WALLET] Error:', e);
                setError('Connection failed: ' + (e?.message ?? ''));
              }
              setLoading(false);
            }}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Ionicons name="wallet" size={18} color="#fff" />
            <Text style={[styles.socialBtnText, { color: '#fff' }]}>Connect Wallet</Text>
          </TouchableOpacity>

          {SOCIAL_PROVIDERS.map(({ provider, label, icon, bg, color }) => (
            <TouchableOpacity
              key={provider}
              style={[styles.socialBtn, { backgroundColor: bg }]}
              onPress={() => handleOAuth(provider)}
              disabled={oauthLoading !== null || loading}
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

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign in with email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email / password form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.bg} />
              : <Text style={styles.btnText}>SIGN IN</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => { if (typeof window !== 'undefined') window.open('/privacy', '_blank'); }}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}> · </Text>
          <TouchableOpacity onPress={() => { if (typeof window !== 'undefined') window.open('/terms', '_blank'); }}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </View>
      </AuthContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 64, fontWeight: '900', color: COLORS.gold, letterSpacing: 6 },
  tagline: { fontSize: SIZES.md, color: COLORS.muted, letterSpacing: 2, marginTop: 6, textTransform: 'uppercase' },

  socialGroup: { gap: 10, marginBottom: 24 },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: RADIUS.md, paddingVertical: 15, paddingHorizontal: 20,
  },
  socialBtnText: { fontSize: SIZES.md, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.cardBorder },
  dividerText: { color: COLORS.muted, fontSize: SIZES.sm },

  form: { gap: 12 },
  input: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md, paddingHorizontal: 18, paddingVertical: 16,
    color: COLORS.white, fontSize: SIZES.base,
  },
  error: { color: COLORS.red, fontSize: SIZES.sm, textAlign: 'center', marginTop: 4 },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: RADIUS.md,
    paddingVertical: 18, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.base, letterSpacing: 2 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: COLORS.muted, fontSize: SIZES.md },
  footerLink: { color: COLORS.gold, fontSize: SIZES.md, fontWeight: '700' },
  legalRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  legalLink: { color: COLORS.muted, fontSize: SIZES.xs },
  legalDot: { color: COLORS.mutedDark, fontSize: SIZES.xs },
});
