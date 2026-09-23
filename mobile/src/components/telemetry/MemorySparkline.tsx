import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, typography } from '../../theme/tokens';

function readHermesAllocatedMb(): number | null {
  try {
    const hermes = (global as unknown as { HermesInternal?: { getAllocatedBytes?: () => number } })?.HermesInternal;
    const bytes = hermes?.getAllocatedBytes?.();
    if (typeof bytes === 'number' && !isNaN(bytes) && bytes > 0) {
      return Number((bytes / (1024 * 1024)).toFixed(1));
    }
  } catch {
    // HermesInternal not present or API unavailable
  }
  return null;
}

export const MemorySparkline = React.memo(function MemorySparkline() {
  const [width, setWidth] = useState<number>(300);
  const initialMb = readHermesAllocatedMb();
  const [isSimulated, setIsSimulated] = useState<boolean>(initialMb === null);
  const [dataPoints, setDataPoints] = useState<number[]>(() => {
    if (initialMb !== null) {
      return [initialMb];
    }
    // Baseline simulated values when HermesInternal is unavailable
    return [138.2, 139.1, 137.8, 140.4, 139.6, 141.2, 140.8, 142.1, 141.5, 143.0, 142.4];
  });

  // Track memory updates every 2 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const realMb = readHermesAllocatedMb();
      if (realMb !== null) {
        setIsSimulated(false);
        setDataPoints((prev) => [...prev.slice(-19), realMb]);
      } else {
        // Hermes does not expose a standard JS heap allocation API unless specific
        // profiling flags are enabled at engine compile time. When
        // HermesInternal.getAllocatedBytes() is unavailable, the card displays a
        // "SIMULATED" badge so estimates are never presented as measurements.
        // In a production app, native heap metrics would be sampled via a native
        // performance monitoring module (e.g. react-native-performance).
        setIsSimulated(true);
        setDataPoints((prev) => {
          const last = prev[prev.length - 1] ?? 142.4;
          const delta = (Math.random() - 0.48) * 1.8;
          const next = Math.max(132, Math.min(158, Number((last + delta).toFixed(1))));
          return [...prev.slice(-19), next];
        });
      }
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 5) {
      setWidth(w);
    }
  };

  const currentMb = dataPoints[dataPoints.length - 1] ?? 142.4;
  const height = 52;

  // Generate smooth SVG spline and filled area
  const { linePath, areaPath } = useMemo(() => {
    if (dataPoints.length < 2 || width <= 0) {
      return { linePath: '', areaPath: '' };
    }

    const min = Math.min(...dataPoints) - 2;
    const max = Math.max(...dataPoints) + 2;
    const range = Math.max(1, max - min);

    const stepX = width / (dataPoints.length - 1);
    const points: [number, number][] = dataPoints.map((val, idx) => {
      const x = idx * stepX;
      const normalized = (val - min) / range;
      // Invert Y: 0 is top, height is bottom
      const y = height - normalized * (height - 12) - 6;
      return [x, y];
    });

    // Build smooth bezier spline
    let path = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }

    const filledArea = `${path} L ${width} ${height} L 0 ${height} Z`;

    return { linePath: path, areaPath: filledArea };
  }, [dataPoints, width, height]);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Memory Footprint Tracker</Text>
          {isSimulated && (
            <View style={styles.simulatedBadge}>
              <Text style={styles.simulatedBadgeText}>SIMULATED</Text>
            </View>
          )}
        </View>
        <Text style={styles.memoryValue}>{currentMb.toFixed(1)} MB</Text>
      </View>
      <View style={styles.chartWrapper}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FF6B8B" stopOpacity="0.28" />
              <Stop offset="100%" stopColor="#FF6B8B" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>
          {areaPath ? <Path d={areaPath} fill="url(#memGradient)" /> : null}
          {linePath ? (
            <Path
              d={linePath}
              stroke="#FF6B8B"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}
        </Svg>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  simulatedBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 180, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 180, 0, 0.35)',
  },
  simulatedBadgeText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#FFB400',
    letterSpacing: 0.5,
  },
  memoryValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    color: '#FF6B8B',
  },
  chartWrapper: {
    width: '100%',
    height: 52,
    overflow: 'hidden',
  },
});
