import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import AuthContainer from '@/components/AuthContainer';

export default function SetupSizeScreen() {
  const { updateProfile } = useAuth();
  const [sizeInput, setSizeInput] = useState('');
  const [unit, setUnit] = useState<'in' | 'cm'>('in');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function getSizeInches() {
    const val = parseFloat(sizeInput);
    if (isNaN(val)) return 0;
    return unit === 'cm' ? val / 2.54 : val;
  }

  const tier = sizeInput ? getSizeTier(getSizeInches()) : null;

  async function handleSubmit() {
    const inches = getSizeInches();
    if (!sizeInput || inches <= 0 || inches > 16) {
      setError('Enter a valid size'); return;
    }
    setLoading(true);
    setError('');
    try {
      await updateProfile({ size_inches: inches, has_set_size: true });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AuthContainer>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.logo}>SIZE.</Text>
          <Text style={styles.title}>One last thing</Text>
          <Text style={styles.subtitle}>
            Enter your size to complete your profile.{'\n'}
            Self-reported and stays private by default.
          </Text>
        </View>

        <View style={styles.form}>
          {/* Unit toggle */}
          <View style={styles.unitRow}>
            {(['in', 'cm'] as const).map(u => (
              <TouchableOpacity
                key={u}
                style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                onPress={() => {
                  if (u === unit) return;
                  const val = parseFloat(sizeInput);
                  if (!isNaN(val)) {
                    setSizeInput(u === 'cm' ? (val * 2.54).toFixed(1) : (val / 2.54).toFixed(1));
                  }
                  setUnit(u);
                }}
              >
                <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>
                  {u === 'in' ? 'Inches' : 'Centimeters'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sizeRow}>
            <TextInput
              style={[styles.input, styles.sizeInput]}
              placeholder={unit === 'in' ? 'e.g. 6.5' : 'e.g. 16.5'}
              placeholderTextColor={COLORS.muted}
              value={sizeInput}
              onChangeText={setSizeInput}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.sizeUnit}>{unit === 'in' ? '"' : 'cm'}</Text>
          </View>

          {tier && sizeInput ? (
            <View style={[styles.tierBadge, { borderColor: tier.color }]}>
              <Text style={styles.tierEmoji}>{tier.emoji}</Text>
              <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.bg} />
              : <Text style={styles.btnText}>JOIN SIZE.</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
      </AuthContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  header: { alignItems: 'center', marginBottom: 40, gap: 10 },
  logo: { fontSize: 48, fontWeight: '900', color: COLORS.gold, letterSpacing: 6 },
  title: { fontSize: SIZES.xxl, fontWeight: '800', color: COLORS.white },
  subtitle: { color: COLORS.muted, fontSize: SIZES.md, textAlign: 'center', lineHeight: 22 },
  form: { gap: 14 },
  unitRow: { flexDirection: 'row', gap: 10 },
  unitBtn: {
    flex: 1, paddingVertical: 12, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card, alignItems: 'center',
  },
  unitBtnActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}20` },
  unitText: { color: COLORS.muted, fontSize: SIZES.md },
  unitTextActive: { color: COLORS.gold, fontWeight: '700' },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.md, paddingHorizontal: 18, paddingVertical: 16,
    color: COLORS.white, fontSize: SIZES.base,
  },
  sizeInput: { flex: 1 },
  sizeUnit: { color: COLORS.gold, fontSize: SIZES.xl, fontWeight: '700', width: 40 },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: COLORS.card,
  },
  tierEmoji: { fontSize: 22 },
  tierLabel: { fontSize: SIZES.base, fontWeight: '700', letterSpacing: 1 },
  error: { color: COLORS.red, fontSize: SIZES.sm, textAlign: 'center' },
  btn: {
    backgroundColor: COLORS.gold, borderRadius: RADIUS.md,
    paddingVertical: 18, alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.bg, fontWeight: '800', fontSize: SIZES.base, letterSpacing: 2 },
});
