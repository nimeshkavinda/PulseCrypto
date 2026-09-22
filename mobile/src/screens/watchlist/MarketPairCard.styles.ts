import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
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
    fontWeight: typography.fontWeight.bold,
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
    fontWeight: typography.fontWeight.bold,
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
    fontWeight: typography.fontWeight.medium,
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
    fontWeight: typography.fontWeight.bold,
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
    fontWeight: typography.fontWeight.bold,
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
