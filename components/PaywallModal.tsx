import { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { usePurchase } from '@/context/PurchaseContext';
import { useAuth } from '@/context/AuthContext';
import { getToken } from '@/lib/supabase';

const FEATURES = [
  { icon: 'shield-checkmark', text: 'Verified badge on your profile' },
  { icon: 'eye',              text: 'See exact sizes — not just tiers' },
  { icon: 'trophy',           text: 'Full leaderboard (top 100)' },
  { icon: 'images',           text: 'Post & view photos and videos' },
  { icon: 'star',             text: 'Priority in feed & search' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  trigger?: string;
}

export default function PaywallModal({ visible, onClose, trigger }: Props) {
  const { purchaseWeb } = usePurchase();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);

  async function handleStripePurchase(plan: 'monthly' | 'annual') {
    setLoading(true);
    try {
      await purchaseWeb(plan);
    } catch (e: any) {
      window.alert(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleTokenPurchase() {
    setTokenLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/v1/verifications/token-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) {
        window.alert(data.error);
      } else {
        window.alert('Premium activated! 50% burned, 50% to protocol.');
        onClose();
        window.location.reload();
      }
    } catch {
      window.alert('Failed — try again');
    } finally {
      setTokenLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color={COLORS.muted} />
          </TouchableOpacity>

          <View style={styles.hero}>
            <Ionicons name="ribbon" size={52} color={COLORS.gold} />
            <Text style={styles.heroTitle}>SIZE. Premium</Text>
            <Text style={styles.heroSub}>
              {trigger ?? 'Unlock everything. Know exactly where you stand.'}
            </Text>
          </View>

          <View style={styles.featureList}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon as any} size={18} color={COLORS.gold} />
                </View>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {/* Pay with Card */}
          <Text style={styles.sectionLabel}>PAY WITH CARD</Text>
          <View style={styles.plans}>
            <TouchableOpacity
              style={styles.plan}
              onPress={() => handleStripePurchase('annual')}
              disabled={loading}
            >
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>BEST VALUE</Text>
              </View>
              <Text style={styles.planName}>Annual</Text>
              <Text style={styles.planPrice}>$29.99 / yr</Text>
              <Text style={styles.planSub}>$2.50 / month</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.plan}
              onPress={() => handleStripePurchase('monthly')}
              disabled={loading}
            >
              <Text style={styles.planName}>Monthly</Text>
              <Text style={styles.planPrice}>$4.99 / mo</Text>
              <Text style={styles.planSub}>Cancel anytime</Text>
            </TouchableOpacity>
          </View>

          {/* Pay with $SIZE */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or pay with $SIZE</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.tokenBtn}
            onPress={handleTokenPurchase}
            disabled={tokenLoading}
          >
            {tokenLoading ? (
              <ActivityIndicator color={COLORS.bg} />
            ) : (
              <>
                <Text style={styles.tokenBtnText}>Pay $10 of $SIZE</Text>
                <Text style={styles.tokenBtnSub}>50% burned / 50% to protocol — 1 month premium</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.legal}>
            Card payments via Stripe. Token payments: 50% of $SIZE is burned forever, 50% sent to protocol as ETH. Both grant 30 days of Premium.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { paddingHorizontal: 24, paddingBottom: 48, paddingTop: 16 },
  closeBtn: { alignSelf: 'flex-end', padding: 8, marginBottom: 8 },
  hero: { alignItems: 'center', marginBottom: 28, gap: 8 },
  heroTitle: { fontSize: SIZES.xxxl, fontWeight: '900', color: COLORS.gold, letterSpacing: 2 },
  heroSub: { color: COLORS.muted, fontSize: SIZES.md, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },
  featureList: { gap: 14, marginBottom: 28 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: `${COLORS.gold}15`, borderWidth: 1, borderColor: `${COLORS.gold}30`, alignItems: 'center', justifyContent: 'center' },
  featureText: { color: COLORS.white, fontSize: SIZES.md, flex: 1, fontWeight: '500' },
  sectionLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  plans: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  plan: { flex: 1, padding: 16, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, alignItems: 'center', gap: 4, position: 'relative' as any, overflow: 'hidden' },
  planBadge: { position: 'absolute' as any, top: 0, left: 0, right: 0, backgroundColor: COLORS.gold, paddingVertical: 4, alignItems: 'center' },
  planBadgeText: { color: COLORS.bg, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  planName: { color: COLORS.white, fontWeight: '800', fontSize: SIZES.md, marginTop: 20 },
  planPrice: { color: COLORS.gold, fontWeight: '900', fontSize: SIZES.lg },
  planSub: { color: COLORS.muted, fontSize: SIZES.xs },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.cardBorder },
  dividerText: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '600' },
  tokenBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.lg, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', marginBottom: 12, gap: 4 },
  tokenBtnText: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.base },
  tokenBtnSub: { color: 'rgba(10,10,10,0.6)', fontSize: SIZES.xs },
  legal: { color: COLORS.mutedDark, fontSize: SIZES.xs, textAlign: 'center', lineHeight: 18 },
});
