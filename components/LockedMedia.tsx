import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import PaywallModal from './PaywallModal';

const { width } = Dimensions.get('window');
const MEDIA_HEIGHT = width * 0.75;

interface Props {
  uri: string;
  type: 'image' | 'video';
  isPremium: boolean;
}

export default function LockedMedia({ uri, type, isPremium }: Props) {
  const [showPaywall, setShowPaywall] = useState(false);

  return (
    <>
      <View style={styles.container}>
        <Image source={{ uri }} style={styles.media} resizeMode="cover" />

        {!isPremium && (
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill}>
            <TouchableOpacity
              style={styles.lockedOverlay}
              onPress={() => setShowPaywall(true)}
              activeOpacity={0.9}
            >
              <View style={styles.lockCard}>
                <Ionicons name="lock-closed" size={28} color={COLORS.gold} />
                <Text style={styles.lockTitle}>Premium Content</Text>
                <Text style={styles.lockSub}>
                  Subscribe to view {type === 'video' ? 'videos' : 'photos'}
                </Text>
                <View style={styles.unlockBtn}>
                  <Text style={styles.unlockText}>Unlock — $4.99/mo</Text>
                </View>
              </View>
            </TouchableOpacity>
          </BlurView>
        )}

        {isPremium && type === 'video' && (
          <View style={styles.playOverlay} pointerEvents="none">
            <View style={styles.playBtn}>
              <Ionicons name="play" size={28} color={COLORS.white} />
            </View>
          </View>
        )}
      </View>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        trigger="Subscribe to view photos and videos"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: MEDIA_HEIGHT, borderRadius: RADIUS.md, overflow: 'hidden', marginTop: 8 },
  media: { width: '100%', height: '100%' },
  lockedOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lockCard: { alignItems: 'center', gap: 8, padding: 24 },
  lockTitle: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '800' },
  lockSub: { color: COLORS.muted, fontSize: SIZES.sm, textAlign: 'center' },
  unlockBtn: {
    marginTop: 8, backgroundColor: COLORS.gold,
    borderRadius: RADIUS.full, paddingHorizontal: 20, paddingVertical: 10,
  },
  unlockText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.sm },
  playOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
});
