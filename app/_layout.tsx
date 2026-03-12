import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PurchaseProvider } from '@/context/PurchaseContext';
import { COLORS } from '@/constants/theme';

const SPLASH_DURATION = 2600; // ms

function SplashScreen() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 500, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={splash.container}>
      <Animated.Text style={[splash.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        SIZE.
      </Animated.Text>
      <Animated.Text style={[splash.tagline, { opacity: taglineOpacity }]}>
        Where size matters.
      </Animated.Text>
    </View>
  );
}

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);

  // Always show splash for at least SPLASH_DURATION ms
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || !splashDone) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, splashDone, segments]);

  if (!splashDone || loading) return <SplashScreen />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" options={{ presentation: 'card', animation: 'slide_from_right' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PurchaseProvider>
        <StatusBar style="light" />
        <RootLayoutNav />
      </PurchaseProvider>
    </AuthProvider>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  logo: {
    fontSize: 72, fontWeight: '900', color: COLORS.gold, letterSpacing: 8,
  },
  tagline: {
    fontSize: 14, color: COLORS.muted, letterSpacing: 3, textTransform: 'uppercase',
  },
});
