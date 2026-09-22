import React from 'react';
import { View, Text } from 'react-native';
import { styles } from './SettingsScreen.styles';

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
