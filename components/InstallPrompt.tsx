import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Extend Window to hold the deferred BeforeInstallPromptEvent
declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent;
  }
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true;
  if ((navigator as any).standalone === true) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroidChrome(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent) && /chrome/i.test(navigator.userAgent);
}

export default function InstallPrompt() {
  // Never show on native platforms
  if (Platform.OS !== 'web') return null;

  return <InstallPromptInner />;
}

function InstallPromptInner() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const iosSheetSlide = useRef(new Animated.Value(120)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Already running as installed PWA — nothing to do
    if (isStandalone()) return;

    // Only show install prompt on mobile devices — desktop users go straight to the app
    if (!isIOS() && !isAndroidChrome()) return;

    // Capture the Android beforeinstallprompt event as early as possible
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Show the install page
    setVisible(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();

    // Gentle glow pulse on the CTA button
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [visible]);

  const handleInstallPress = async () => {
    if (isIOS()) {
      setShowIOSSteps(true);
      Animated.spring(iosSheetSlide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }).start();
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setVisible(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismissIOSSheet = () => {
    Animated.timing(iosSheetSlide, { toValue: 120, duration: 300, useNativeDriver: true }).start(() => {
      setShowIOSSteps(false);
    });
  };

  if (!visible) return null;

  const ios = isIOS();
  const android = isAndroidChrome();
  const showInstallButton = ios || android || deferredPrompt !== null;

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.container,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Background glow blobs */}
        <View style={styles.glowTopRight} />
        <View style={styles.glowBottomLeft} />

        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logo}>SIZE.</Text>
          <Text style={styles.tagline}>Where size matters.</Text>
          <Text style={styles.subTagline}>
            Verify your size. Rank on the leaderboard. Earn $SIZE tokens.
          </Text>
        </View>

        {/* Feature pills */}
        <View style={styles.featureRow}>
          {['📏 Measure', '🏆 Rank', '💰 Earn'].map((label) => (
            <View key={label} style={styles.featurePill}>
              <Text style={styles.featurePillText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Install CTA */}
        {showInstallButton && (
          <Animated.View style={{ opacity: glowAnim, width: '100%', alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.installButton}
              onPress={handleInstallPress}
              activeOpacity={0.85}
            >
              <Text style={styles.installButtonText}>Add to Home Screen</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Browsers that don't support install prompt */}
        {!showInstallButton && (
          <Text style={styles.unsupportedNote}>
            Open in Safari (iOS) or Chrome (Android) to install.
          </Text>
        )}

        {/* Skip link */}
        <TouchableOpacity onPress={() => setVisible(false)}>
          <Text style={styles.skipText}>Continue without installing</Text>
        </TouchableOpacity>

        {/* iOS step-by-step card */}
        {showIOSSteps && (
          <>
            <TouchableOpacity style={styles.iosBackdrop} onPress={handleDismissIOSSheet} activeOpacity={1} />
            <Animated.View
              style={[styles.iosSheet, { transform: [{ translateY: iosSheetSlide }] }]}
            >
              <View style={styles.iosSheetHandle} />
              <Text style={styles.iosSheetTitle}>Install SIZE.</Text>
              <View style={styles.iosStep}>
                <View style={styles.iosStepBadge}><Text style={styles.iosStepNum}>1</Text></View>
                <Text style={styles.iosStepText}>
                  Tap the <Text style={styles.iosStepHighlight}>three dots ···</Text> in the{' '}
                  <Text style={styles.iosStepHighlight}>bottom right</Text> of Safari.
                </Text>
              </View>
              <View style={styles.iosStep}>
                <View style={styles.iosStepBadge}><Text style={styles.iosStepNum}>2</Text></View>
                <Text style={styles.iosStepText}>
                  Tap <Text style={styles.iosStepHighlight}>Share</Text>{' '}
                  <Text style={styles.iosShareIcon}>□↑</Text> from the menu.
                </Text>
              </View>
              <View style={styles.iosStep}>
                <View style={styles.iosStepBadge}><Text style={styles.iosStepNum}>3</Text></View>
                <Text style={styles.iosStepText}>
                  Tap <Text style={styles.iosStepHighlight}>"Add to Home Screen"</Text> then{' '}
                  <Text style={styles.iosStepHighlight}>"Add"</Text>.
                </Text>
              </View>
              <TouchableOpacity style={styles.iosDismiss} onPress={handleDismissIOSSheet}>
                <Text style={styles.iosDismissText}>Got it</Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const ORANGE = '#E8500A';
const BG = '#0A0A0A';
const MUTED = 'rgba(255,255,255,0.45)';
const CARD_BG = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.08)';

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: BG,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    gap: 32,
    overflow: 'hidden' as const,
  },

  // Background atmosphere
  glowTopRight: {
    position: 'absolute' as const,
    top: -100,
    right: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(232,80,10,0.12)',
  },
  glowBottomLeft: {
    position: 'absolute' as const,
    bottom: -80,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(232,80,10,0.07)',
  },

  // Logo section
  logoSection: {
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    fontSize: 80,
    fontWeight: '900',
    color: ORANGE,
    letterSpacing: 10,
    textShadowColor: 'rgba(232,80,10,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
    fontWeight: '500',
  },
  subTagline: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center' as const,
    lineHeight: 22,
    maxWidth: 300,
    marginTop: 4,
  },

  // Feature pills
  featureRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  featurePill: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  featurePillText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '500',
  },

  // Install button
  installButton: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center' as const,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 12,
  },
  installButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  unsupportedNote: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center' as const,
    lineHeight: 20,
    maxWidth: 280,
  },
  skipText: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center' as const,
    textDecorationLine: 'underline' as const,
    marginTop: 4,
  },

  // iOS sheet backdrop
  iosBackdrop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // iOS bottom sheet
  iosSheet: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#161616',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomWidth: 0,
  },
  iosSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center' as const,
    marginBottom: 8,
  },
  iosSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center' as const,
  },
  iosStep: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 14,
  },
  iosStepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    marginTop: 1,
  },
  iosStepNum: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  iosStepText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  iosStepHighlight: {
    color: '#fff',
    fontWeight: '600',
  },
  iosShareIcon: {
    color: ORANGE,
    fontWeight: '700',
    fontSize: 15,
  },
  iosDismiss: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
    marginTop: 4,
  },
  iosDismissText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
