import { DepthTuple } from '@pulsecrypto/shared';

export interface DepthGeometry {
  bidPath: string;
  askPath: string;
  /** x of the mid price. */
  midX: number;
  priceMin: number;
  priceMax: number;
  totalBidQty: number;
  totalAskQty: number;
}

/**
 * Market depth chart geometry: x is price (deepest bid → deepest ask), y is cumulative base-asset
 * quantity. Each side is a step path from the best price outward, closed to the baseline for fill.
 * Levels must be best-first (as sent by the gateway).
 */
export function buildDepthGeometry(
  bids: DepthTuple[],
  asks: DepthTuple[],
  width: number,
  height: number,
  topPadding = 8
): DepthGeometry | null {
  if (bids.length === 0 || asks.length === 0 || width <= 0 || height <= 0) return null;

  const priceMin = bids[bids.length - 1][0];
  const priceMax = asks[asks.length - 1][0];
  const span = Math.max(priceMax - priceMin, Number.EPSILON);

  let cumBid = 0;
  const bidCum = bids.map(([p, q]) => [p, (cumBid += q)] as const);
  let cumAsk = 0;
  const askCum = asks.map(([p, q]) => [p, (cumAsk += q)] as const);
  const maxCum = Math.max(cumBid, cumAsk, Number.EPSILON);

  const x = (price: number) => round(((price - priceMin) / span) * width);
  const y = (cum: number) => round(height - (cum / maxCum) * (height - topPadding));
  const baseline = round(height);

  const side = (levels: ReadonlyArray<readonly [number, number]>) => {
    // Step outward: at each level the cumulative quantity rises, then holds until the next price.
    let d = `M ${x(levels[0][0])} ${baseline}`;
    levels.forEach(([price, cum], i) => {
      d += ` L ${x(price)} ${y(i === 0 ? 0 : levels[i - 1][1])} L ${x(price)} ${y(cum)}`;
    });
    const last = levels[levels.length - 1];
    return `${d} L ${x(last[0])} ${baseline} Z`;
  };

  const bestBid = bids[0][0];
  const bestAsk = asks[0][0];
  return {
    bidPath: side(bidCum),
    askPath: side(askCum),
    midX: x((bestBid + bestAsk) / 2),
    priceMin,
    priceMax,
    totalBidQty: cumBid,
    totalAskQty: cumAsk,
  };
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
