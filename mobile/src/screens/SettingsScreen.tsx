import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme/tokens.js';

export function SettingsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PHASE 6 SETTINGS</Text>
        </View>
        <Text style={styles.title}>System Settings</Text>
        <Text style={styles.subtitle}>
          In-app client-side data throttling configurator slider (10ms–1000ms), gateway endpoint config, and cache options.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    maxWidth: 360,
  },
  badge: {
    backgroundColor: colors.bidGreenSubtle,
    borderColor: colors.bidGreen,
    borderWidth: 1,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  badgeText: {
    color: colors.bidGreen,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.title,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.body,
    textAlign: 'center',
    lineHeight: typography.lineHeight.body,
  },
});
