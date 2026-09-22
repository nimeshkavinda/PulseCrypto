import React from 'react';
import { View, Text } from 'react-native';
import { styles } from './TelemetryScreen.styles';

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
