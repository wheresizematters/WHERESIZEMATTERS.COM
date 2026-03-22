import { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';

interface OGData {
  title?: string;
  description?: string;
  image?: string;
  publisher?: string;
}

function isSafeUrl(u: string): boolean {
  return u.startsWith('https://') || u.startsWith('http://');
}

export default function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<OGData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch previews for http/https URLs
    if (!isSafeUrl(url)) { setLoading(false); return; }
    let cancelled = false;
    fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(res => {
        if (cancelled) return;
        if (res.status === 'success') {
          setData({
            title: res.data.title,
            description: res.data.description,
            image: res.data.image?.url,
            publisher: res.data.publisher,
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={COLORS.muted} />
      </View>
    );
  }

  if (!data?.title) return null;

  return (
    <TouchableOpacity style={styles.card} onPress={() => isSafeUrl(url) && Linking.openURL(url)} activeOpacity={0.85}>
      {data.image && (
        <Image source={{ uri: data.image }} style={styles.image} resizeMode="cover" />
      )}
      <View style={styles.body}>
        {data.publisher && (
          <Text style={styles.publisher} numberOfLines={1}>{data.publisher}</Text>
        )}
        <Text style={styles.title} numberOfLines={2}>{data.title}</Text>
        {data.description && (
          <Text style={styles.description} numberOfLines={2}>{data.description}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loading: { height: 44, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    marginTop: 4,
  },
  image: { width: '100%', height: 160 },
  body: { padding: 12, gap: 3 },
  publisher: { color: COLORS.gold, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '700', lineHeight: 20 },
  description: { color: COLORS.muted, fontSize: SIZES.sm, lineHeight: 18 },
});
