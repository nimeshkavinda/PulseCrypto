import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.heading,
    fontSize: 22,
    color: colors.textPrimary,
    lineHeight: 28,
  },
  headerSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.subtitle,
    fontFamily: typography.fontFamily.heading,
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: typography.lineHeight.body,
  },
  emptyButton: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  emptyButtonText: {
    color: colors.bidGreen,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semiBold,
    fontFamily: typography.fontFamily.semiBold,
  },
});
