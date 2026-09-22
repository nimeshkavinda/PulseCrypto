import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.monoMedium,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timestampText: {
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.monoMedium,
    color: colors.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  flashContainer: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  heroPrice: {
    fontSize: typography.fontSize.display,
    fontFamily: typography.fontFamily.monoBold,
    letterSpacing: -0.5,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  changeBadgeGreen: {
    backgroundColor: colors.bidGreenSubtle,
  },
  changeBadgeRed: {
    backgroundColor: colors.askRedSubtle,
  },
  changeText: {
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily.monoBold,
    marginLeft: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  statColumn: {
    flex: 1,
  },
  statColumnMiddle: {
    alignItems: 'center',
  },
  statColumnRight: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: typography.fontSize.caption - 0.5,
    fontFamily: typography.fontFamily.monoMedium,
    color: colors.textMuted,
    marginBottom: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: typography.fontSize.caption + 1,
    fontFamily: typography.fontFamily.monoBold,
    color: colors.textSecondary,
  },
});
