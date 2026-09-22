import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme/tokens.js';

export function TelemetryScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PHASE 6 TELEMETRY</Text>
        </View>
        <Text style={styles.title}>Performance Telemetry</Text>
        <Text style={styles.subtitle}>
          Real-time circular JS thread FPS gauge, msg/sec counter, Hermes memory sparkline, and JSI diagnostics.
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
    backgroundColor: colors.warningYellowSubtle,
    borderColor: colors.warningYellow,
    borderWidth: 1,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  badgeText: {
    color: colors.warningYellow,
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
