import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import PageContainer from '@/components/PageContainer';
import {
  getDickCoinInfo, updateCircleJerkConfig,
  CircleJerkConfig, CircleJerkRole, DEFAULT_CONFIG, DickCoin,
} from '@/lib/dickcoin';

export default function CircleJerkSettingsScreen() {
  const { coinAddress } = useLocalSearchParams<{ coinAddress: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [coin, setCoin] = useState<DickCoin | null>(null);
  const [config, setConfig] = useState<CircleJerkConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!coinAddress) return;
    getDickCoinInfo(coinAddress).then(data => {
      if (data) {
        setCoin(data);
        setConfig(data.circleJerkConfig ?? DEFAULT_CONFIG);
      }
      setLoading(false);
    });
  }, [coinAddress]);

  const isCreator = coin?.userId === session?.user.id;

  function updateRole(tier: number, field: keyof CircleJerkRole, value: any) {
    setConfig(prev => ({
      ...prev,
      roles: prev.roles.map(r =>
        r.tier === tier ? { ...r, [field]: value } : r
      ),
    }));
    setSaved(false);
  }

  async function handleSave() {
    if (!coinAddress) return;
    setSaving(true);
    const result = await updateCircleJerkConfig(coinAddress, config);
    setSaving(false);
    if (!result.error) setSaved(true);
    else if (typeof window !== 'undefined') window.alert(result.error);
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
      </SafeAreaView>
    );
  }

  if (!isCreator) {
    return (
      <SafeAreaView style={s.container}>
        <PageContainer>
          <View style={s.header}>
            <TouchableOpacity onPress={() => { if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); } else { router.push('/(tabs)' as any); } }} style={s.backBtn}>
              <Ionicons name="arrow-back" size={22} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={s.headerText}>Settings</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={s.center}>
            <Ionicons name="lock-closed" size={40} color={COLORS.muted} />
            <Text style={s.noAccess}>Only the creator can edit Circle Jerk settings</Text>
          </View>
        </PageContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <PageContainer>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); } else { router.push('/(tabs)' as any); } }} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={s.headerText}>Circle Jerk Settings</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <Text style={s.coinName}>{coin?.name} — {coin?.ticker}</Text>

          {/* Channel names */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>CHANNEL NAMES</Text>
            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Main channel</Text>
              <TextInput
                style={s.fieldInput}
                value={config.generalChannelName}
                onChangeText={v => { setConfig(p => ({ ...p, generalChannelName: v })); setSaved(false); }}
                maxLength={30}
                placeholderTextColor={COLORS.mutedDark}
              />
            </View>
            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>VIP channel</Text>
              <TextInput
                style={s.fieldInput}
                value={config.bukakeChannelName}
                onChangeText={v => { setConfig(p => ({ ...p, bukakeChannelName: v })); setSaved(false); }}
                maxLength={30}
                placeholderTextColor={COLORS.mutedDark}
              />
            </View>
          </View>

          {/* Role configuration */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>ROLES</Text>
            <Text style={s.sectionDesc}>
              Set custom names and token requirements for each role. Holders are assigned the highest role they qualify for.
            </Text>

            {config.roles.sort((a, b) => b.tier - a.tier).map(role => (
              <View key={role.tier} style={[s.roleCard, { borderLeftColor: role.color }]}>
                <View style={s.roleHeader}>
                  <View style={[s.tierCircle, { backgroundColor: role.color }]}>
                    <Text style={s.tierNum}>{role.tier}</Text>
                  </View>
                  <TextInput
                    style={s.roleNameInput}
                    value={role.name}
                    onChangeText={v => updateRole(role.tier, 'name', v)}
                    maxLength={20}
                    placeholder="Role name"
                    placeholderTextColor={COLORS.mutedDark}
                  />
                </View>

                <View style={s.roleFields}>
                  <View style={s.roleField}>
                    <Text style={s.roleFieldLabel}>Min tokens to qualify</Text>
                    <TextInput
                      style={s.roleFieldInput}
                      value={role.minTokens}
                      onChangeText={v => updateRole(role.tier, 'minTokens', v.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.mutedDark}
                    />
                  </View>

                  <View style={s.rolePerms}>
                    <TouchableOpacity
                      style={[s.permToggle, role.canWriteGeneral && s.permToggleOn]}
                      onPress={() => updateRole(role.tier, 'canWriteGeneral', !role.canWriteGeneral)}
                    >
                      <Ionicons name={role.canWriteGeneral ? 'checkmark-circle' : 'close-circle'} size={14} color={role.canWriteGeneral ? COLORS.green : COLORS.muted} />
                      <Text style={[s.permText, role.canWriteGeneral && s.permTextOn]}>Can write main</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.permToggle, role.canWriteBukake && s.permToggleOn]}
                      onPress={() => updateRole(role.tier, 'canWriteBukake', !role.canWriteBukake)}
                    >
                      <Ionicons name={role.canWriteBukake ? 'checkmark-circle' : 'close-circle'} size={14} color={role.canWriteBukake ? COLORS.green : COLORS.muted} />
                      <Text style={[s.permText, role.canWriteBukake && s.permTextOn]}>Can write VIP</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Color picker (simplified — preset colors) */}
                  <View style={s.colorRow}>
                    <Text style={s.roleFieldLabel}>Color</Text>
                    <View style={s.colorOptions}>
                      {['#6b7280', '#3b82f6', '#8b5cf6', '#ea580c', '#d97706', '#10b981', '#dc2626', '#0891b2'].map(c => (
                        <TouchableOpacity
                          key={c}
                          style={[s.colorDot, { backgroundColor: c }, role.color === c && s.colorDotSelected]}
                          onPress={() => updateRole(role.tier, 'color', c)}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.bg} />
            ) : saved ? (
              <><Ionicons name="checkmark" size={18} color={COLORS.bg} /><Text style={s.saveBtnText}>Saved</Text></>
            ) : (
              <Text style={s.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </PageContainer>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  headerText: { fontSize: SIZES.base, fontWeight: '900', color: COLORS.white },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },
  coinName: { color: COLORS.gold, fontSize: SIZES.lg, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  noAccess: { color: COLORS.muted, fontSize: SIZES.md },

  // Sections
  section: { marginBottom: 24 },
  sectionLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2.5, marginBottom: 8 },
  sectionDesc: { color: COLORS.muted, fontSize: SIZES.xs, lineHeight: 18, marginBottom: 12 },

  // Fields
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fieldLabel: { color: COLORS.offWhite, fontSize: SIZES.sm, fontWeight: '600' },
  fieldInput: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, color: COLORS.white, fontSize: SIZES.sm, width: 180, textAlign: 'right' },

  // Role cards
  roleCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, borderLeftWidth: 3, padding: 14, marginBottom: 10 },
  roleHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  tierCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tierNum: { color: '#fff', fontWeight: '900', fontSize: 12 },
  roleNameInput: { flex: 1, color: COLORS.white, fontSize: SIZES.lg, fontWeight: '800', borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder, paddingBottom: 4 },

  // Role fields
  roleFields: { gap: 10 },
  roleField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roleFieldLabel: { color: COLORS.muted, fontSize: SIZES.xs },
  roleFieldInput: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6, color: COLORS.white, fontSize: SIZES.sm, width: 120, textAlign: 'right', fontFamily: 'monospace' },

  // Permissions
  rolePerms: { flexDirection: 'row', gap: 8 },
  permToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.cardBorder },
  permToggleOn: { borderColor: `${COLORS.green}40`, backgroundColor: `${COLORS.green}10` },
  permText: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '600' },
  permTextOn: { color: COLORS.green },

  // Color picker
  colorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  colorOptions: { flexDirection: 'row', gap: 6 },
  colorDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  colorDotSelected: { borderColor: COLORS.white },

  // Save
  saveBtn: { backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: COLORS.bg, fontWeight: '900', fontSize: SIZES.base },
});
