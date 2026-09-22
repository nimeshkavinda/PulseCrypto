import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingBottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  header: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.monoBold,
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
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.monoMedium,
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
    justifyContent: 'space-between',
    backgroundColor: 'rgba(21, 27, 38, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: borderRadius.md,
    width: 232,
    height: 54,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeColumn: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  badgeDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 8,
  },
  badgeTitle: {
    fontSize: 9,
    fontFamily: typography.fontFamily.monoMedium,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  badgeValue: {
    fontSize: 11.5,
    fontFamily: typography.fontFamily.monoBold,
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
