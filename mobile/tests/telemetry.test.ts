import { describe, it, expect } from 'vitest';
import { colors } from '../src/theme/tokens';

describe('Performance Telemetry Dashboard Logic (Phase 6: Tasks T6.2, ADR 8)', () => {
  describe('Circular FPS Gauge Health & Visual Status (Task T6.2)', () => {
    const getFpsColor = (fps: number) => {
      if (fps >= 55) return colors.bidGreen;
      if (fps >= 40) return colors.warningYellow;
      return colors.askRed;
    };

    const calculateStrokeDashoffset = (fps: number, radius: number) => {
      const circumference = 2 * Math.PI * radius;
      const progressRatio = Math.max(0, Math.min(1, fps / 60));
      return circumference * (1 - progressRatio);
    };

    it('should assign correct status colors according to FPS performance tiers', () => {
      expect(getFpsColor(60)).toBe(colors.bidGreen);
      expect(getFpsColor(58)).toBe(colors.bidGreen);
      expect(getFpsColor(55)).toBe(colors.bidGreen);
      expect(getFpsColor(54)).toBe(colors.warningYellow);
      expect(getFpsColor(40)).toBe(colors.warningYellow);
      expect(getFpsColor(39)).toBe(colors.askRed);
      expect(getFpsColor(15)).toBe(colors.askRed);
    });

    it('should calculate SVG stroke dashoffset smoothly between 0 and 60 FPS', () => {
      const radius = 60;
      const circumference = 2 * Math.PI * radius;

      // 60 FPS = 100% full circle (dashoffset = 0)
      expect(calculateStrokeDashoffset(60, radius)).toBeCloseTo(0, 5);

      // 0 FPS = 0% circle (dashoffset = circumference)
      expect(calculateStrokeDashoffset(0, radius)).toBeCloseTo(circumference, 5);

      // 30 FPS = 50% circle (dashoffset = circumference / 2)
      expect(calculateStrokeDashoffset(30, radius)).toBeCloseTo(circumference / 2, 5);

      // Clamped beyond 60
      expect(calculateStrokeDashoffset(75, radius)).toBeCloseTo(0, 5);
      // Clamped below 0
      expect(calculateStrokeDashoffset(-10, radius)).toBeCloseTo(circumference, 5);
    });
  });

  describe('Memory Sparkline Smooth Spline Interpolation (Task T6.2)', () => {
    const generateSpline = (dataPoints: number[], width: number, height: number) => {
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
        const y = height - normalized * (height - 12) - 6;
        return [x, y];
      });

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
    };

    it('should generate valid non-empty SVG path strings without NaN', () => {
      const memorySamples = [138.2, 139.1, 140.4, 139.6, 142.1, 141.5, 143.0];
      const { linePath, areaPath } = generateSpline(memorySamples, 320, 70);

      expect(linePath).toBeTruthy();
      expect(linePath.startsWith('M 0')).toBe(true);
      expect(linePath).toContain('C ');
      expect(linePath).not.toContain('NaN');

      expect(areaPath).toBeTruthy();
      expect(areaPath.endsWith('L 320 70 L 0 70 Z')).toBe(true);
      expect(areaPath).not.toContain('NaN');
    });

    it('should safely handle insufficient points or degenerate width', () => {
      expect(generateSpline([140.0], 300, 70)).toEqual({ linePath: '', areaPath: '' });
      expect(generateSpline([140.0, 141.0], 0, 70)).toEqual({ linePath: '', areaPath: '' });
    });
  });

  describe('Ingestion Rate Rolling Window Math (Task T6.2, ADR 8)', () => {
    it('should correctly tally messages arriving in 1000ms sliding window', () => {
      const now = 10000;
      const windowMs = 1000;
      // Arrived at t=8500, 9100, 9500, 9800, 9950, 10000
      const timestamps = [8500, 9100, 9500, 9800, 9950, 10000];

      // Window [9000, 10000]: 8500 should be excluded
      const windowStart = now - windowMs;
      const inWindow = timestamps.filter((t) => t >= windowStart);

      expect(inWindow.length).toBe(5);
    });
  });
});
