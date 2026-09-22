import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMarketConnection } from '../../hooks/useMarketStream';
import { useSettings } from '../../hooks/useSettings';
import { CircularFpsGauge } from './CircularFpsGauge';
import { MemorySparkline } from './MemorySparkline';
import { colors } from '../../theme/tokens';
import { styles } from './TelemetryScreen.styles';

export function TelemetryScreen() {
  const { ingestionRate, latencyMs, resetMetrics, connectionStatus } = useMarketConnection();
  const { storageStats, gatewayUrl } = useSettings();

  // Extract the host portion from the gateway URL for display (e.g. "192.168.1.6")
  const gatewayHost = (() => {
    try {
      const cleaned = gatewayUrl.replace(/^wss?:\/\//, '');
      const host = cleaned.split(/[:/]/)[0];
      return host || 'Local Gateway';
    } catch {
      return 'Local Gateway';
    }
  })();

  const handleReset = useCallback(() => {
    resetMetrics();
  }, [resetMetrics]);

  const isHealthy = connectionStatus === 'CONNECTED';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Performance Telemetry</Text>
        <Text style={styles.screenSubtitle}>
          Real-time performance monitoring and data ingestion controls.
        </Text>
      </View>

      {/* Main Performance Dashboard Card */}
      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardCategory}>SYSTEM TELEMETRY</Text>
            <Text style={styles.cardTitle}>Performance Dashboard</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
              activeOpacity={0.7}
              accessibilityLabel="Reset telemetry counters"
            >
              <Text style={styles.resetText}>RESET</Text>
            </TouchableOpacity>
            <View
              style={[
                styles.statusBadge,
                !isHealthy && {
                  backgroundColor: 'rgba(255, 59, 105, 0.15)',
                  borderColor: 'rgba(255, 59, 105, 0.3)',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  !isHealthy && { color: colors.askRed },
                ]}
              >
                {isHealthy ? 'HEALTHY' : 'CONNECTING'}
              </Text>
            </View>
          </View>
        </View>

        {/* 1. Circular JS Thread FPS Gauge */}
        <View style={styles.metricBox}>
          <CircularFpsGauge />
        </View>

        {/* 2. WS Message Ingestion Rate */}
        <View style={styles.metricBox}>
          <View style={styles.ingestionIconBox}>
            <Ionicons name="layers" size={20} color={colors.askRed} />
          </View>
          <Text style={styles.ingestionValue}>{ingestionRate}</Text>
          <Text style={styles.ingestionUnit}>msgs/sec</Text>
          <Text style={styles.ingestionCaption}>WS Message Ingestion Rate</Text>
        </View>

        {/* 3. Memory Footprint Tracker Sparkline */}
        <View style={styles.metricBox}>
          <MemorySparkline />
        </View>
      </View>

      {/* Info Card: GPU / Hermes Acceleration */}
      <View style={styles.infoCard}>
        <View style={[styles.infoIconBox, { backgroundColor: 'rgba(0, 197, 122, 0.12)' }]}>
          <Ionicons name="flash" size={20} color={colors.bidGreen} />
        </View>
        <View>
          <Text style={[styles.infoCategory, { color: colors.bidGreen }]}>GPU ACCELERATION</Text>
          <Text style={styles.infoTitle}>Hermes / JSI Engine: Active</Text>
        </View>
      </View>

      {/* Info Card: API Latency */}
      <View style={styles.infoCard}>
        <View style={[styles.infoIconBox, { backgroundColor: 'rgba(255, 107, 139, 0.12)' }]}>
          <Ionicons name="shield-checkmark" size={20} color="#FF6B8B" />
        </View>
        <View>
          <Text style={[styles.infoCategory, { color: '#FF6B8B' }]}>API LATENCY</Text>
          <Text style={styles.infoTitle}>
            Avg Ping: {latencyMs > 0 ? `${latencyMs}ms` : '<1ms'} ({gatewayHost})
          </Text>
        </View>
      </View>

      {/* Info Card: Storage Cache */}
      <View style={styles.infoCard}>
        <View style={[styles.infoIconBox, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <Ionicons name="server" size={20} color={colors.textSecondary} />
        </View>
        <View>
          <Text style={[styles.infoCategory, { color: colors.textSecondary }]}>STORAGE CACHE</Text>
          <Text style={styles.infoTitle}>
            MMKV Cache: {storageStats.estimatedKb} KB utilized
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
