import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(26, 33, 44, 0.6)',
  },
  headerColPrice: {
    flex: 1.2,
    fontSize: typography.fontSize.caption - 1,
    fontFamily: typography.fontFamily.mono,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  headerColAmount: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.fontSize.caption - 1,
    fontFamily: typography.fontFamily.mono,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  headerColTotal: {
    flex: 1.2,
    textAlign: 'right',
    fontSize: typography.fontSize.caption - 1,
    fontFamily: typography.fontFamily.mono,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  depthBar: {
    position: 'absolute',
    right: 0,
    top: 1,
    bottom: 1,
    borderRadius: borderRadius.xs,
  },
  bidDepthBar: {
    backgroundColor: colors.bidGreenSubtle,
  },
  askDepthBar: {
    backgroundColor: colors.askRedSubtle,
  },
  colPrice: {
    flex: 1.2,
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.mono,
    fontWeight: typography.fontWeight.medium,
  },
  bidText: {
    color: colors.bidGreen,
  },
  askText: {
    color: colors.askRed,
  },
  colAmount: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.mono,
    color: colors.textPrimary,
  },
  colTotal: {
    flex: 1.2,
    textAlign: 'right',
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.mono,
    color: colors.textSecondary,
  },
});
