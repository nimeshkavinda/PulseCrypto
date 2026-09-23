import { SupportedPairSymbol, SUPPORTED_PAIRS, Book, DepthTuple } from '@pulsecrypto/shared';

/** Order book levels retained and published per side (Binance partial depth stream). */
export const BOOK_DEPTH = 20;

interface RawDepthLevel {
  price: number;
  quantity: number;
}

interface OrderBookState {
  bids: RawDepthLevel[];
  asks: RawDepthLevel[];
  /** Monotonic per-pair version. 0 means no upstream depth has been received yet. */
  version: number;
  updatedAt: number;
  eventTs: number | null;
}

export interface VersionedBook {
  version: number;
  book: Book;
}

/**
 * Holds the latest top-of-book depth snapshot per pair and derives analytics on read.
 * Writes are O(levels) and happen at upstream cadence; derivation happens at most once
 * per version (memoised), independent of the number of connected clients.
 */
export class OrderBookManager {
  private books = new Map<SupportedPairSymbol, OrderBookState>();
  private derived = new Map<SupportedPairSymbol, VersionedBook>();

  constructor() {
    for (const symbol of Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[]) {
      this.books.set(symbol, { bids: [], asks: [], version: 0, updatedAt: 0, eventTs: null });
    }
  }

  /**
   * Ingest a partial depth snapshot. Levels with non-positive price or zero quantity are dropped,
   * bids are sorted descending and asks ascending, and each side is capped at BOOK_DEPTH.
   */
  public updateDepth(
    symbol: SupportedPairSymbol,
    rawBids: [number, number][],
    rawAsks: [number, number][],
    eventTs: number | null = null,
    now: number = Date.now()
  ): void {
    const book = this.books.get(symbol);
    if (!book) return;

    book.bids = normaliseSide(rawBids, (a, b) => b[0] - a[0]);
    book.asks = normaliseSide(rawAsks, (a, b) => a[0] - b[0]);
    book.updatedAt = now;
    book.eventTs = eventTs;
    book.version += 1;
  }

  /** Gateway receive time of the latest depth update (0 if none yet). */
  public getUpdatedAt(symbol: SupportedPairSymbol): number {
    return this.books.get(symbol)?.updatedAt ?? 0;
  }

  public getVersion(symbol: SupportedPairSymbol): number {
    return this.books.get(symbol)?.version ?? 0;
  }

  /** Returns the derived book for a pair, or null if no upstream depth has arrived yet. */
  public getBook(symbol: SupportedPairSymbol): VersionedBook | null {
    const state = this.books.get(symbol);
    if (!state || state.version === 0) return null;

    const cached = this.derived.get(symbol);
    if (cached && cached.version === state.version) return cached;

    const result: VersionedBook = { version: state.version, book: deriveBook(symbol, state) };
    this.derived.set(symbol, result);
    return result;
  }
}

function normaliseSide(
  raw: [number, number][],
  compare: (a: [number, number], b: [number, number]) => number
): RawDepthLevel[] {
  return raw
    .filter(([price, qty]) => price > 0 && qty > 0)
    .sort(compare)
    .slice(0, BOOK_DEPTH)
    .map(([price, quantity]) => ({ price, quantity }));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function deriveBook(symbol: SupportedPairSymbol, state: OrderBookState): Book {
  const { priceDecimals } = SUPPORTED_PAIRS[symbol];

  const toTuple = (l: RawDepthLevel): DepthTuple => [l.price, l.quantity, round(l.price * l.quantity, 2)];
  const bids = state.bids.map(toTuple);
  const asks = state.asks.map(toTuple);

  const bestBid = state.bids[0]?.price;
  const bestAsk = state.asks[0]?.price;
  const spread = bestBid !== undefined && bestAsk !== undefined ? Math.max(round(bestAsk - bestBid, priceDecimals), 0) : 0;
  const spreadPct = bestBid ? round((spread / bestBid) * 100, 6) : 0;

  // Pressure: share of base-asset quantity resting on each side across all published levels.
  let bidQty = 0;
  for (const l of state.bids) bidQty += l.quantity;
  let askQty = 0;
  for (const l of state.asks) askQty += l.quantity;
  const total = bidQty + askQty;
  const buyPressure = total > 0 ? round((bidQty / total) * 100, 2) : 50;

  return {
    pair: symbol,
    updatedAt: state.updatedAt,
    eventTs: state.eventTs,
    spread,
    spreadPct,
    buyPressure,
    sellPressure: round(100 - buyPressure, 2),
    bids,
    asks,
  };
}
