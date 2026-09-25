import React, { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { defaultStorage, STORAGE_KEYS } from '../../storage/storageRepository';
import { usePerfSamples } from '../telemetry/usePerfSamples';
import { colors, typography } from '../../theme/tokens';

const subscribeOverlay = (listener: () => void) => defaultStorage.subscribe(STORAGE_KEYS.PERF_OVERLAY, listener);
const getOverlay = () => defaultStorage.getPerfOverlay();

/** Whether the performance overlay is switched on (a stored preference). */
export function usePerfOverlayEnabled(): boolean {
  return useSyncExternalStore(subscribeOverlay, getOverlay);
}

/** Keeps the readout just above the bottom tab bar, clear of every screen's header. */
const TAB_BAR_CLEARANCE = 62;

const fpsColor = (fps: number | null) =>
  fps === null ? colors.textMuted : fps >= 55 ? colors.bidGreen : fps >= 30 ? colors.warningYellow : colors.askRed;

function OverlayReadout() {
  const insets = useSafeAreaInsets();
  const { uiFps, jsFps, memoryMb } = usePerfSamples(true);
  const mem = memoryMb[memoryMb.length - 1];
  const label = `UI ${uiFps ?? '—'} FPS, JS ${jsFps ?? '—'} FPS${mem !== undefined ? `, ${mem.toFixed(0)} MB` : ''}`;
  return (
    <View pointerEvents="none" style={[styles.overlay, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]} accessibilityLabel={`Performance: ${label}`}>
      <Text style={styles.text}>
        UI <Text style={{ color: fpsColor(uiFps) }}>{uiFps ?? '—'}</Text>
        {'  '}JS <Text style={{ color: fpsColor(jsFps) }}>{jsFps ?? '—'}</Text>
        {mem !== undefined ? `  ${mem.toFixed(0)} MB` : ''}
      </Text>
    </View>
  );
}

/**
 * A small floating readout of UI/JS frame rate and memory over every screen, so a screen's cost can
 * be watched while it renders (e.g. the terminal under live updates). Samples only while shown.
 */
export function PerfOverlay() {
  return usePerfOverlayEnabled() ? <OverlayReadout /> : null;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(10, 14, 20, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  text: {
    fontFamily: typography.fontFamily.monoMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
