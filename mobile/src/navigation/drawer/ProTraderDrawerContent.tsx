import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens.js';

interface DrawerMenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: string;
}

const MENU_ITEMS: DrawerMenuItem[] = [
  { icon: 'key-outline', label: 'API Management', badge: 'Active' },
  { icon: 'shield-checkmark-outline', label: 'Security & 2FA' },
  { icon: 'time-outline', label: 'Trade History' },
  { icon: 'wallet-outline', label: 'Fee Level & Rebates', badge: 'VIP 2' },
  { icon: 'help-circle-outline', label: 'Support & FAQ' },
];

export function ProTraderDrawerContent() {
  return (
    <View style={styles.container}>
      {/* Header: Pro Trader Identity (Mockup 3) */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>PT</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>Alex Mercer</Text>
          <Text style={styles.profileUid}>Pro Trader • UID #8492048</Text>
        </View>

        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Tier 3 Verified</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Menu Options */}
      <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>ACCOUNT & PREFERENCES</Text>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
              <Text style={styles.menuItemText}>{item.label}</Text>
            </View>
            {item.badge ? (
              <View style={styles.itemBadge}>
                <Text style={styles.itemBadgeText}>{item.badge}</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.divider} />

      {/* Footer: Sign Out & Engine Telemetry */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.signOutButton} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color={colors.askRed} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.engineBadge}>
          <Text style={styles.engineText}>Hermes Engine • JSI TurboModules</Text>
          <Text style={styles.versionText}>PulseCrypto Mobile v1.0.0</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingTop: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    color: colors.bidGreen,
    fontSize: typography.fontSize.subtitle,
    fontWeight: typography.fontWeight.bold,
  },
  profileInfo: {
    marginBottom: spacing.sm,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.subtitle,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2,
  },
  profileUid: {
    color: colors.textMuted,
    fontSize: typography.fontSize.caption,
    fontFamily: typography.fontFamily.mono,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.bidGreenSubtle,
    borderColor: colors.bidGreen,
    borderWidth: 1,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bidGreen,
    marginRight: spacing.xs,
  },
  statusText: {
    color: colors.bidGreen,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuItemText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.medium,
  },
  itemBadge: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderHighlight,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  itemBadgeText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.medium,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  signOutText: {
    color: colors.askRed,
    fontSize: typography.fontSize.body,
    fontWeight: typography.fontWeight.medium,
  },
  engineBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  engineText: {
    color: colors.bidGreen,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 2,
  },
  versionText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.caption - 1,
  },
});
