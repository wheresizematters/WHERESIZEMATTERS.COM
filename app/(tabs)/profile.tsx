import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import PageContainer from '@/components/PageContainer';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { WORLD_AVERAGE } from '@/lib/mockData';
import { fetchUserRank, fetchUserPostCount, fetchTotalUserCount } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, session, signOut, demoMode } = useAuth();
  const [rank, setRank] = useState<number | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showSize, setShowSize] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const size = profile?.size_inches ?? 0;
  const tier = getSizeTier(size);

  useEffect(() => {
    if (!session?.user.id) return;
    fetchUserRank(session.user.id).then(setRank);
    fetchUserPostCount(session.user.id).then(setPostCount);
    fetchTotalUserCount().then(setTotalUsers);
  }, [session?.user.id]);

  const percentile = rank && totalUsers ? Math.round((1 - rank / totalUsers) * 100) : null;

  async function handleSignOut() {
    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to sign out?')) return;
      setSigningOut(true);
      await signOut();
      return;
    }
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
        },
      },
    ]);
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>PROFILE</Text>
          <TouchableOpacity onPress={() => router.push('/settings' as any)}>
            <Ionicons name="settings-outline" size={22} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        {demoMode && (
          <View style={styles.demoBanner}>
            <Ionicons name="warning-outline" size={14} color={COLORS.gold} />
            <Text style={styles.demoText}>Demo mode — connect Supabase to go live</Text>
          </View>
        )}

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { borderColor: tier.color }]}>
            <Text style={styles.avatarText}>{profile.username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.is_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            )}
          </View>
        </View>

        {/* Size card */}
        <View style={[styles.sizeCard, { borderColor: tier.color }]}>
          <View style={styles.sizeCardTop}>
            <Text style={styles.sizeCardLabel}>YOUR SIZE</Text>
            <TouchableOpacity onPress={() => setShowSize(!showSize)}>
              <Ionicons name={showSize ? 'eye-outline' : 'eye-off-outline'} size={18} color={COLORS.muted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.sizeDisplay, { color: showSize ? tier.color : COLORS.mutedDark }]}>
            {showSize ? `${size.toFixed(1)}"` : '••••'}
          </Text>
          <View style={[styles.tierBadge, { borderColor: tier.color }]}>
            <Text style={styles.tierEmoji}>{tier.emoji}</Text>
            <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
          </View>
          {!profile.is_verified && (
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={() => Alert.alert('Verification', 'Size verification coming soon.')}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.gold} />
              <Text style={styles.verifyText}>Get Verified</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{rank ? `#${rank.toLocaleString()}` : '—'}</Text>
            <Text style={styles.statLbl}>Global Rank</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statVal}>{percentile !== null ? `${percentile}th` : '—'}</Text>
            <Text style={styles.statLbl}>Percentile</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>
              {size >= WORLD_AVERAGE ? `+${(size - WORLD_AVERAGE).toFixed(1)}"` : `-${(WORLD_AVERAGE - size).toFixed(1)}"`}
            </Text>
            <Text style={styles.statLbl}>vs Avg</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statVal}>{postCount}</Text>
            <Text style={styles.statLbl}>Posts</Text>
          </View>
        </View>

        {/* Info */}
        {(profile.country || profile.age_range) && (
          <View style={styles.infoSection}>
            {profile.country && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.muted} />
                <Text style={styles.infoLabel}>Country</Text>
                <Text style={styles.infoValue}>{profile.country}</Text>
              </View>
            )}
            {profile.age_range && (
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.muted} />
                <Text style={styles.infoLabel}>Age Range</Text>
                <Text style={styles.infoValue}>{profile.age_range}</Text>
              </View>
            )}
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} disabled={signingOut}>
          {signingOut
            ? <ActivityIndicator size="small" color={COLORS.red} />
            : <>
                <Ionicons name="log-out-outline" size={18} color={COLORS.red} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>
      </PageContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { paddingBottom: 100 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: SIZES.xl, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  demoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12, backgroundColor: `${COLORS.gold}15`, borderRadius: RADIUS.md, borderWidth: 1, borderColor: `${COLORS.gold}40`, paddingHorizontal: 14, paddingVertical: 10 },
  demoText: { color: COLORS.gold, fontSize: SIZES.sm, flex: 1 },
  avatarSection: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.card, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.white, fontSize: SIZES.xxxl, fontWeight: '900' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { color: COLORS.white, fontSize: SIZES.xl, fontWeight: '800' },
  verifiedBadge: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  verifiedText: { color: COLORS.bg, fontSize: 11, fontWeight: '900' },
  sizeCard: { marginHorizontal: 16, padding: 24, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, alignItems: 'center', gap: 12, marginBottom: 16 },
  sizeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  sizeCardLabel: { color: COLORS.muted, fontSize: SIZES.xs, letterSpacing: 3, textTransform: 'uppercase' },
  sizeDisplay: { fontSize: 64, fontWeight: '900', lineHeight: 72 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6 },
  tierEmoji: { fontSize: 16 },
  tierText: { fontSize: SIZES.sm, fontWeight: '700', letterSpacing: 1 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  verifyText: { color: COLORS.gold, fontSize: SIZES.sm, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 16, overflow: 'hidden' },
  statCell: { width: '50%', padding: 16, alignItems: 'center' },
  statCellBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.cardBorder },
  statVal: { color: COLORS.gold, fontSize: SIZES.xl, fontWeight: '900' },
  statLbl: { color: COLORS.muted, fontSize: SIZES.xs, marginTop: 2, letterSpacing: 0.5 },
  infoSection: { marginHorizontal: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden', marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  infoLabel: { color: COLORS.muted, fontSize: SIZES.md, flex: 1 },
  infoValue: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '600' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 16, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: `${COLORS.red}40` },
  signOutText: { color: COLORS.red, fontWeight: '700', fontSize: SIZES.md },
});
