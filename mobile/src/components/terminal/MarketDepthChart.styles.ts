import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.mono,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  legendText: {
    fontSize: typography.fontSize.caption - 1,
    fontFamily: typography.fontFamily.mono,
    color: colors.textSecondary,
  },
  chartContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeOverlay: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  badgeCard: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'flex-start',
  },
  badgeTitle: {
    fontSize: 9,
    fontFamily: typography.fontFamily.mono,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  badgeValue: {
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.monoBold,
    fontWeight: typography.fontWeight.bold,
  },
  badgeGreenText: {
    color: colors.bidGreen,
  },
  badgeRedText: {
    color: colors.askRed,
  },
  badgeNeutralText: {
    color: colors.textSecondary,
  },
});
