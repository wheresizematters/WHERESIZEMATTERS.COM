import { Platform } from 'react-native';
import { View, StyleSheet } from 'react-native';

/**
 * On web: centers content with a max-width of 680px.
 * On mobile: renders children as-is (full width).
 */
export default function PageContainer({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={styles.outer}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
  },
});
