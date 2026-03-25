import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '@/constants/theme';

const TABS = [
  { label: 'Feed',        href: '/(tabs)',              icon: 'home-outline' as const,           iconActive: 'home' as const,        match: '/' },
  { label: 'Leaderboard', href: '/(tabs)/leaderboard',  icon: 'trophy-outline' as const,         iconActive: 'trophy' as const,      match: '/leaderboard' },
  { label: 'Earn',        href: '/(tabs)/earn',          icon: 'flash-outline' as const,          iconActive: 'flash' as const,       match: '/earn' },
  { label: '$SIZE',       href: '/tokenomics',            icon: 'logo-usd' as const,              iconActive: 'logo-usd' as const,    match: '/tokenomics' },
  { label: 'Messages',    href: '/(tabs)/messages',      icon: 'chatbubbles-outline' as const,    iconActive: 'chatbubbles' as const, match: '/messages' },
  { label: 'Profile',     href: '/(tabs)/profile',       icon: 'person-outline' as const,         iconActive: 'person' as const,      match: '/profile' },
];

export default function WebNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  if (width < 768) return null;

  return (
    <View style={styles.navbar}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.push('/' as any)}>
          <Text style={styles.logo}>SIZE.</Text>
        </TouchableOpacity>

        <View style={styles.tabs}>
          {TABS.map(tab => {
            const active = pathname === tab.match || (tab.match !== '/' && pathname.startsWith(tab.match + '/'));
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
