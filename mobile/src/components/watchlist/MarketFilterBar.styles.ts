import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 42,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily.regular,
    paddingVertical: 0,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.bidGreen,
  },
  chipInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
  },
  chipText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semiBold,
    fontFamily: typography.fontFamily.semiBold,
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
  chipTextInactive: {
    color: colors.textSecondary,
  },
  chipBadge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.pill,
  },
  chipBadgeActive: {
    backgroundColor: colors.bidGreen,
  },
  chipBadgeInactive: {
    backgroundColor: colors.surfaceActive,
  },
  chipBadgeText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.monoBold,
  },
  chipBadgeTextActive: {
    color: colors.primary,
  },
  chipBadgeTextInactive: {
    color: colors.textSecondary,
  },
});
