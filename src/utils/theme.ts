import { useThemeStore } from '../store/themeStore';

const lightColors = {
  primary: '#00695C',
  primaryLight: '#009688',
  primaryDark: '#004D40',

  accent: '#FF6F00',
  accentLight: '#FFF3E0',

  bg: '#FAFAFA',
  card: '#FFFFFF',
  searchBg: '#F0EEEB',

  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted: '#9E9E9E',

  border: '#E8E5E0',
  divider: '#F0EEEB',

  pillBg: '#F0EEEB',
  pillActiveBg: '#00695C',
  pillText: '#4A4A4A',
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
};

const darkColors = {
  primary: '#4DB6AC',
  primaryLight: '#80CBC4',
  primaryDark: '#B2DFDB',

  accent: '#FFB74D',
  accentLight: '#3D2A1A',

  bg: '#121212',
  card: '#1E1E1E',
  searchBg: '#2A2A2A',

  textPrimary: '#F0F0F0',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',

  border: '#333333',
  divider: '#2A2A2A',

  pillBg: '#2A2A2A',
  pillActiveBg: '#4DB6AC',
  pillText: '#A0A0A0',
  pillActiveText: '#FFFFFF',

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
