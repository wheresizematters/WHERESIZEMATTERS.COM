import { View, Text, StyleSheet } from 'react-native';
import { TIER_NAMES, TIER_COLORS, TIER_BOOST } from '@/lib/staking';
import { SIZES, RADIUS } from '@/constants/theme';

interface Props {
  tier: number;         // 0-4
  compact?: boolean;    // small inline badge vs full badge
}

export default function StakingTierBadge({ tier, compact }: Props) {
  if (tier === 0) return null;

  const name = TIER_NAMES[tier] ?? 'None';
  const color = TIER_COLORS[tier] ?? '#666';
  const boost = TIER_BOOST[tier] ?? 0;

  if (compact) {
    return (
      <View style={[styles.compact, { borderColor: `${color}60`, backgroundColor: `${color}15` }]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.compactText, { color }]}>{name}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { borderColor: `${color}50`, backgroundColor: `${color}12` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.name, { color }]}>{name}</Text>
      <Text style={[styles.boost, { color }]}>{boost}x</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  name: { fontSize: SIZES.xs, fontWeight: '800' },
  boost: { fontSize: SIZES.xs, fontWeight: '600', opacity: 0.7 },
  compactText: { fontSize: 10, fontWeight: '700' },
});
