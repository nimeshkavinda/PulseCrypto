import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

export const styles = StyleSheet.create({
  headerButton: {
    marginLeft: spacing.lg,
    padding: spacing.xs,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
    backgroundColor: colors.bidGreenSubtle,
    borderColor: colors.bidGreen,
    borderWidth: 1,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bidGreen,
    marginRight: spacing.xs,
  },
  statusPillText: {
    color: colors.bidGreen,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
  },
});
