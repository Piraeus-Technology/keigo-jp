import { useThemeStore } from '../store/themeStore';

const lightColors = {
  primary: '#DB4E05',
  primaryLight: '#FE7A1A',
  primaryDark: '#A83C04',

  accent: '#FE690A',
  accentLight: '#FFF1E6',

  bg: '#FFFBF8',
  card: '#FFFFFF',
  searchBg: '#F6F0EA',

  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted: '#9E9E9E',

  border: '#EDE6DF',
  divider: '#F4EEE8',

  pillBg: '#F6F0EA',
  pillActiveBg: '#DB4E05',
  pillText: '#5A5046',
  pillActiveText: '#FFFFFF',

  sonkeigoTag: '#E8F5E9',
  sonkeigoTagText: '#2E7D32',
  kenjougoTag: '#E3F2FD',
  kenjougoTagText: '#1565C0',
  teineigoTag: '#FFF3E0',
  teineigoTagText: '#E65100',
  expressionTag: '#F3E5F5',
  expressionTagText: '#7B1FA2',

  basicTag: '#E8F5E9',
  basicTagText: '#2E7D32',
  intermediateTag: '#FFF8E1',
  intermediateTagText: '#F57F17',
  advancedTag: '#FFEBEE',
  advancedTagText: '#C62828',

  successBg: '#E8F5E9',
  successText: '#2E7D32',
  errorBg: '#FFEBEE',
  errorText: '#C62828',

  // Activity heatmap — orange intensity ramp (on-brand with the fox palette)
  calLow: '#FFE8D6',
  calLowText: '#B4480A',
  calMid: '#FDB87A',
  calMidText: '#7A3206',
  calHigh: '#EF6C00',
  calHighText: '#FFFFFF',
};

const darkColors = {
  primary: '#FF8A4D',
  primaryLight: '#FFA570',
  primaryDark: '#FFB98C',

  accent: '#FF8A4D',
  accentLight: '#3A2415',

  bg: '#141210',
  card: '#211E1B',
  searchBg: '#2C2722',

  textPrimary: '#F2EDE9',
  textSecondary: '#A89F98',
  textMuted: '#6B635C',

  border: '#37312B',
  divider: '#2C2722',

  pillBg: '#2C2722',
  pillActiveBg: '#FF8A4D',
  pillText: '#A89F98',
  pillActiveText: '#2A1607',

  sonkeigoTag: '#1B3A1B',
  sonkeigoTagText: '#66BB6A',
  kenjougoTag: '#0D2137',
  kenjougoTagText: '#64B5F6',
  teineigoTag: '#3E2200',
  teineigoTagText: '#FFB74D',
  expressionTag: '#2A1A30',
  expressionTagText: '#CE93D8',

  basicTag: '#1B3A1B',
  basicTagText: '#66BB6A',
  intermediateTag: '#3E2E00',
  intermediateTagText: '#FFD54F',
  advancedTag: '#3E1A1A',
  advancedTagText: '#EF9A9A',

  successBg: '#1B3A1B',
  successText: '#66BB6A',
  errorBg: '#3E1A1A',
  errorText: '#EF5350',

  // Activity heatmap — orange intensity ramp on dark surfaces
  calLow: '#2E1C10',
  calLowText: '#FFB98C',
  calMid: '#5A3310',
  calMidText: '#FFCBA0',
  calHigh: '#C2510A',
  calHighText: '#FFE9D6',
};

export type ThemeColors = typeof lightColors;

export const themes = { light: lightColors, dark: darkColors };

export function useColors(): ThemeColors {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? darkColors : lightColors;
}

export const colors = lightColors;

export const fonts = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
    hero: 40,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
};
