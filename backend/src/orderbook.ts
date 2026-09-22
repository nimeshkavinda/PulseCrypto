import {
  SupportedPairSymbol,
  SUPPORTED_PAIRS,
  MarketUpdatePayload,
  MarketUpdatePayloadSchema,
  DepthTuple,
} from '@pulsecrypto/shared';
import { MetadataService, defaultMetadataService } from './metadata.js';

interface RawDepthLevel {
  price: number;
  quantity: number;
}

interface OrderBookState {
  symbol: SupportedPairSymbol;
  bids: RawDepthLevel[];
  asks: RawDepthLevel[];
  lastUpdateTimestamp: number;
  lastTradePrice?: number;
}

export class OrderBookManager {
  private books: Map<SupportedPairSymbol, OrderBookState> = new Map();
  private metadataService: MetadataService;

  constructor(metadataService: MetadataService = defaultMetadataService) {
    this.metadataService = metadataService;
    this.initializeBooks();
  }

  private initializeBooks(): void {
    const symbols = Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[];
    const now = Date.now();

    for (const symbol of symbols) {
      const meta = this.metadataService.get(symbol);
      const lastPrice = meta?.lastPrice ?? 100.0;
      const spreadStep = lastPrice * 0.0001;

      // Seed initial 5 synthetic levels so cold start has non-empty books
      const initialBids: RawDepthLevel[] = Array.from({ length: 5 }, (_, i) => ({
        price: Number((lastPrice - (i + 1) * spreadStep).toFixed(meta?.priceDecimals ?? 2)),
        quantity: Number((1.5 + i * 0.2).toFixed(meta?.qtyDecimals ?? 4)),
      }));

      const initialAsks: RawDepthLevel[] = Array.from({ length: 5 }, (_, i) => ({
        price: Number((lastPrice + (i + 1) * spreadStep).toFixed(meta?.priceDecimals ?? 2)),
        quantity: Number((1.2 + i * 0.2).toFixed(meta?.qtyDecimals ?? 4)),
      }));

      this.books.set(symbol, {
        symbol,
        bids: initialBids,
        asks: initialAsks,
        lastUpdateTimestamp: now,
      });
    }
  }

  /**
   * Ingest raw depth20 snapshot from Binance stream
   */
  public updateDepth(
    symbol: SupportedPairSymbol,
    rawBids: [number, number][],
    rawAsks: [number, number][]
  ): void {
    const book = this.books.get(symbol);
    if (!book) return;

    // Filter out zero quantities, sort bids descending, asks ascending, limit to 20
    const bids: RawDepthLevel[] = rawBids
      .filter(([price, qty]) => price > 0 && qty > 0)
      .sort((a, b) => b[0] - a[0])
      .slice(0, 20)
      .map(([price, quantity]) => ({ price, quantity }));

    const asks: RawDepthLevel[] = rawAsks
      .filter(([price, qty]) => price > 0 && qty > 0)
      .sort((a, b) => a[0] - b[0])
      .slice(0, 20)
      .map(([price, quantity]) => ({ price, quantity }));

    book.bids = bids;
    book.asks = asks;
    book.lastUpdateTimestamp = Date.now();
  }

  /**
   * Ingest real-time trade price from Binance @trade stream
   */
  public updateLastTrade(symbol: SupportedPairSymbol, price: number): void {
    const book = this.books.get(symbol);
    if (!book || !Number.isFinite(price) || price <= 0) return;
    book.lastTradePrice = price;
  }

  /**
   * Build full conflated MarketUpdatePayload with derived analytics
   */
  public getSnapshot(symbol: SupportedPairSymbol): MarketUpdatePayload {
    const book = this.books.get(symbol);
    const meta = this.metadataService.get(symbol);

    const now = Date.now();
    const lastPrice = book?.lastTradePrice ?? meta?.lastPrice ?? 100.0;
    const high24h = meta?.high24h ?? lastPrice * 1.05;
    const low24h = meta?.low24h ?? lastPrice * 0.95;
    const volume24h = meta?.volume24h ?? 1000.0;
    const change24h = meta?.change24h ?? 0.0;

    const bidsRaw = book?.bids ?? [];
    const asksRaw = book?.asks ?? [];

    // Calculate cumulative depth totals: [price, qty, cumulativeTotal]
    let cumulativeBidTotal = 0;
    const bids: DepthTuple[] = bidsRaw.map((b) => {
      cumulativeBidTotal += b.price * b.quantity;
      return [b.price, b.quantity, Number(cumulativeBidTotal.toFixed(2))];
    });

    let cumulativeAskTotal = 0;
    const asks: DepthTuple[] = asksRaw.map((a) => {
      cumulativeAskTotal += a.price * a.quantity;
      return [a.price, a.quantity, Number(cumulativeAskTotal.toFixed(2))];
    });

    // Best bid & ask
    const bestBid = bids[0]?.[0] ?? lastPrice;
    const bestAsk = asks[0]?.[0] ?? lastPrice;

    // Ensure effective price is synchronized with active order book spread
    let effectivePrice = lastPrice;
    if (bids[0]?.[0] && asks[0]?.[0]) {
      if (effectivePrice < bids[0][0]) {
        effectivePrice = bids[0][0];
      } else if (effectivePrice > asks[0][0]) {
        effectivePrice = asks[0][0];
      }
    }

    // Spread
    const spread = Math.max(Number((bestAsk - bestBid).toFixed(meta?.priceDecimals ?? 2)), 0);
    const spreadPct = bestBid > 0 ? Number(((spread / bestBid) * 100).toFixed(4)) : 0;

    // Buy/Sell pressure ratio (0..100)
    const totalBidQty = bidsRaw.reduce((sum, b) => sum + b.quantity, 0);
    const totalAskQty = asksRaw.reduce((sum, a) => sum + a.quantity, 0);
    const totalQty = totalBidQty + totalAskQty;

    let buyPressure = 50.0;
    if (totalQty > 0) {
      buyPressure = Number(((totalBidQty / totalQty) * 100).toFixed(2));
    }
    const sellPressure = Number((100 - buyPressure).toFixed(2));

    const payload: MarketUpdatePayload = {
      pair: symbol,
      timestamp: now,
      price: effectivePrice,
      change24h,
      high24h,
      low24h,
      volume24h,
      spread,
      spreadPct,
      buyPressure,
      sellPressure,
      bids,
      asks,
    };

    // Strict validation against shared Zod contract
    return MarketUpdatePayloadSchema.parse(payload);
  }

  /**
   * Get all snapshots for all supported pairs
   */
  public getAllSnapshots(): MarketUpdatePayload[] {
    const symbols = Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[];
    return symbols.map((symbol) => this.getSnapshot(symbol));
  }
}

export const defaultOrderBookManager = new OrderBookManager();
