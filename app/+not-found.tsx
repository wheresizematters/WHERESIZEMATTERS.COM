import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>SIZE.</Text>
      <Text style={styles.code}>404</Text>
      <Text style={styles.message}>This page doesn't exist.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/')} activeOpacity={0.85}>
        <Text style={styles.btnText}>GO HOME</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 6,
    marginBottom: 8,
  },
  code: {
    fontSize: 80,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.08)',
    letterSpacing: 4,
    lineHeight: 88,
  },
  message: {
    color: COLORS.muted,
    fontSize: SIZES.md,
    letterSpacing: 1,
    marginBottom: 8,
  },
  btn: {
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  btnText: {
    color: COLORS.bg,
    fontWeight: '800',
    fontSize: SIZES.md,
    letterSpacing: 2,
  },
});
