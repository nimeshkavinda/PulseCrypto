import { StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

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
});
