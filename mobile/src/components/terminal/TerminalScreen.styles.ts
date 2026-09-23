import { StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  placeholder: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
    padding: spacing.lg,
  },
});
