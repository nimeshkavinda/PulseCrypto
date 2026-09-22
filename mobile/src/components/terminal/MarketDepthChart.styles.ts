import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  header: {
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
    marginBottom: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: typography.fontSize.caption - 1,
    fontFamily: typography.fontFamily.mono,
    color: colors.textSecondary,
  },
  chartContainer: {
    width: '100%',
    height: 190,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  floatingBadgeCard: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(21, 27, 38, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeColumn: {
    alignItems: 'flex-start',
  },
  badgeDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 10,
  },
  badgeTitle: {
    fontSize: 9,
    fontFamily: typography.fontFamily.mono,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  badgeValue: {
    fontSize: 12,
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
