import { Platform } from 'react-native';

// Legacy Colors export (used by some existing components)
export const Colors = {
  light: { text: '#FFFFFF', background: '#0A0A0A', tint: '#C9A84C', icon: '#888888', tabIconDefault: '#888888', tabIconSelected: '#C9A84C' },
  dark: { text: '#FFFFFF', background: '#0A0A0A', tint: '#C9A84C', icon: '#888888', tabIconDefault: '#888888', tabIconSelected: '#C9A84C' },
};

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

export const COLORS = {
  bg: '#0A0A0A',
  card: '#141414',
  cardBorder: '#222222',
  gold: '#E8500A',
  goldLight: '#FF6B2B',
  white: '#FFFFFF',
  offWhite: '#EEEEEE',
  muted: '#888888',
  mutedDark: '#333333',
  red: '#FF453A',
  green: '#32D74B',
  blue: '#0A84FF',
  purple: '#BF5AF2',
  tierSmall: '#666666',
  tierAverage: '#4A9EFF',
  tierLarge: '#BF5AF2',
  tierXL: '#C9A84C',
};

export const SIZES = {
  xs: 10, sm: 12, md: 14, base: 16, lg: 18, xl: 22, xxl: 28, xxxl: 36, huge: 48,
};

export const RADIUS = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 999,
};

export const SIZE_TIERS = {
  small:   { label: 'Below Average', min: 0,   max: 5,   color: '#666666', emoji: '' },
  average: { label: 'Average',       min: 5,   max: 6.5, color: '#4A9EFF', emoji: '' },
  large:   { label: 'Above Average', min: 6.5, max: 8,   color: '#BF5AF2', emoji: '' },
  xl:      { label: 'XL',            min: 8,   max: 99,  color: '#C9A84C', emoji: '' },
};

export function getSizeTier(inches: number) {
  if (inches >= 8)   return SIZE_TIERS.xl;
  if (inches >= 6.5) return SIZE_TIERS.large;
  if (inches >= 5)   return SIZE_TIERS.average;
  return SIZE_TIERS.small;
}
