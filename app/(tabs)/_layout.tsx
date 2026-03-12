import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';
import WebNavbar from '@/components/WebNavbar';

const isWeb = Platform.OS === 'web';

type IconName = 'home' | 'home-outline' | 'trophy' | 'trophy-outline' | 'git-compare' | 'git-compare-outline' | 'person' | 'person-outline';

function TabIcon({ name, focused, label }: { name: IconName; focused: boolean; label: string }) {
  return (
    <View style={styles.tabItem}>
      <Ionicons name={focused ? name : `${name}-outline` as IconName} size={22} color={focused ? COLORS.gold : COLORS.muted} />
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <>
      {isWeb && <WebNavbar />}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: isWeb ? styles.tabBarHidden : styles.tabBar,
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
          name="compare"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="git-compare" focused={focused} label="Compare" /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} label="Profile" /> }}
        />
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#111111',
    borderTopColor: '#222222',
    borderTopWidth: 1,
    height: 70,
    paddingBottom: 10,
    paddingTop: 6,
  },
  tabBarHidden: {
    display: 'none' as any,
    height: 0,
  },
  tabItem: { alignItems: 'center', gap: 2, width: 60 },
  tabLabel: { fontSize: 9, color: COLORS.muted, fontWeight: '600', letterSpacing: 0.3 },
  tabLabelActive: { color: COLORS.gold },
});
