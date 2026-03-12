import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '@/constants/theme';

const TABS = [
  { label: 'Feed',        href: '/',            icon: 'home-outline' as const,        iconActive: 'home' as const },
  { label: 'Leaderboard', href: '/leaderboard', icon: 'trophy-outline' as const,      iconActive: 'trophy' as const },
  { label: 'Compare',     href: '/compare',     icon: 'git-compare-outline' as const, iconActive: 'git-compare' as const },
  { label: 'Profile',     href: '/profile',     icon: 'person-outline' as const,      iconActive: 'person' as const },
];

export default function WebNavbar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.navbar}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.push('/' as any)}>
          <Text style={styles.logo}>SIZE.</Text>
        </TouchableOpacity>

        <View style={styles.tabs}>
          {TABS.map(tab => {
            const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
            return (
              <TouchableOpacity
                key={tab.href}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => router.push(tab.href as any)}
              >
                <Ionicons
                  name={active ? tab.iconActive : tab.icon}
                  size={16}
                  color={active ? COLORS.gold : COLORS.muted}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    width: '100%',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 900,
    marginHorizontal: 'auto' as any,
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: '100%',
  },
  logo: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 4,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: `${COLORS.gold}15`,
  },
  tabLabel: {
    color: COLORS.muted,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: COLORS.gold,
  },
});
