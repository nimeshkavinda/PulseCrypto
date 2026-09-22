import React from 'react';
import { View, Text } from 'react-native';
import { styles } from './TerminalScreen.styles';

export function TerminalScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PHASE 5 TERMINAL</Text>
        </View>
        <Text style={styles.title}>Pro Market Terminal</Text>
        <Text style={styles.subtitle}>
          Live 20-level order book, dual-mountain SVG depth chart, and real-time Reanimated price ticks.
        </Text>
      </View>
    </View>
  );
}
