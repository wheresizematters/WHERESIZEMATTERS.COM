import { Platform } from 'react-native';
import { View, StyleSheet } from 'react-native';

/**
 * On web: centers content with a max-width column, subtle side gutters.
 * On mobile: renders children as-is (full width).
 */
export default function PageContainer({ children, maxWidth = 720 }: { children: React.ReactNode; maxWidth?: number }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { maxWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#0A0A0A',
  },
  inner: {
    flex: 1,
    width: '100%',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#1a1a1a',
  },
});
