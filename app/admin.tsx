import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, RefreshControl, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  fetchPendingVerifications,
  getVerificationSignedUrl,
  adminReviewVerification,
} from '@/lib/api';
import { VerificationRequest } from '@/lib/types';

interface RequestWithUrl extends VerificationRequest {
  signedUrl: string | null;
}

function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

export default function AdminScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [requests, setRequests] = useState<RequestWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const isAdmin = profile?.is_admin === true;

  const loadRequests = useCallback(async () => {
    const data = await fetchPendingVerifications();
    // Fetch signed URLs in parallel
    const withUrls = await Promise.all(
      data.map(async (req) => ({
        ...req,
        signedUrl: await getVerificationSignedUrl(req.image_path),
      }))
    );
    setRequests(withUrls);
  }, []);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    loadRequests().finally(() => setLoading(false));
  }, [isAdmin, loadRequests]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  }

  async function handleReview(req: RequestWithUrl, action: 'approve' | 'reject') {
    const label = action === 'approve' ? 'Approve' : 'Reject';
    const msg = action === 'approve'
      ? `Verify @${req.profile?.username}? Their profile will show a verified badge.`
      : `Reject @${req.profile?.username}'s verification request?`;

    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      doReview(req.id, action);
    } else {
      Alert.alert(label, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: label, style: action === 'reject' ? 'destructive' : 'default', onPress: () => doReview(req.id, action) },
      ]);
    }
  }

  async function doReview(requestId: string, action: 'approve' | 'reject') {
    setReviewingId(requestId);
    const { error } = await adminReviewVerification(requestId, action);
    setReviewingId(null);

    if (error) {
      Alert.alert('Error', error);
      return;
    }
    // Remove from list
    setRequests(prev => prev.filter(r => r.id !== requestId));
  }

  // ── Not admin ──────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>ADMIN</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.centered}>
          <Ionicons name="lock-closed-outline" size={48} color={COLORS.muted} />
          <Text style={s.emptyTitle}>Access Denied</Text>
          <Text style={s.emptySub}>This area is restricted to administrators.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>ADMIN</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.centered}>
          <ActivityIndicator color={COLORS.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Admin queue ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>VERIFY QUEUE</Text>
        <View style={s.countBadge}>
          <Text style={s.countText}>{requests.length}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.gold} />}
        contentContainerStyle={s.list}
      >
        {requests.length === 0 ? (
          <View style={s.centered}>
            <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.green} />
            <Text style={s.emptyTitle}>Queue Empty</Text>
            <Text style={s.emptySub}>All verification requests have been reviewed.</Text>
          </View>
        ) : (
          requests.map(req => (
            <View key={req.id} style={s.card}>
              {/* User info row */}
              <View style={s.cardHeader}>
                <View style={s.userInfo}>
                  <Text style={s.username}>@{req.profile?.username ?? 'unknown'}</Text>
                  <Text style={s.submittedAt}>{timeAgo(req.created_at)}</Text>
                </View>
                <View style={s.sizePill}>
                  <Text style={s.sizeText}>Reported: {req.reported_size}"</Text>
                </View>
              </View>

              {/* Photo */}
              {req.signedUrl ? (
                <Image
                  source={{ uri: req.signedUrl }}
                  style={s.photo}
                  resizeMode="cover"
                />
              ) : (
                <View style={[s.photo, s.photoPlaceholder]}>
                  <Ionicons name="image-outline" size={32} color={COLORS.muted} />
                  <Text style={s.photoPlaceholderText}>Photo unavailable</Text>
                </View>
              )}

              {/* AI analysis */}
              <View style={s.aiSection}>
                <Text style={s.aiLabel}>AI ANALYSIS</Text>
                <View style={s.aiRow}>
                  <View style={s.aiCell}>
                    <Text style={s.aiCellLabel}>Estimated</Text>
                    <Text style={s.aiCellValue}>
                      {req.ai_est_size !== null ? `${req.ai_est_size}"` : '—'}
                    </Text>
                  </View>
                  <View style={[s.aiCell, s.aiCellBorder]}>
                    <Text style={s.aiCellLabel}>Confidence</Text>
                    <Text style={[s.aiCellValue, {
                      color: req.ai_confidence === 'high' ? COLORS.green
                        : req.ai_confidence === 'medium' ? COLORS.gold
                        : COLORS.muted,
                    }]}>
                      {req.ai_confidence ?? '—'}
                    </Text>
                  </View>
                  <View style={[s.aiCell, s.aiCellBorder]}>
                    <Text style={s.aiCellLabel}>Difference</Text>
                    <Text style={[s.aiCellValue, {
                      color: req.ai_est_size !== null
                        ? Math.abs(req.ai_est_size - req.reported_size) <= 0.5 ? COLORS.green : COLORS.red
                        : COLORS.muted,
                    }]}>
                      {req.ai_est_size !== null
                        ? `${Math.abs(req.ai_est_size - req.reported_size).toFixed(2)}"`
                        : '—'}
                    </Text>
                  </View>
                </View>
                {req.ai_notes ? (
                  <Text style={s.aiNotes}>{req.ai_notes}</Text>
                ) : null}
              </View>

              {/* Actions */}
              <View style={s.actions}>
                <TouchableOpacity
                  style={[s.actionBtn, s.rejectBtn]}
                  onPress={() => handleReview(req, 'reject')}
                  disabled={reviewingId === req.id}
                >
                  {reviewingId === req.id ? (
                    <ActivityIndicator size="small" color={COLORS.red} />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={18} color={COLORS.red} />
                      <Text style={[s.actionBtnText, { color: COLORS.red }]}>Reject</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.actionBtn, s.approveBtn]}
                  onPress={() => handleReview(req, 'approve')}
                  disabled={reviewingId === req.id}
                >
                  {reviewingId === req.id ? (
                    <ActivityIndicator size="small" color={COLORS.bg} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.bg} />
                      <Text style={[s.actionBtnText, { color: COLORS.bg }]}>Approve</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: SIZES.md, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  countBadge: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { color: COLORS.bg, fontSize: SIZES.md, fontWeight: '900' },

  list: { padding: 16, gap: 16, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40, marginTop: 60 },
  emptyTitle: { fontSize: SIZES.xl, fontWeight: '800', color: COLORS.white },
  emptySub: { color: COLORS.muted, fontSize: SIZES.md, textAlign: 'center' },

  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  userInfo: { gap: 2 },
  username: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '800' },
  submittedAt: { color: COLORS.muted, fontSize: SIZES.xs },
  sizePill: {
    backgroundColor: `${COLORS.gold}20`, borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: `${COLORS.gold}40`,
  },
  sizeText: { color: COLORS.gold, fontSize: SIZES.sm, fontWeight: '700' },

  photo: { width: '100%', height: 280, backgroundColor: COLORS.bg },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoPlaceholderText: { color: COLORS.muted, fontSize: SIZES.sm },

  aiSection: {
    padding: 14, borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  aiLabel: {
    color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 2, marginBottom: 10,
  },
  aiRow: { flexDirection: 'row' },
  aiCell: { flex: 1, alignItems: 'center', gap: 4 },
  aiCellBorder: { borderLeftWidth: 1, borderLeftColor: COLORS.cardBorder },
  aiCellLabel: { color: COLORS.muted, fontSize: SIZES.xs },
  aiCellValue: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '800' },
  aiNotes: { color: COLORS.muted, fontSize: SIZES.sm, marginTop: 10, lineHeight: 18, fontStyle: 'italic' },

  actions: { flexDirection: 'row', padding: 12, gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: RADIUS.md,
  },
  rejectBtn: { backgroundColor: `${COLORS.red}20`, borderWidth: 1, borderColor: `${COLORS.red}40` },
  approveBtn: { backgroundColor: COLORS.gold },
  actionBtnText: { fontSize: SIZES.md, fontWeight: '800' },
});
