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

        {/* Premium status */}
        {isPremium ? (
          <View style={styles.premiumBanner}>
            <Ionicons name="ribbon" size={20} color={COLORS.gold} />
            <Text style={styles.premiumText}>SIZE. Premium — Active</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.upgradeBanner} onPress={() => setShowPaywall(true)}>
            <Ionicons name="star" size={18} color={COLORS.gold} />
            <Text style={styles.upgradeText}>Upgrade to Premium</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.gold} />
          </TouchableOpacity>
        )}

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
        </View>

        {/* Notifications */}
        <Text style={styles.section}>PREFERENCES</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="notifications-outline"
            label="Push Notifications"
            toggle
            toggleValue={notifications}
            onToggle={async (v) => { setNotifications(v); await updateProfile({ notifications_enabled: v }); }}
          />
        </View>

        {/* About */}
        <Text style={styles.section}>ABOUT</Text>
        <View style={styles.card}>
          <SettingsRow icon="document-text-outline" label="Privacy Policy" onPress={() => typeof window !== 'undefined' ? window.alert('Coming soon.') : null} />
          <View style={styles.divider} />
          <SettingsRow icon="shield-outline" label="Terms of Service" onPress={() => typeof window !== 'undefined' ? window.alert('Coming soon.') : null} />
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
            onPress={() => { if (window.confirm('Sign out?')) {
              
              { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ])}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="trash-outline"
            label="Delete Account"
            danger
            onPress={() => { if (window.confirm('Delete account? This is permanent.')) {
              
              { text: 'Delete', style: 'destructive', onPress: () => typeof window !== 'undefined' ? window.alert('Contact support@sizeapp.com to delete your account.') : null },
            ])}
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
