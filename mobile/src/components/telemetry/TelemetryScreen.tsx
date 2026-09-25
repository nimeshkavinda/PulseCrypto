import React, { useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useSettings } from '../../hooks/useSettings';
import { SUPPORTED_PAIRS } from '@pulsecrypto/shared';
import { useActivePair, useConnection, useUpstream } from '../../data/store/hooks';
import { useStreamStats } from '../../data/useStreamStats';
import { useChannels } from '../../data/useChannels';
import { ScreenActivity } from '../../data/screenActivity';
import { describeStatus } from '../../data/connectionStatus';
import { currentGatewayConfig } from '../../config/gateway';
import { CircularFpsGauge } from './CircularFpsGauge';
import { MemorySparkline } from './MemorySparkline';
import { usePerfSamples } from './usePerfSamples';
import { usePerfOverlayEnabled } from '../common/PerfOverlay';
import { defaultStorage } from '../../storage/storageRepository';
import { colors } from '../../theme/tokens';
import { STORAGE_ENGINE_LABEL } from '../../storage/engineLabel';
import { styles } from './TelemetryScreen.styles';

/** Hidden tabs stay mounted; this one reads market data paused while hidden (see ScreenActivity). */
export function TelemetryScreen() {
  return (
    <ScreenActivity value={useIsFocused()}>
      <TelemetryScreenContent />
    </ScreenActivity>
  );
}

function TelemetryScreenContent() {
  const isFocused = useIsFocused();
  const pair = useActivePair();
  // Subscriptions are per screen, so without this nothing would stream while this tab is open.
  // Measure the same live stream the terminal consumes: tickers plus the active pair's book.
  useChannels(['tickers', `book:${pair}`], isFocused);
  const { rates, reset } = useStreamStats(isFocused);
  const perf = usePerfSamples(isFocused);
  const overlayEnabled = usePerfOverlayEnabled();
  const connection = useConnection();
  const status = describeStatus(connection.state, useUpstream());
  const { storageStats } = useSettings();
  const ingestionRate = rates.framesPerSec;
  const latencyMs = connection.rttMs;
  const gatewayHost = currentGatewayConfig().wsUrl.replace(/^wss?:\/\//, '').split(/[:/]/)[0] || 'gateway';

  const handleReset = useCallback(() => reset(), [reset]);

  const isHealthy = status.tone === 'live';
  const isHermes = (() => {
    try {
      const g = global as unknown as { HermesInternal?: unknown };
      return typeof g?.HermesInternal !== 'undefined' && g?.HermesInternal !== null;
    } catch {
      return false;
    }
  })();

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
                {isHealthy ? 'HEALTHY' : status.label}
              </Text>
            </View>
          </View>
        </View>

        {/* 1. Frame rate gauge (UI thread, with the JS thread beneath) */}
        <View style={styles.metricBox}>
          <CircularFpsGauge uiFps={perf.uiFps} jsFps={perf.jsFps} nativeAvailable={perf.nativeAvailable} />
          {/* This tab measures itself; the overlay shows the same readings over any screen, e.g. the terminal. */}
          <View style={styles.overlayRow}>
            <View style={styles.overlayTextColumn}>
              <Text style={styles.overlayTitle}>Show on every screen</Text>
              <Text style={styles.overlayHint}>A floating FPS and memory readout, to watch the terminal while it renders</Text>
            </View>
            <Switch
              value={overlayEnabled}
              onValueChange={(v) => defaultStorage.setPerfOverlay(v)}
              trackColor={{ false: colors.border, true: colors.bidGreen }}
              accessibilityLabel="Show performance overlay on every screen"
            />
          </View>
        </View>

        {/* 2. WS Message Ingestion Rate */}
        <View style={styles.metricBox}>
          <View style={styles.ingestionIconBox}>
            <Ionicons name="layers" size={20} color={colors.askRed} />
          </View>
          <Text style={styles.ingestionValue}>{ingestionRate}</Text>
          <Text style={styles.ingestionUnit}>frames/sec</Text>
          <Text style={styles.ingestionCaption}>WS Message Ingestion Rate</Text>
          <Text style={styles.ingestionDetail}>
            {rates.messagesPerSec} msgs/s · {rates.kbPerSec} KB/s · tickers + {SUPPORTED_PAIRS[pair].displayName} book
          </Text>
        </View>

        {/* 3. Memory Footprint Tracker Sparkline */}
        <View style={styles.metricBox}>
          <MemorySparkline samplesMb={perf.memoryMb} nativeAvailable={perf.nativeAvailable} />
        </View>
      </View>

      {/* Info Card: GPU / Hermes Acceleration */}
      <View style={styles.infoCard}>
        <View
          style={[
            styles.infoIconBox,
            { backgroundColor: isHermes ? 'rgba(0, 197, 122, 0.12)' : 'rgba(255, 255, 255, 0.08)' },
          ]}
        >
          <Ionicons
            name="flash"
            size={20}
            color={isHermes ? colors.bidGreen : colors.textSecondary}
          />
        </View>
        <View>
          <Text
            style={[
              styles.infoCategory,
              { color: isHermes ? colors.bidGreen : colors.textSecondary },
            ]}
          >
            JS ENGINE
          </Text>
          <Text style={styles.infoTitle}>
            {isHermes ? 'Hermes (bytecode, JSI)' : 'Non-Hermes JS runtime'}
          </Text>
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
            Round trip: {latencyMs !== null ? `${latencyMs}ms` : '—'} ({gatewayHost})
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
            {`${STORAGE_ENGINE_LABEL[storageStats.engine]}: ${(storageStats.estimatedBytes / 1024).toFixed(1)} KB, ${storageStats.keysCount} keys`}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
