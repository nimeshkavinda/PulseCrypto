/**
 * PulseCrypto Design System Tokens
 * Strictly implements Mockup 1 specification:
 * Colors: #0B0E14 (Primary Dark), #00C57A (Secondary Green), #FF3B69 (Tertiary Red), #1E2633 (Neutral Surface), #2A3649 (Border)
 */

export const colors = {
  // Brand Backgrounds & Surfaces
  primary: '#0B0E14',
  surface: '#1E2633',
  surfaceElevated: '#253040',
  surfaceActive: '#2D3A4D',

  // Semantic Trading Colors
  bidGreen: '#00C57A',
  bidGreenSubtle: 'rgba(0, 197, 122, 0.14)',
  askRed: '#FF3B69',
  askRedSubtle: 'rgba(255, 59, 105, 0.14)',

  // Borders & Dividers
  border: '#2A3649',
  borderSubtle: '#1A2230',
  borderHighlight: '#3E4D64',

  // Text Hierarchies
  textPrimary: '#FFFFFF',
  textSecondary: '#8E9BAE',
  textMuted: '#5A677B',

  // Status & Accents
  accentBlue: '#3B82F6',
  accentBlueSubtle: 'rgba(59, 130, 246, 0.14)',
  warningYellow: '#F59E0B',
  warningYellowSubtle: 'rgba(245, 158, 11, 0.14)',
} as const;

export const typography = {
  fontFamily: {
    regular: 'System',
    mono: 'Courier',
  },
  fontSize: {
    caption: 11,
    small: 12,
    body: 14,
    subtitle: 16,
    title: 20,
    hero: 26,
    display: 32,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
  lineHeight: {
    caption: 14,
    small: 16,
    body: 20,
    subtitle: 22,
    title: 26,
    hero: 32,
    display: 40,
  },
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  glowBid: {
    shadowColor: '#00C57A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  glowAsk: {
    shadowColor: '#FF3B69',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
} as const;

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
} as const;

export type Theme = typeof theme;
