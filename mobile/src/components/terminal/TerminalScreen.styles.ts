import { StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
