import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

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
  skeletonHero: {
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  skeletonGap: {
    marginTop: spacing.sm,
  },
});
