import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '../../theme/tokens';

interface CircularFpsGaugeProps {
  uiFps: number | null;
  jsFps: number | null;
  nativeAvailable: boolean;
  size?: number;
  strokeWidth?: number;
}

/**
 * Frame-rate gauge. The ring shows the UI-thread rate from the native frame monitor (falling back
 * to the JS-thread rate where the native module is unavailable). Values are not clamped: a 120 Hz
 * display reads 120; the ring fills relative to 60.
 */
export const CircularFpsGauge = React.memo(function CircularFpsGauge({
  uiFps,
  jsFps,
  nativeAvailable,
  size = 126,
  strokeWidth = 8,
}: CircularFpsGaugeProps) {
  const primary = nativeAvailable ? uiFps : jsFps;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const ratio = primary === null ? 0 : Math.max(0, Math.min(1, primary / 60));
  const color = primary === null ? colors.textMuted : primary >= 55 ? colors.bidGreen : primary >= 40 ? colors.warningYellow : colors.askRed;

  return (
    <View style={styles.container}>
      <View style={[styles.gaugeWrapper, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={radius} stroke="rgba(255, 255, 255, 0.08)" strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - ratio)}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>
        <View style={styles.textContainer}>
          <Text style={styles.fpsValue}>{primary ?? '—'}</Text>
          <Text style={styles.fpsLabel}>FPS</Text>
        </View>
      </View>
      <Text style={styles.caption}>{nativeAvailable ? 'UI Thread Frame Rate' : 'JS Thread Frame Rate'}</Text>
      <Text style={styles.detail}>
        {nativeAvailable ? `JS thread ${jsFps ?? '—'} fps` : 'UI-thread rate unavailable in Expo Go (native module not included)'}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  gaugeWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  textContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  fpsValue: { fontFamily: typography.fontFamily.monoBold, fontSize: 32, color: colors.textPrimary, lineHeight: 38 },
  fpsLabel: { fontFamily: typography.fontFamily.regular, fontSize: 11, color: colors.textSecondary, letterSpacing: 1, marginTop: -2 },
  caption: { fontFamily: typography.fontFamily.regular, fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  detail: { fontFamily: typography.fontFamily.monoMedium, fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
});
