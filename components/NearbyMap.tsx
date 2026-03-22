// Native stub — map is web-only for now
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES } from '@/constants/theme';
import { NearbyEntry } from '@/lib/api';
import { UserLocation } from '@/lib/location';

interface Props {
  center: UserLocation;
  entries: NearbyEntry[];
  mySize: number;
  radiusMiles: number;
  onPinPress?: (entry: NearbyEntry) => void;
}

export default function NearbyMap(_props: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>Map view available on web</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  text: { color: COLORS.muted, fontSize: SIZES.sm },
});
