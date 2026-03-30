import { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS, getSizeTier } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePurchase } from '@/context/PurchaseContext';
import PaywallModal from '@/components/PaywallModal';
import { deleteProfile } from '@/lib/api';
import { getToken } from '@/lib/supabase';

function SettingsRow({
  icon, label, value, onPress, danger, toggle, toggleValue, onToggle,
}: {
  icon: string; label: string; value?: string; onPress?: () => void;
  danger?: boolean; toggle?: boolean; toggleValue?: boolean; onToggle?: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon as any} size={18} color={danger ? COLORS.red : COLORS.gold} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {toggle
        ? <Switch value={toggleValue} onValueChange={onToggle} thumbColor={COLORS.gold} trackColor={{ true: `${COLORS.gold}50`, false: COLORS.mutedDark }} />
        : value
          ? <Text style={styles.rowValue}>{value}</Text>
          : onPress ? <Ionicons name="chevron-forward" size={16} color={COLORS.mutedDark} /> : null
      }
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, updateProfile, signOut } = useAuth();
  const { isPremium } = usePurchase();

  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(profile?.username ?? '');
  const [editingSize, setEditingSize] = useState(false);
  const [newSize, setNewSize] = useState(profile?.size_inches?.toString() ?? '');
  const [editingGirth, setEditingGirth] = useState(false);
  const [newGirth, setNewGirth] = useState(profile?.girth_inches?.toString() ?? '');
  const [notifications, setNotifications] = useState(profile?.notifications_enabled ?? true);
  const [editingXHandle, setEditingXHandle] = useState(false);
  const [newXHandle, setNewXHandle] = useState((profile as any)?.x_handle ?? '');
  const [saving, setSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  async function saveUsername() {
    if (!newUsername.trim() || newUsername === profile?.username) { setEditingUsername(false); return; }
    setSaving(true);
    await updateProfile({ username: newUsername.trim() });
    setSaving(false);
    setEditingUsername(false);
  }

  async function saveSize() {
    const inches = parseFloat(newSize);
    if (isNaN(inches) || inches <= 0 || inches > 16) { typeof window !== 'undefined' ? window.alert('Invalid size') : null; return; }
    setSaving(true);
    await updateProfile({ size_inches: inches });
    setSaving(false);
    setEditingSize(false);
  }

  async function saveXHandle() {
    const handle = newXHandle.trim().replace(/^@/, '');
    if (handle === ((profile as any)?.x_handle ?? '')) { setEditingXHandle(false); return; }
    setSaving(true);
    await updateProfile({ x_handle: handle || null } as any);
    setSaving(false);
    setEditingXHandle(false);
  }

  async function saveGirth() {
    if (!newGirth.trim()) {
      setSaving(true);
      await updateProfile({ girth_inches: null } as any);
      setSaving(false);
      setEditingGirth(false);
      return;
    }
    const inches = parseFloat(newGirth);
    if (isNaN(inches) || inches <= 0 || inches > 12) { typeof window !== 'undefined' ? window.alert('Invalid girth') : null; return; }
    setSaving(true);
    await updateProfile({ girth_inches: inches });
    setSaving(false);
    setEditingGirth(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); } else { router.push('/(tabs)' as any); } }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.title}>SETTINGS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>

        {/* Account */}
        <Text style={styles.section}>ACCOUNT</Text>
        <View style={styles.card}>
          {editingUsername ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={newUsername}
                onChangeText={setNewUsername}
                autoFocus
                autoCapitalize="none"
                placeholderTextColor={COLORS.muted}
              />
              <TouchableOpacity onPress={saveUsername} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={COLORS.gold} /> : <Text style={styles.saveBtn}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingUsername(false)}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SettingsRow icon="person-outline" label="Username" value={`@${profile?.username}`} onPress={() => setEditingUsername(true)} />
          )}

          <View style={styles.divider} />

          {editingSize ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={newSize}
                onChangeText={setNewSize}
                keyboardType="decimal-pad"
                autoFocus
                placeholder='e.g. 6.5"'
                placeholderTextColor={COLORS.muted}
              />
              <TouchableOpacity onPress={saveSize} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={COLORS.gold} /> : <Text style={styles.saveBtn}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingSize(false)}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SettingsRow
              icon="resize-outline"
              label="My Size (Length)"
              value={profile ? `${profile.size_inches.toFixed(1)}"  ${getSizeTier(profile.size_inches).emoji}` : '—'}
              onPress={() => setEditingSize(true)}
            />
          )}

          <View style={styles.divider} />

          {editingGirth ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={newGirth}
                onChangeText={setNewGirth}
                keyboardType="decimal-pad"
                autoFocus
                placeholder='e.g. 5.0" (leave blank to clear)'
                placeholderTextColor={COLORS.muted}
              />
              <TouchableOpacity onPress={saveGirth} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={COLORS.gold} /> : <Text style={styles.saveBtn}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingGirth(false)}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SettingsRow
              icon="expand-outline"
              label="My Girth (Optional)"
              value={profile?.girth_inches ? `${profile.girth_inches.toFixed(1)}"` : 'Not set'}
              onPress={() => setEditingGirth(true)}
            />
          )}

          <View style={styles.divider} />

          {editingXHandle ? (
            <View style={styles.editRow}>
              <Text style={{ color: COLORS.muted, fontSize: SIZES.md }}>@</Text>
              <TextInput
                style={styles.editInput}
                value={newXHandle}
                onChangeText={setNewXHandle}
                autoFocus
                autoCapitalize="none"
                placeholder="handle"
                placeholderTextColor={COLORS.muted}
                onSubmitEditing={saveXHandle}
              />
              <TouchableOpacity onPress={saveXHandle} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={COLORS.gold} /> : <Text style={styles.saveBtn}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingXHandle(false)}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <SettingsRow
                icon="logo-twitter"
                label="X (Twitter)"
                value={(profile as any)?.x_handle ? `@${(profile as any).x_handle}` : 'Not set'}
                onPress={() => setEditingXHandle(true)}
              />
              {(profile as any)?.x_handle && (profile as any)?.oauth_provider_id ? (
                <Text style={{ color: COLORS.green, fontSize: SIZES.xs, paddingHorizontal: 60, paddingBottom: 8 }}>✓ Verified via X</Text>
              ) : (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 60, marginBottom: 10, backgroundColor: '#000', borderWidth: 1, borderColor: '#333', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' }}
                  onPress={() => {
                    const token = getToken();
                    if (token && typeof window !== 'undefined') {
                      window.location.href = `/api/v1/auth/link-x/redirect?token=${token}`;
                    }
                  }}
                >
                  <Ionicons name="logo-twitter" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: SIZES.sm }}>Connect X Account</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Preferences section removed — push notifications not ready */}

        {/* Learn */}
        <Text style={styles.section}>LEARN</Text>
        <View style={styles.card}>
          <SettingsRow icon="book-outline" label="Whitepaper" onPress={() => typeof window !== 'undefined' && (window.location.href = '/whitepaper')} />
          <View style={styles.divider} />
          <SettingsRow icon="pie-chart-outline" label="Tokenomics" onPress={() => typeof window !== 'undefined' && (window.location.href = '/tokenomics')} />
          <View style={styles.divider} />
          <SettingsRow icon="code-slash-outline" label="Documentation" onPress={() => typeof window !== 'undefined' && (window.location.href = '/documentation')} />
          <View style={styles.divider} />
          <SettingsRow icon="logo-twitter" label="@wheresize" onPress={() => typeof window !== 'undefined' && window.open('https://x.com/wheresize', '_blank')} />
        </View>

        {/* About */}
        <Text style={styles.section}>ABOUT</Text>
        <View style={styles.card}>
          <SettingsRow icon="document-text-outline" label="Privacy Policy" onPress={() => typeof window !== 'undefined' && (window.location.href = '/privacy')} />
          <View style={styles.divider} />
          <SettingsRow icon="shield-outline" label="Terms of Service" onPress={() => typeof window !== 'undefined' && (window.location.href = '/terms')} />
          <View style={styles.divider} />
          <SettingsRow icon="information-circle-outline" label="Version" value="1.0.0" />
        </View>

        {/* Danger zone */}
        <Text style={styles.section}>ACCOUNT ACTIONS</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="log-out-outline"
            label="Sign Out"
            danger
            onPress={async () => { if (window.confirm('Sign out?')) { await signOut(); } }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="key-outline"
            label="Export Wallet Key"
            onPress={async () => {
              const confirm1 = window.prompt('This will export your custodial wallet private key and deactivate it permanently.\n\nType "I_UNDERSTAND_THIS_IS_IRREVERSIBLE" to continue:');
              if (confirm1 !== 'I_UNDERSTAND_THIS_IS_IRREVERSIBLE') { window.alert('Export cancelled.'); return; }
              try {
                const token = getToken();
                const res = await fetch('/api/v1/custodial/export', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ confirm: 'I_UNDERSTAND_THIS_IS_IRREVERSIBLE' }),
                });
                const data = await res.json();
                if (data.error) { window.alert(data.error); return; }
                if (data.privateKey) {
                  window.prompt('Your private key (copy it now — it will never be shown again):', data.privateKey);
                  window.alert('Custodial wallet deactivated. You now have full custody of this key.');
                }
              } catch { window.alert('Export failed. Try again.'); }
            }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="trash-outline"
            label="Delete Account"
            danger
            onPress={() => {
              const username = profile?.username ?? '';
              const input = window.prompt(`This will permanently delete your account, all your posts, and all your data. This cannot be undone.\n\nType "${username}" to confirm:`);
              if (!input) return;
              if (input.trim() !== username) { window.alert('Username did not match. Account not deleted.'); return; }
              const input2 = window.prompt('Type "DELETE" to permanently delete your account:');
              if (input2?.trim() !== 'DELETE') { window.alert('Account not deleted.'); return; }
              deleteProfile().then(({ error }) => {
                if (error) { window.alert(`Failed: ${error}`); }
                else { window.alert('Account deleted.'); signOut(); }
              });
            }}
          />
        </View>
      </ScrollView>

      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: SIZES.lg, fontWeight: '900', color: COLORS.white, letterSpacing: 3 },
  inner: { padding: 16, paddingBottom: 60, gap: 8 },
  premiumBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${COLORS.gold}15`, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}40`, padding: 16, marginBottom: 8 },
  premiumEmoji: { fontSize: 20 },
  premiumText: { color: COLORS.gold, fontWeight: '800', fontSize: SIZES.md },
  upgradeBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${COLORS.gold}15`, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: `${COLORS.gold}40`, padding: 16, marginBottom: 8 },
  upgradeText: { color: COLORS.gold, fontWeight: '800', fontSize: SIZES.md, flex: 1 },
  section: { color: COLORS.muted, fontSize: SIZES.xs, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 8, marginBottom: 4, paddingHorizontal: 4 },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: COLORS.cardBorder, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: `${COLORS.gold}15`, alignItems: 'center', justifyContent: 'center' },
  rowIconDanger: { backgroundColor: `${COLORS.red}15` },
  rowLabel: { flex: 1, color: COLORS.white, fontSize: SIZES.md, fontWeight: '500' },
  rowLabelDanger: { color: COLORS.red },
  rowValue: { color: COLORS.muted, fontSize: SIZES.md },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  editInput: { flex: 1, color: COLORS.white, fontSize: SIZES.md, borderBottomWidth: 1, borderBottomColor: COLORS.gold, paddingVertical: 4 },
  saveBtn: { color: COLORS.gold, fontWeight: '800', fontSize: SIZES.md },
  cancelBtn: { color: COLORS.muted, fontSize: SIZES.md },
});
