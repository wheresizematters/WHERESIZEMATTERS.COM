import { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { usePurchase } from '@/context/PurchaseContext';

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
  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);

  async function handlePurchase() {
    setLoading(true);
    try {
      await purchaseWeb(selected);
    } catch (e: any) {
      window.alert(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color={COLORS.muted} />
          </TouchableOpacity>

          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.crown}>👑</Text>
            <Text style={styles.heroTitle}>SIZE. Premium</Text>
            <Text style={styles.heroSub}>
              {trigger ?? 'Unlock everything. Know exactly where you stand.'}
            </Text>
          </View>

          {/* Features */}
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

          {/* Plan selector */}
          <View style={styles.plans}>
            <TouchableOpacity
              style={[styles.plan, selected === 'annual' && styles.planSelected]}
              onPress={() => setSelected('annual')}
            >
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>BEST VALUE</Text>
              </View>
              <Text style={styles.planName}>Annual</Text>
              <Text style={styles.planPrice}>$29.99 / yr</Text>
              <Text style={styles.planSub}>$2.50 / month</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.plan, selected === 'monthly' && styles.planSelected]}
              onPress={() => setSelected('monthly')}
            >
              <Text style={styles.planName}>Monthly</Text>
              <Text style={styles.planPrice}>$4.99 / mo</Text>
              <Text style={styles.planSub}>Cancel anytime</Text>
            </TouchableOpacity>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
            onPress={handlePurchase}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.bg} />
              : <Text style={styles.ctaText}>
                  {selected === 'annual' ? 'Start for $29.99 / year' : 'Start for $4.99 / month'}
                </Text>
            }
          </TouchableOpacity>

          <Text style={styles.legal}>
            Secure payment via Stripe. Subscriptions auto-renew. Cancel anytime in your account settings.
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
  hero: { alignItems: 'center', marginBottom: 32, gap: 8 },
  crown: { fontSize: 52 },
  heroTitle: { fontSize: SIZES.xxxl, fontWeight: '900', color: COLORS.gold, letterSpacing: 2 },
  heroSub: { color: COLORS.muted, fontSize: SIZES.md, textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },
  featureList: { gap: 14, marginBottom: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: `${COLORS.gold}15`, borderWidth: 1, borderColor: `${COLORS.gold}30`,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { color: COLORS.white, fontSize: SIZES.md, flex: 1, fontWeight: '500' },
  plans: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  plan: {
    flex: 1, padding: 16, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.card, alignItems: 'center', gap: 4,
    position: 'relative', overflow: 'hidden',
  },
  planSelected: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}12` },
  planBadge: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: COLORS.gold, paddingVertical: 4, alignItems: 'center',
  },
  planBadgeText: { color: COLORS.bg, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  planName: { color: COLORS.white, fontWeight: '800', fontSize: SIZES.md, marginTop: 20 },
  planPrice: { color: COLORS.gold, fontWeight: '900', fontSize: SIZES.lg },
  planSub: { color: COLORS.muted, fontSize: SIZES.xs },
  ctaBtn: {
    backgroundColor: COLORS.gold, borderRadius: RADIUS.lg,
    paddingVertical: 18, alignItems: 'center', marginBottom: 12,
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaText: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.base, letterSpacing: 1 },
  legal: { color: COLORS.mutedDark, fontSize: SIZES.xs, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
});
