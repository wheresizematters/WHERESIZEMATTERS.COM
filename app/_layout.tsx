import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PurchaseProvider } from '@/context/PurchaseContext';
import { UnreadProvider } from '@/context/UnreadContext';
import { COLORS } from '@/constants/theme';
import InstallPrompt from '@/components/InstallPrompt';
import { addNotificationResponseListener } from '@/lib/notifications';

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
  const { session, loading, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);

  // Always show splash for at least SPLASH_DURATION ms
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []);

  // Handle tapping a push notification — navigate to the correct screen
  useEffect(() => {
    const sub = addNotificationResponseListener(response => {
      const data = response.notification.request.content.data as any;
      if (!data?.screen) return;
      if (data.screen === 'chat' && data.conversation_id) {
        router.push(`/chat/${data.conversation_id}` as any);
      } else if (data.screen === 'post' && data.post_id) {
        router.push(`/post/${data.post_id}` as any);
      } else if (data.screen === 'profile' && data.user_id) {
        router.push(`/profile/${data.user_id}` as any);
      }
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (loading || !splashDone) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inSetupSize = segments[0] === 'setup-size';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (session && !inSetupSize && (!profile || (profile as any)?.has_set_size === false)) {
      router.replace('/setup-size' as any);
    } else if (session && inSetupSize && (profile as any)?.has_set_size === true) {
      router.replace('/(tabs)');
    }
  }, [session, loading, splashDone, segments, profile]);

  if (!splashDone || loading) return <SplashScreen />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="chat/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="post/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="verify" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="admin" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      <Stack.Screen name="invite/[userId]" options={{ presentation: 'card', animation: 'fade' }} />
      <Stack.Screen name="setup-size" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });
  if (!fontsLoaded) return <SplashScreen />;

  return (
    <AuthProvider>
      <PurchaseProvider>
        <UnreadProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
          <InstallPrompt />
        </UnreadProvider>
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
