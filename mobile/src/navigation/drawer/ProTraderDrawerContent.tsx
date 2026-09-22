import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import { styles } from './ProTraderDrawerContent.styles';

export function ProTraderDrawerContent() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
      {/* Header: Pro Trader Identity (Mockup 3) */}
      <View style={styles.header}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={22} color={colors.bidGreen} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Pro Trader</Text>
            <Text style={styles.profileMeta}>
              <Text style={styles.verifiedPill}>Tier 3 Verified</Text> • ID: 882941
            </Text>
          </View>
        </View>
      </View>

      {/* Menu Options */}
      <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
        {/* ACCOUNT Section */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.menuItemText}>API Keys</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="shield-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.menuItemText}>Security</Text>
          </View>
        </TouchableOpacity>

        {/* TRADING Section */}
        <Text style={styles.sectionLabel}>TRADING</Text>
        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemActive]}
          activeOpacity={0.7}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name="time" size={20} color={colors.primary} />
            <Text style={styles.menuItemTextActive}>Trade History</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.menuItemText}>Support</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer: Sign Out (Mockup 3) */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.signOutButton} activeOpacity={0.7}>
          <Ionicons name="exit-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>PulseCrypto Mobile v1.0.0</Text>
      </View>
    </View>
  );
}
