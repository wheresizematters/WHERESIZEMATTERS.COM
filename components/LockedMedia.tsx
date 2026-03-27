import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import PaywallModal from './PaywallModal';
import { proxyMediaUrl } from '@/lib/media';

const { width } = Dimensions.get('window');
const MEDIA_HEIGHT = width * 0.75;

interface Props {
  uri: string;
  type: 'image' | 'video';
  isPremium: boolean;
  isOwner?: boolean;
}

export default function LockedMedia({ uri, type, isPremium, isOwner = false }: Props) {
  const [showPaywall, setShowPaywall] = useState(false);
  const canView = isPremium || isOwner;
  const mediaUri = proxyMediaUrl(uri) ?? uri;

  return (
    <>
      <View style={styles.container}>
        {canView && type === 'video' ? (
          <Video
            source={{ uri: mediaUri }}
            style={styles.media}
            resizeMode={ResizeMode.COVER}
            useNativeControls
            isLooping={false}
          />
        ) : (
          <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="cover" />
        )}

        {!canView && (
          <TouchableOpacity
            style={styles.blurOverlay as any}
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
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // CSS backdrop-filter works on web, fallback bg on native
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', backgroundColor: 'rgba(0,0,0,0.4)' }
      : { backgroundColor: 'rgba(0,0,0,0.7)' }
    ),
  } as any,
  lockCard: { alignItems: 'center', gap: 8, padding: 24 },
  lockTitle: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '800' },
  lockSub: { color: COLORS.muted, fontSize: SIZES.sm, textAlign: 'center' },
  unlockBtn: {
    marginTop: 8, backgroundColor: COLORS.gold,
    borderRadius: RADIUS.full, paddingHorizontal: 20, paddingVertical: 10,
  },
  unlockText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.sm },
});
