import { Platform, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import WebNavbar from '@/components/WebNavbar';
import { useUnread } from '@/context/UnreadContext';

type IconName = 'home' | 'home-outline' | 'trophy' | 'trophy-outline' | 'flash' | 'flash-outline' | 'chatbubbles' | 'chatbubbles-outline' | 'person' | 'person-outline' | 'git-compare' | 'git-compare-outline';

function TabIcon({ name, focused, label, badge }: { name: IconName; focused: boolean; label: string; badge?: boolean }) {
  return (
    <View style={styles.tabItem}>
      <View>
        <Ionicons name={focused ? name : `${name}-outline` as IconName} size={22} color={focused ? COLORS.gold : COLORS.muted} />
        {badge && <View style={styles.badgeDot} />}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function EarnTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.earnBtn, focused && styles.earnBtnActive]}>
      <View style={[styles.goldCoin, focused && styles.goldCoinActive]}>
        <Text style={styles.goldCoinText}>$</Text>
      </View>
      <Text style={[styles.earnLabel, focused && styles.earnLabelActive]}>EARN</Text>
    </View>
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;
  const { hasUnread } = useUnread();

  return (
    <>
      {isDesktopWeb && <WebNavbar />}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: isDesktopWeb ? styles.tabBarHidden : styles.tabBar,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} label="Feed" /> }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="trophy" focused={focused} label="Ranks" /> }}
        />
        <Tabs.Screen
          name="earn"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="trending-up" focused={focused} label="Grow" /> }}
        />
        <Tabs.Screen
          name="explore"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="planet" focused={focused} label="Explore" /> }}
        />
        <Tabs.Screen
          name="communities"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} label="Circles" /> }}
        />
        <Tabs.Screen name="messages" options={{ href: null }} />
        <Tabs.Screen
          name="profile"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} label="Profile" /> }}
        />
        {/* Hidden from tab bar but still routable */}
        <Tabs.Screen name="compare" options={{ href: null }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#111111',
    borderTopColor: '#222222',
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabBarHidden: {
    display: 'none' as any,
    height: 0,
  },
  tabItem: { alignItems: 'center', gap: 4, width: 60 },
  badgeDot: { position: 'absolute', top: -1, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold, borderWidth: 1.5, borderColor: '#111111' },
  tabLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '600', letterSpacing: 0.3 },
  tabLabelActive: { color: COLORS.gold },

  // EARN center button
  earnBtn: { alignItems: 'center', justifyContent: 'center', width: 56, height: 44, borderRadius: 16, backgroundColor: '#1A1200', borderWidth: 1, borderColor: '#333', gap: 1 },
  earnBtnActive: { backgroundColor: `${COLORS.gold}20`, borderColor: `${COLORS.gold}60` },
  goldCoin: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#8B7355', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#6B5A3E' },
  goldCoinActive: { backgroundColor: COLORS.gold, borderColor: '#A88430' },
  goldCoinText: { color: '#fff', fontSize: 12, fontWeight: '900', lineHeight: 14 },
  earnLabel: { fontSize: 8, color: COLORS.muted, fontWeight: '800', letterSpacing: 1 },
  earnLabelActive: { color: COLORS.gold },
});
