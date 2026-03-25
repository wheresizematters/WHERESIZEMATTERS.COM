import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { fetchPublicProfile, followUser } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Profile } from '@/lib/types';
import { SUPABASE_READY } from '@/lib/supabase';

const INVITE_STORAGE_KEY = 'size_invite_from';

export default function InviteScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [inviter, setInviter] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    fetchPublicProfile(userId)
      .then(p => setInviter(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  async function handleJoin() {
    if (!userId || !UUID_REGEX.test(userId)) return;
    // Store referral so AuthContext picks it up after signup
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(INVITE_STORAGE_KEY, userId);
    }
    router.replace('/(auth)/signup' as any);
  }

  async function handleAddFriend() {
    if (!session || !userId || session.user.id === userId) return;
    if (!UUID_REGEX.test(userId)) return;
    setAdding(true);
    try {
      await followUser(session.user.id, userId);
      setAdded(true);
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Could not connect. Please try again.');
      } else {
        typeof window !== 'undefined' ? window.alert('Could not connect. Please try again.') : null;
      }
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.gold} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!inviter) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Invite link not found.</Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.replace('/(auth)/login' as any)}>
            <Text style={styles.ctaBtnText}>Open SIZE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tier = getSizeTier(inviter.size_inches);
  const isOwnInvite = session?.user.id === userId;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* Logo */}
        <LinearGradient
          colors={['#FF6B2B', '#E8500A', '#C9A84C', '#BF5AF2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.logoGrad}
        >
          <Text style={styles.logoText}>SIZE.</Text>
        </LinearGradient>

        {/* Card */}
        <View style={styles.card}>
          {/* Inviter avatar */}
          <View style={[styles.avatar, { borderColor: tier.color }]}>
            <Text style={[styles.avatarLetter, { color: tier.color }]}>
              {inviter.username.charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.inviteHeadline}>
            <Text style={styles.username}>@{inviter.username}</Text>
            {'\n'}invited you to SIZE.
          </Text>

          <View style={[styles.tierRow, { borderColor: tier.color }]}>
            <Text style={styles.tierEmoji}>{tier.emoji}</Text>
            <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
            {inviter.is_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓ Verified</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.tagline}>
            The app where size actually matters.
          </Text>
          <Text style={styles.subCopy}>
            Rankings · Stats · Community
          </Text>
        </View>

        {/* Feature pills */}
        <View style={styles.features}>
          {[
            { icon: 'trophy-outline', label: 'Global Rankings' },
            { icon: 'analytics-outline', label: 'Size Percentile' },
            { icon: 'shield-checkmark-outline', label: 'Verification' },
          ].map(f => (
            <View key={f.label} style={styles.featurePill}>
              <Ionicons name={f.icon as any} size={14} color={COLORS.gold} />
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        {isOwnInvite ? (
          <View style={styles.ownInviteWrap}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.gold} />
            <Text style={styles.ownInviteText}>This is your invite link. Share it with friends.</Text>
          </View>
        ) : session ? (
          added ? (
            <View style={styles.addedWrap}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.gold} />
              <Text style={styles.addedText}>Connected with @{inviter.username}!</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.ctaBtn} onPress={handleAddFriend} disabled={adding}>
              {adding
                ? <ActivityIndicator size="small" color={COLORS.bg} />
                : (
                  <>
                    <Ionicons name="person-add-outline" size={18} color={COLORS.bg} />
                    <Text style={styles.ctaBtnText}>Add @{inviter.username} as a Friend</Text>
                  </>
                )
              }
            </TouchableOpacity>
          )
        ) : (
          <>
            <LinearGradient
              colors={['#FF6B2B', '#E8500A', '#C9A84C', '#BF5AF2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaBtnGrad}
            >
              <TouchableOpacity style={styles.ctaBtnInner} onPress={handleJoin}>
                <Text style={styles.ctaBtnTextGrad}>Join SIZE  →</Text>
              </TouchableOpacity>
            </LinearGradient>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login' as any)}>
              <Text style={styles.alreadyText}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.footer}>wheresizematters.com</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  notFoundText: { color: COLORS.muted, fontSize: SIZES.md },

  logoGrad: { borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 8 },
  logoText: { fontSize: 32, fontWeight: '900', color: COLORS.white, letterSpacing: 8 },

  card: {
    width: '100%', backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.cardBorder,
    padding: 28, alignItems: 'center', gap: 14,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 3,
    backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 30, fontWeight: '900' },
  inviteHeadline: {
    fontSize: SIZES.xl, fontWeight: '700', color: COLORS.offWhite,
    textAlign: 'center', lineHeight: 30,
  },
  username: { color: COLORS.white, fontWeight: '900' },
  tierRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6,
  },
  tierEmoji: { fontSize: 16 },
  tierLabel: { fontSize: SIZES.sm, fontWeight: '800', letterSpacing: 0.5 },
  verifiedBadge: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  verifiedText: { color: COLORS.bg, fontSize: 10, fontWeight: '900' },
  divider: { width: '100%', height: 1, backgroundColor: COLORS.cardBorder },
  tagline: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '800', textAlign: 'center' },
  subCopy: { color: COLORS.muted, fontSize: SIZES.sm, letterSpacing: 2, textTransform: 'uppercase' },

  features: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  featurePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${COLORS.gold}10`, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: `${COLORS.gold}30`,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  featureText: { color: COLORS.gold, fontSize: SIZES.xs, fontWeight: '700' },

  ctaBtnGrad: { width: '100%', borderRadius: RADIUS.lg, overflow: 'hidden' },
  ctaBtnInner: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  ctaBtnTextGrad: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '900', letterSpacing: 1 },

  ctaBtn: {
    width: '100%', backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gold,
    paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  ctaBtnText: { color: COLORS.gold, fontSize: SIZES.md, fontWeight: '800' },

  alreadyText: { color: COLORS.muted, fontSize: SIZES.sm, textDecorationLine: 'underline' },

  addedWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addedText: { color: COLORS.gold, fontSize: SIZES.md, fontWeight: '700' },

  ownInviteWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${COLORS.gold}10`, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: `${COLORS.gold}30` },
  ownInviteText: { color: COLORS.gold, fontSize: SIZES.sm, fontWeight: '600', flex: 1 },

  footer: { color: COLORS.mutedDark, fontSize: SIZES.xs, letterSpacing: 1 },
});
