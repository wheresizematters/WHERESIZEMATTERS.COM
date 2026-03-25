import { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePurchase } from '@/context/PurchaseContext';
import { getToken, getApiUrl } from '@/lib/supabase';
import PaywallModal from '@/components/PaywallModal';

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
  'Brazil', 'Mexico', 'Spain', 'Italy', 'Netherlands', 'Sweden', 'Norway',
  'Denmark', 'Japan', 'South Korea', 'India', 'South Africa', 'Other',
];

const AGE_RANGES = ['18–24', '25–34', '35–44', '45+'];

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, session, refreshProfile, updateProfile } = useAuth();
  const { isPremium } = usePurchase();

  const [bio, setBio] = useState(profile?.bio ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [country, setCountry] = useState(profile?.country ?? '');
  const [ageRange, setAgeRange] = useState(profile?.age_range ?? '');
  const [saving, setSaving] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  async function handleSave() {
    if (!session?.user.id) return;
    setSaving(true);
    await updateProfile({
      bio: bio.trim() || undefined,
      website: website.trim() || undefined,
      country: country || undefined,
      age_range: ageRange || undefined,
    } as any);
    setSaving(false);

    refreshProfile?.();
    if (typeof window !== "undefined" && window.history.length > 1) { router.back(); } else { router.push("/(tabs)" as any); }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); } else { router.push('/(tabs)' as any); } }} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving
            ? <ActivityIndicator size="small" color={COLORS.bg} />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>

        {/* Bio */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>BIO</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell the world about yourself..."
            placeholderTextColor={COLORS.muted}
            multiline
            maxLength={160}
            numberOfLines={4}
          />
          <Text style={styles.charCount}>{bio.length}/160</Text>
        </View>

        {/* Website */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>WEBSITE</Text>
          {!isPremium ? (
            <TouchableOpacity style={styles.lockedRow} onPress={() => setShowPaywall(true)} activeOpacity={0.8}>
              <Ionicons name="lock-closed" size={16} color={COLORS.gold} />
              <Text style={styles.lockedRowText}>Website Link</Text>
              <View style={styles.premiumChip}>
                <Text style={styles.premiumChipText}>Premium</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.inputRow}>
              <Ionicons name="link-outline" size={16} color={COLORS.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.inputFlex}
                value={website}
                onChangeText={setWebsite}
                placeholder="yoursite.com"
                placeholderTextColor={COLORS.muted}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          )}
        </View>

        {/* Country */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>COUNTRY</Text>
          <TouchableOpacity style={styles.inputRow} onPress={() => setShowCountryPicker(!showCountryPicker)}>
            <Ionicons name="location-outline" size={16} color={COLORS.muted} style={styles.inputIcon} />
            <Text style={[styles.inputFlex, { color: country ? COLORS.white : COLORS.muted, paddingVertical: 14 }]}>
              {country || 'Select country...'}
            </Text>
            <Ionicons name={showCountryPicker ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.muted} style={{ marginRight: 12 }} />
          </TouchableOpacity>
          {showCountryPicker && (
            <View style={styles.picker}>
              <TouchableOpacity style={styles.pickerItem} onPress={() => { setCountry(''); setShowCountryPicker(false); }}>
                <Text style={[styles.pickerItemText, { color: COLORS.muted }]}>None</Text>
              </TouchableOpacity>
              {COUNTRIES.map(c => (
                <TouchableOpacity key={c} style={[styles.pickerItem, country === c && styles.pickerItemActive]} onPress={() => { setCountry(c); setShowCountryPicker(false); }}>
                  <Text style={[styles.pickerItemText, country === c && { color: COLORS.gold }]}>{c}</Text>
                  {country === c && <Ionicons name="checkmark" size={16} color={COLORS.gold} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Age range */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>AGE RANGE</Text>
          <View style={styles.chipRow}>
            {AGE_RANGES.map(a => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, ageRange === a && styles.chipActive]}
                onPress={() => setAgeRange(ageRange === a ? '' : a)}
              >
                <Text style={[styles.chipText, ageRange === a && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.note}>
          Your profile picture and cover photo can be changed directly from your profile page.
        </Text>

      </ScrollView>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        trigger="Add a website link to your profile"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  backBtn: { width: 36, alignItems: 'flex-start' },
  title: { color: COLORS.white, fontSize: SIZES.lg, fontWeight: '900' },
  saveBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.full, paddingHorizontal: 18, paddingVertical: 8, minWidth: 60, alignItems: 'center' },
  saveBtnText: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.sm },
  inner: { padding: 20, gap: 24, paddingBottom: 60 },
  fieldGroup: { gap: 8 },
  fieldLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  input: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, color: COLORS.white, fontSize: SIZES.md, paddingHorizontal: 14, paddingVertical: 12 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  charCount: { color: COLORS.muted, fontSize: SIZES.xs, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder },
  inputIcon: { marginLeft: 12 },
  inputFlex: { flex: 1, color: COLORS.white, fontSize: SIZES.md, paddingVertical: 14, paddingHorizontal: 10 },
  picker: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden', maxHeight: 260 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  pickerItemActive: { backgroundColor: `${COLORS.gold}12` },
  pickerItemText: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  chipActive: { borderColor: COLORS.gold, backgroundColor: `${COLORS.gold}18` },
  chipText: { color: COLORS.muted, fontSize: SIZES.sm, fontWeight: '700' },
  chipTextActive: { color: COLORS.gold },
  note: { color: COLORS.muted, fontSize: SIZES.xs, textAlign: 'center', lineHeight: 18 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}40`, paddingHorizontal: 14, paddingVertical: 14 },
  lockedRowText: { flex: 1, color: COLORS.muted, fontSize: SIZES.md, fontWeight: '600' },
  premiumChip: { backgroundColor: `${COLORS.gold}20`, borderWidth: 1, borderColor: `${COLORS.gold}60`, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3 },
  premiumChipText: { color: COLORS.gold, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
