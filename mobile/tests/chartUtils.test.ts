import { buildSplineSegments } from '../src/utils/chartUtils';

describe('buildSplineSegments', () => {
  it('builds cubic Bézier fill and stroke paths through the points', () => {
    const { fill, stroke } = buildSplineSegments([
      [0, 120],
      [90, 80],
      [180, 140],
    ]);
    expect(fill.startsWith('L 0.0 120.0')).toBe(true);
    expect(stroke.startsWith('M 0.0 120.0')).toBe(true);
    expect(stroke.match(/ C /g)).toHaveLength(2);
    expect(stroke.endsWith('180.0 140.0')).toBe(true);
  });

  it('handles empty and single-point input', () => {
    expect(buildSplineSegments([])).toEqual({ fill: '', stroke: '' });
    expect(buildSplineSegments([[50, 100]])).toEqual({ fill: 'L 50.0 100.0', stroke: 'M 50.0 100.0' });
  });
});
