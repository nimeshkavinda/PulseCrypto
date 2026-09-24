import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, typography } from '../../theme/tokens';

const HEIGHT = 52;
const LINE = '#FF6B8B';

interface MemorySparklineProps {
  samplesMb: number[];
  nativeAvailable: boolean;
}

/** Process memory footprint over the last ~30 s, from the native perf-monitor module. */
export const MemorySparkline = React.memo(function MemorySparkline({ samplesMb, nativeAvailable }: MemorySparklineProps) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0) setWidth((prev) => (prev === w ? prev : w));
  }, []);

  const paths = useMemo(() => {
    if (samplesMb.length < 2 || width <= 0) return null;
    const min = Math.min(...samplesMb) - 1;
    const max = Math.max(...samplesMb) + 1;
    const step = width / (samplesMb.length - 1);
    const pts = samplesMb.map((v, i) => [i * step, HEIGHT - ((v - min) / (max - min)) * (HEIGHT - 12) - 6]);
    const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    return { line, area: `${line} L ${width} ${HEIGHT} L 0 ${HEIGHT} Z` };
  }, [samplesMb, width]);

  const current = samplesMb[samplesMb.length - 1];

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Memory Footprint Tracker</Text>
        <Text style={styles.memoryValue}>{current !== undefined ? `${current.toFixed(1)} MB` : '—'}</Text>
      </View>
      {nativeAvailable ? (
        <View style={styles.chartWrapper}>
          {paths ? (
            <Svg width={width} height={HEIGHT}>
              <Defs>
                <LinearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={LINE} stopOpacity="0.28" />
                  <Stop offset="100%" stopColor={LINE} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Path d={paths.area} fill="url(#memGradient)" />
              <Path d={paths.line} stroke={LINE} strokeWidth={2} fill="none" strokeLinecap="round" />
            </Svg>
          ) : (
            <Text style={styles.note}>Collecting samples…</Text>
          )}
        </View>
      ) : (
        <Text style={styles.note}>Unavailable in Expo Go: the native perf-monitor module is only included in development and release builds.</Text>
      )}
      {nativeAvailable && __DEV__ ? (
        <Text style={[styles.note, styles.devNote]}>
          Development build: React Native&apos;s debug-only instrumentation keeps a record of every UI node created, so this figure climbs under
          sustained updates. Judge memory on a release build.
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: '100%', paddingTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontFamily: typography.fontFamily.regular, fontSize: 13, color: colors.textSecondary },
  memoryValue: { fontFamily: typography.fontFamily.monoMedium, fontSize: 13, color: LINE },
  chartWrapper: { width: '100%', height: HEIGHT, overflow: 'hidden', justifyContent: 'center' },
  note: { fontFamily: typography.fontFamily.regular, fontSize: 12, color: colors.textMuted },
  devNote: { marginTop: 8 },
});
