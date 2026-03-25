import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '@/constants/theme';
import { getSizeTier } from '@/constants/theme';

interface Props {
  username: string;
  avatarUrl?: string | null;
  sizeInches?: number;
  size?: number;          // pixel diameter, default 40
  isVerified?: boolean;
  showVerified?: boolean; // show checkmark overlay
}

export default function UserAvatar({
  username,
  avatarUrl,
  sizeInches = 6,
  size = 40,
  isVerified,
  showVerified,
}: Props) {
  const tier = getSizeTier(sizeInches);
  const borderRadius = size / 2;
  const borderWidth = size >= 60 ? 3 : 2;
  const fontSize = size >= 60 ? size * 0.35 : size * 0.4;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[
            styles.image,
            { width: size, height: size, borderRadius, borderWidth, borderColor: tier.color },
          ]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            { width: size, height: size, borderRadius, borderWidth, borderColor: tier.color },
          ]}
        >
          <Text style={[styles.letter, { fontSize, color: tier.color }]}>
            {(username ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      {showVerified && isVerified && (
        <View style={[styles.verifiedBadge, { right: -1, bottom: -1, width: size * 0.32, height: size * 0.32, borderRadius: size * 0.16 }]}>
          <Text style={[styles.verifiedCheck, { fontSize: size * 0.18 }]}>{'✓'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  image: { backgroundColor: COLORS.card },
  fallback: {
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: { fontWeight: '900' },
  verifiedBadge: {
    position: 'absolute',
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.bg,
  },
  verifiedCheck: { color: '#fff', fontWeight: '900' },
});
