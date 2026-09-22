/**
 * Pure SVG curve spline utilities for market depth and area charts.
 * Independent of React Native runtime for clean unit testing and fast execution.
 */

export interface SplineResult {
  fill: string;
  stroke: string;
}

/**
 * Generates smooth SVG cubic Bezier curve commands through a series of (x, y) coordinates.
 * Converts discrete order book levels into an organic wave, returning separate fill and top-contour stroke paths.
 */
export function buildSplineSegments(points: [number, number][]): SplineResult {
  if (points.length === 0) return { fill: '', stroke: '' };
  if (points.length === 1) {
    const pt = `${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    return { fill: `L ${pt}`, stroke: `M ${pt}` };
  }

  let stroke = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  let curve = '';

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Catmull-Rom to Cubic Bezier conversion with smooth tension
    const cp1x = Number((p1[0] + (p2[0] - p0[0]) / 6).toFixed(1));
    const cp1y = Number((p1[1] + (p2[1] - p0[1]) / 6).toFixed(1));
    const cp2x = Number((p2[0] - (p3[0] - p1[0]) / 6).toFixed(1));
    const cp2y = Number((p2[1] - (p3[1] - p1[1]) / 6).toFixed(1));

    const seg = ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    stroke += seg;
    curve += seg;
  }

  const fill = `L ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}${curve}`;
  return { fill, stroke };
}
