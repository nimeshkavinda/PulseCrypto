import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

/**
 * Route-level error boundary (exported as `ErrorBoundary` from layouts; expo-router renders it in
 * place of the failed route). Keeps the surrounding shell alive and offers a retry.
 */
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>This screen hit an unexpected error. Your data and settings are safe.</Text>
      {__DEV__ ? <Text style={styles.detail}>{error.message}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={retry} accessibilityRole="button" activeOpacity={0.7}>
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: { color: colors.textPrimary, fontFamily: typography.fontFamily.heading, fontSize: typography.fontSize.title },
  body: { color: colors.textSecondary, fontFamily: typography.fontFamily.regular, fontSize: typography.fontSize.body, textAlign: 'center', marginTop: spacing.sm },
  detail: { color: colors.askRed, fontFamily: typography.fontFamily.monoMedium, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
  button: { marginTop: spacing.lg, backgroundColor: colors.bidGreen, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  buttonText: { color: colors.primary, fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.body },
});
