import { Platform } from 'react-native';

export const colors = {
  bg: '#0B1220',
  surface: '#111C2E',
  surfaceAlt: '#16233A',
  surfaceHi: '#1D2C46',
  border: '#25344F',
  borderSoft: '#1B2840',

  text: '#EEF3FB',
  textMuted: '#9BAAC4',
  textFaint: '#65768F',

  brand: '#2ED3C6',
  brandDark: '#0FA79C',
  brandSoft: 'rgba(46, 211, 198, 0.14)',

  accent: '#7C8CFF',
  accentSoft: 'rgba(124, 140, 255, 0.16)',

  success: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.16)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.16)',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.16)',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(3, 8, 18, 0.72)',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const shadow = Platform.select({
  web: {
    card: { boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)' },
    float: { boxShadow: '0 14px 40px rgba(0, 0, 0, 0.4)' },
  },
  default: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    float: {
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
  },
});

export const typography = {
  display: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  section: { fontSize: 13, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  tiny: { fontSize: 11, color: colors.textFaint },
};

export const CURRENCY = 'lei';

export function money(value) {
  return `${Number(value || 0).toFixed(2)} ${CURRENCY}`;
}
