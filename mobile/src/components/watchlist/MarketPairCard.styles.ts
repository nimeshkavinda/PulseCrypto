import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  symbolText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.subtitle,
    fontFamily: typography.fontFamily.heading,
    marginRight: spacing.sm,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bidGreenSubtle,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bidGreen,
    marginRight: 4,
  },
  liveText: {
    color: colors.bidGreen,
    fontSize: 9,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  syncedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  syncedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginRight: 4,
  },
  syncedText: {
    color: '#F59E0B',
    fontSize: 9,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  volumeText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.regular,
    marginBottom: spacing.xs,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.regular,
  },
  rangeValue: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.monoMedium,
  },
  rangeMarginLeft: {
    marginLeft: spacing.md,
  },
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  priceText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.subtitle,
    fontFamily: typography.fontFamily.monoBold,
    marginBottom: spacing.xs,
  },
  changePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    minWidth: 68,
    alignItems: 'center',
  },
  changePillPositive: {
    backgroundColor: colors.bidGreenSubtle,
  },
  changePillNegative: {
    backgroundColor: colors.askRedSubtle,
  },
  changeText: {
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.bold,
  },
  changeTextPositive: {
    color: colors.bidGreen,
  },
  changeTextNegative: {
    color: colors.askRed,
  },
  favoriteButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
