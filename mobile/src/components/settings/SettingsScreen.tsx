import React, { useState, useCallback, useMemo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, LayoutChangeEvent, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../hooks/useSettings';
import { useAdaptiveActive, useConnection, useUpstream } from '../../data/store/hooks';
import { ADAPTIVE_METERED_CADENCE_MS } from '../../data/adaptiveCadence';
import { useStreamRuntime } from '../../data/StreamProvider';
import { describeStatus } from '../../data/connectionStatus';
import { currentGatewayConfig } from '../../config/gateway';
import { defaultStorage, STORAGE_KEYS } from '../../storage/storageRepository';
import { colors } from '../../theme/tokens';
import { STORAGE_ENGINE_LABEL } from '../../storage/engineLabel';
import { styles } from './SettingsScreen.styles';

const MAX_CADENCE_MS = 1000;
const PRESETS = [100, 250, 500, 1000];

export function SettingsScreen() {
  const settings = useSettings();
  const connection = useConnection();
  const upstream = useUpstream();
  const runtime = useStreamRuntime();
  const adaptiveActive = useAdaptiveActive();
  const status = describeStatus(connection.state, upstream);

  // The gateway advertises its tick (the fastest cadence) in `hello`; 100 ms until known.
  const minMs = connection.minCadenceMs ?? 100;
  const step = minMs;
  const preferredMs = settings.cadenceMs ?? minMs;
  const effectiveMs = connection.cadenceMs ?? connection.tickMs;

  const msToRatio = useCallback((ms: number) => Math.max(0, Math.min(1, (ms - minMs) / (MAX_CADENCE_MS - minMs))), [minMs]);
  const ratioToMs = useCallback(
    (ratio: number) => Math.round((minMs + ratio * (MAX_CADENCE_MS - minMs)) / step) * step,
    [minMs, step]
  );

  const [sliderWidth, setSliderWidth] = useState(0);
  const [dragMs, setDragMs] = useState<number | null>(null);
  const displayMs = dragMs ?? preferredMs;
  const thumbPosition = sliderWidth > 0 ? msToRatio(displayMs) * sliderWidth : 0;

  // Slider drag: previews while dragging, commits one cadence request on release.
  const { setCadence } = settings;
  const pan = useMemo(() => {
    const toMs = (x: number) => ratioToMs(Math.max(0, Math.min(1, sliderWidth > 0 ? x / sliderWidth : 0)));
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => setDragMs(toMs(e.x)))
      .onUpdate((e) => setDragMs(toMs(e.x)))
      .onEnd((e) => {
        const ms = toMs(e.x);
        setCadence(ms <= minMs ? null : ms);
      })
      .onFinalize(() => setDragMs(null));
  }, [sliderWidth, ratioToMs, minMs, setCadence]);

  const handleTrackLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setSliderWidth(w);
  }, []);

  const [inputUrl, setInputUrl] = useState(() => settings.gatewayOverride ?? currentGatewayConfig().wsUrl);

  const applyGateway = () => {
    const trimmed = inputUrl.trim();
    if (!/^wss?:\/\//.test(trimmed)) {
      Alert.alert('Invalid URL', 'Gateway URL must start with ws:// or wss://');
      return;
    }
    settings.setGatewayOverride(trimmed);
  };

  const useDefaultGateway = () => {
    settings.setGatewayOverride(null);
    setInputUrl(currentGatewayConfig().wsUrl);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} scrollEnabled={dragMs === null}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>System Settings &amp; Telemetry</Text>
        <Text style={styles.screenSubtitle}>Stream cadence, connection and on-device data.</Text>
      </View>

      {/* Stream cadence */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardCategory}>NETWORK CONTROL</Text>
            <Text style={styles.cardTitle}>Data Throttling Configurator</Text>
          </View>
          <Ionicons name="speedometer-outline" size={22} color={colors.textSecondary} />
        </View>

        <View style={styles.frequencyRow}>
          <Text style={styles.frequencyLabel}>Update Frequency</Text>
          <Text style={styles.frequencyValue}>{displayMs}ms</Text>
        </View>

        <View style={styles.sliderContainer}>
          <GestureDetector gesture={pan}>
          <View
            style={styles.sliderHitArea}
            accessibilityRole="adjustable"
            accessibilityLabel="Update frequency"
            accessibilityValue={{ min: minMs, max: MAX_CADENCE_MS, now: displayMs, text: `${displayMs} milliseconds` }}
          >
            <View style={styles.track} onLayout={handleTrackLayout} pointerEvents="none">
              <View style={[styles.filledTrack, { width: thumbPosition }]} />
              <View style={[styles.thumb, { left: thumbPosition }]} />
            </View>
          </View>
          </GestureDetector>
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderRangeText}>{minMs}ms</Text>
            <Text style={styles.sliderRangeText}>{Math.round((minMs + MAX_CADENCE_MS) / 2 / step) * step}ms</Text>
            <Text style={styles.sliderRangeText}>{MAX_CADENCE_MS}ms</Text>
          </View>
        </View>

        <View style={styles.presetsRow}>
          {PRESETS.filter((p) => p >= minMs).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.presetPill, displayMs === p && styles.presetPillActive]}
              onPress={() => settings.setCadence(p <= minMs ? null : p)}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetText, displayMs === p && styles.presetTextActive]}>{p}ms</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Applied by gateway</Text>
          <Text style={styles.statValue}>{effectiveMs ? `${effectiveMs}ms` : '—'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextColumn}>
            <Text style={styles.toggleLabel}>Adaptive Polling Strategy</Text>
            <Text style={styles.toggleHint}>
              {adaptiveActive
                ? `Active: metered connection, updates slowed to ${ADAPTIVE_METERED_CADENCE_MS}ms`
                : `Slows updates to ${ADAPTIVE_METERED_CADENCE_MS}ms on cellular or metered connections`}
            </Text>
          </View>
          <Switch
            value={settings.adaptivePollingEnabled}
            onValueChange={settings.setAdaptivePolling}
            trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: colors.bidGreen }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Adaptive polling strategy"
          />
        </View>
      </View>

      {/* Connection */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.cardCategory, { color: colors.accentBlue }]}>GATEWAY CONNECTION</Text>
            <Text style={styles.cardTitle}>Endpoint</Text>
          </View>
          <Ionicons name="link-outline" size={22} color={colors.accentBlue} />
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Status</Text>
          <Text style={[styles.statValue, { color: status.tone === 'live' ? colors.bidGreen : colors.warningYellow }]}>
            {status.label}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Round trip</Text>
          <Text style={styles.statValue}>{connection.rttMs !== null ? `${connection.rttMs}ms` : '—'}</Text>
        </View>

        {__DEV__ ? (
          <>
            <Text style={styles.inputLabel}>WebSocket Gateway URL (development builds only)</Text>
            <TextInput
              style={styles.textInput}
              value={inputUrl}
              onChangeText={setInputUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="ws://localhost:8080/ws"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={applyGateway} activeOpacity={0.7}>
                <Text style={styles.primaryButtonText}>Apply URL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={useDefaultGateway} activeOpacity={0.7}>
                <Text style={styles.secondaryButtonText}>Use Default</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        <TouchableOpacity style={styles.secondaryButton} onPress={() => runtime.client.reconnectNow()} activeOpacity={0.7}>
          <Text style={styles.secondaryButtonText}>Reconnect Now</Text>
        </TouchableOpacity>
      </View>

      {/* Storage */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.cardCategory, { color: colors.textSecondary }]}>STORAGE &amp; CACHE</Text>
            <Text style={styles.cardTitle}>On-device Data</Text>
          </View>
          <Ionicons name="server-outline" size={22} color={colors.textSecondary} />
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Storage</Text>
          <Text style={styles.statValue}>
            {STORAGE_ENGINE_LABEL[settings.storageStats.engine]}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Stored keys / size</Text>
          <Text style={styles.statValue}>
            {settings.storageStats.keysCount} keys · {(settings.storageStats.estimatedBytes / 1024).toFixed(1)} KB
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => defaultStorage.delete(STORAGE_KEYS.MARKET_SNAPSHOT)}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Clear Cached Prices</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={settings.resetDefaults} activeOpacity={0.7}>
            <Text style={styles.dangerButtonText}>Reset Preferences</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
