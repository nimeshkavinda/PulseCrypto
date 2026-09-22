import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export default function SupportScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>24/7 VIP Support</Text>
        <Text style={styles.subtitle}>
          Direct priority desk for institutional order matching, OTC block trades, and latency inquiries.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.navigate('/')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={16} color={colors.bidGreen} />
          <Text style={styles.backButtonText}>Return to Terminal</Text>
        </TouchableOpacity>
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
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.subtitle,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.heading,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: typography.lineHeight.body,
    marginBottom: spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bidGreenSubtle,
    borderWidth: 1,
    borderColor: colors.bidGreen,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    gap: spacing.xs,
  },
  backButtonText: {
    color: colors.bidGreen,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.bold,
  },
});
