import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  PanResponder,
  LayoutChangeEvent,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../hooks/useSettings';
import { useMarketConnection } from '../../hooks/useMarketStream';
import { colors } from '../../theme/tokens';
import { styles } from './SettingsScreen.styles';

const PRESETS = [50, 100, 250, 500, 1000];

export function SettingsScreen() {
  const {
    throttleMs,
    gatewayUrl,
    compressionEnabled,
    adaptivePollingEnabled,
    storageStats,
    setThrottle,
    setGatewayUrl,
    setCompression,
    setAdaptivePolling,
    resetDefaults,
    clearCache,
  } = useSettings();

  const { connectionStatus, reconnect } = useMarketConnection();

  const [inputUrl, setInputUrl] = useState<string>(gatewayUrl);
  const [sliderWidth, setSliderWidth] = useState<number>(300);
  const trackRef = useRef<View>(null);

  // Calculate ratio for current throttleMs in [10, 1000]
  const currentRatio = Math.max(0, Math.min(1, (throttleMs - 10) / 990));
  const thumbPosition = currentRatio * sliderWidth;

  // Use refs so PanResponder handlers always read current values
  const sliderWidthRef = useRef(sliderWidth);
  sliderWidthRef.current = sliderWidth;
  const setThrottleRef = useRef(setThrottle);
  setThrottleRef.current = setThrottle;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const w = sliderWidthRef.current;
          if (w <= 0) return;
          const x = evt.nativeEvent.locationX;
          const ratio = Math.max(0, Math.min(1, x / w));
          const rawMs = 10 + ratio * 990;
          setThrottleRef.current(Math.round(rawMs / 10) * 10);
        },
        onPanResponderMove: (evt) => {
          const w = sliderWidthRef.current;
          if (w <= 0) return;
          const x = evt.nativeEvent.locationX;
          const ratio = Math.max(0, Math.min(1, x / w));
          const rawMs = 10 + ratio * 990;
          setThrottleRef.current(Math.round(rawMs / 10) * 10);
        },
      }),
    []
  );

  const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      setSliderWidth(w);
    }
  }, []);

  const handleSaveGateway = () => {
    const trimmed = inputUrl.trim();
    if (!trimmed.startsWith('ws://') && !trimmed.startsWith('wss://')) {
      Alert.alert('Invalid URL', 'Gateway URL must start with ws:// or wss://');
      return;
    }
    setGatewayUrl(trimmed);
    reconnect();
    Alert.alert('Gateway Updated', 'Reconnecting to new gateway endpoint...');
  };

  const handleResetDefaults = () => {
    resetDefaults();
    setInputUrl(gatewayUrl);
    Alert.alert('Defaults Restored', 'All settings restored to baseline configuration.');
  };

  const handleClearCache = () => {
    clearCache();
    Alert.alert('Cache Cleared', 'MMKV storage cache and temporary buffers cleared.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>System Settings &amp; Telemetry</Text>
        <Text style={styles.screenSubtitle}>
          Real-time performance monitoring and data ingestion controls.
        </Text>
      </View>

      {/* Card 1: Network Control (Data Throttling Configurator) */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardCategory}>NETWORK CONTROL</Text>
            <Text style={styles.cardTitle}>Data Throttling Configurator</Text>
          </View>
          <Ionicons name="speedometer-outline" size={22} color={colors.textSecondary} />
        </View>

        {/* Update Frequency readout */}
        <View style={styles.frequencyRow}>
          <Text style={styles.frequencyLabel}>Update Frequency</Text>
          <Text style={styles.frequencyValue}>{throttleMs}ms</Text>
        </View>

        {/* Interactive Slider Track */}
        <View style={styles.sliderContainer}>
          <View
            ref={trackRef}
            style={styles.track}
            onLayout={handleTrackLayout}
            {...panResponder.panHandlers}
          >
            <View style={[styles.filledTrack, { width: thumbPosition }]} />
            <View style={[styles.thumb, { left: thumbPosition }]} />
          </View>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderRangeText}>10ms</Text>
            <Text style={styles.sliderRangeText}>500ms</Text>
            <Text style={styles.sliderRangeText}>1000ms</Text>
          </View>
        </View>

        {/* Preset buttons */}
        <View style={styles.presetsRow}>
          {PRESETS.map((p) => {
            const isActive = throttleMs === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.presetPill, isActive && styles.presetPillActive]}
                onPress={() => setThrottle(p)}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetText, isActive && styles.presetTextActive]}>
                  {p}ms
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.divider} />

        {/* Toggle 1: Binary Protocol Compression */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Binary Protocol Compression</Text>
          <Switch
            value={compressionEnabled}
            onValueChange={setCompression}
            trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: colors.bidGreen }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Toggle 2: Adaptive Polling Strategy */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Adaptive Polling Strategy</Text>
          <Switch
            value={adaptivePollingEnabled}
            onValueChange={setAdaptivePolling}
            trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: colors.bidGreen }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Card 2: Gateway Connection Configuration */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.cardCategory, { color: colors.accentBlue }]}>
              GATEWAY CONNECTION
            </Text>
            <Text style={styles.cardTitle}>Endpoint Configuration</Text>
          </View>
          <Ionicons name="link-outline" size={22} color={colors.accentBlue} />
        </View>

        <Text style={styles.inputLabel}>WebSocket Gateway URL</Text>
        <TextInput
          style={styles.textInput}
          value={inputUrl}
          onChangeText={setInputUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="ws://localhost:8080/ws"
          placeholderTextColor={colors.textSecondary}
        />

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Connection Status</Text>
          <Text
            style={[
              styles.statValue,
              { color: connectionStatus === 'CONNECTED' ? colors.bidGreen : colors.warningYellow },
            ]}
          >
            {connectionStatus}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveGateway}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryButtonText}>Apply URL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleResetDefaults}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Reset Defaults</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Card 3: Storage & Cache Management */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.cardCategory, { color: colors.textSecondary }]}>
              STORAGE &amp; CACHE
            </Text>
            <Text style={styles.cardTitle}>Persistence Management</Text>
          </View>
          <Ionicons name="server-outline" size={22} color={colors.textSecondary} />
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>MMKV Cache Footprint</Text>
          <Text style={styles.statValue}>{storageStats.estimatedKb} KB utilized</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Active Stored Keys</Text>
          <Text style={styles.statValue}>{storageStats.keysCount} keys</Text>
        </View>

        <TouchableOpacity
          style={styles.dangerButton}
          onPress={handleClearCache}
          activeOpacity={0.7}
        >
          <Text style={styles.dangerButtonText}>Clear Storage Cache</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
