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
  haltedText: {
    color: colors.warningYellow,
    fontSize: 9,
    fontFamily: typography.fontFamily.bold,
    marginLeft: spacing.xs,
  },
  skeletonLine: {
    marginTop: spacing.xs,
  },
  priceFlash: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: 4,
    marginBottom: spacing.xs,
  },
  symbolText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.subtitle,
    fontFamily: typography.fontFamily.heading,
    marginRight: spacing.sm,
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
