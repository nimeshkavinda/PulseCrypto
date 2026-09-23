import { DepthTuple } from '@pulsecrypto/shared';
import { buildDepthGeometry } from '../src/utils/depthChart';

const bids: DepthTuple[] = [
  [100, 1, 100],
  [99, 2, 198],
  [98, 1, 98],
];
const asks: DepthTuple[] = [
  [101, 1, 101],
  [102, 3, 306],
];

/** Parses "M x y L x y ..." into points (skipping the Z). */
const points = (d: string) =>
  d
    .replace(/[MLZ]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(Number)
    .reduce<number[][]>((acc, v, i) => (i % 2 === 0 ? [...acc, [v]] : (acc[acc.length - 1].push(v), acc)), []);

describe('buildDepthGeometry', () => {
  it('returns null without data or width', () => {
    expect(buildDepthGeometry([], asks, 300, 100)).toBeNull();
    expect(buildDepthGeometry(bids, asks, 0, 100)).toBeNull();
  });

  it('maps price to x (deepest bid → deepest ask) and places the mid price', () => {
    const g = buildDepthGeometry(bids, asks, 400, 100)!;
    expect(g.priceMin).toBe(98);
    expect(g.priceMax).toBe(102);
    expect(g.midX).toBe(250); // mid 100.5 → (100.5 - 98) / 4 * 400
    expect(g.totalBidQty).toBe(4);
    expect(g.totalAskQty).toBe(4);
  });

  it('draws bids as a step path from the best bid leftwards with rising cumulative quantity', () => {
    const g = buildDepthGeometry(bids, asks, 400, 100, 0)!;
    const pts = points(g.bidPath);
    expect(pts[0]).toEqual([200, 100]); // best bid, baseline
    const xs = pts.map(([x]) => x);
    expect(Math.min(...xs)).toBe(0); // reaches the deepest bid at the left edge
    const lastStepY = pts[pts.length - 2][1];
    expect(lastStepY).toBe(0); // full cumulative (4 = max) reaches the top
    // y never goes back down (cumulative is monotonic) along the path excluding the final baseline drop
    const ys = pts.slice(0, -1).map(([, y]) => y);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThanOrEqual(ys[i - 1]);
  });

  it('draws asks from the best ask rightwards to the deepest ask at the right edge', () => {
    const g = buildDepthGeometry(bids, asks, 400, 100, 0)!;
    const xs = points(g.askPath).map(([x]) => x);
    expect(xs[0]).toBe(300);
    expect(Math.max(...xs)).toBe(400);
  });
});
