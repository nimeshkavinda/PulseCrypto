import { SUPPORTED_PAIRS, SupportedPairSymbol, PairMetadata, Ticker } from '@pulsecrypto/shared';

/** Exchange reference data for a pair (from `exchangeInfo`). */
export interface PairStaticInfo {
  displayName: string;
  baseAsset: string;
  quoteAsset: string;
  tradingStatus: PairMetadata['tradingStatus'];
  priceDecimals: number;
  qtyDecimals: number;
}

/** Rolling 24h statistics as delivered by Binance (`ticker/24hr` REST or `<pair>@ticker` stream). */
export interface Ticker24h {
  lastPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  /** 24h change in percent. */
  changePct: number;
  /** Exchange event time (epoch ms). */
  eventTs: number;
}

interface LiveStats {
  lastPrice: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24h: number;
  /** Exchange time of the event that last set `lastPrice`. */
  priceTs: number;
  eventTs: number;
  updatedAt: number;
  version: number;
}

export interface VersionedTicker {
  version: number;
  ticker: Ticker;
}

const PAIRS = Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[];

/**
 * Market metadata and live ticker statistics per pair.
 *
 * Nothing is seeded: a pair has no ticker until upstream data arrives, and `/pairs/meta` is not
 * ready until every pair has both exchange reference data and 24h statistics.
 *
 * Price ordering: trades (aggTrade) and 24h tickers both carry a last price. A ticker only moves the
 * price if its event time is not older than the last applied price, so a ticker that arrives after
 * a newer trade can never make the price jump backwards.
 */
export class MetadataService {
  private readonly statics = new Map<SupportedPairSymbol, PairStaticInfo>();
  private readonly stats = new Map<SupportedPairSymbol, LiveStats>();
  private contentVersion = 0;

  constructor(private readonly now: () => number = Date.now) {}

  public applyExchangeInfo(pair: SupportedPairSymbol, info: PairStaticInfo): void {
    const prev = this.statics.get(pair);
    if (prev && JSON.stringify(prev) === JSON.stringify(info)) return;
    this.statics.set(pair, { ...info });
    this.contentVersion++;
  }

  public applyTicker24h(pair: SupportedPairSymbol, t: Ticker24h): void {
    if (!isPositive(t.lastPrice) || !isNonNegative(t.high24h) || !isNonNegative(t.low24h)) return;
    if (!isNonNegative(t.volume24h) || !Number.isFinite(t.changePct)) return;

    const prev = this.stats.get(pair);
    const takePrice = !prev || t.eventTs >= prev.priceTs;
    const lastPrice = takePrice ? t.lastPrice : prev!.lastPrice;

    this.stats.set(pair, {
      lastPrice,
      // Keep the rolling window consistent with trades already applied after this ticker's event time.
      high24h: Math.max(t.high24h, lastPrice),
      low24h: t.low24h > 0 ? Math.min(t.low24h, lastPrice) : lastPrice,
      volume24h: t.volume24h,
      change24h: round2(t.changePct),
      priceTs: takePrice ? t.eventTs : prev!.priceTs,
      eventTs: Math.max(t.eventTs, prev?.eventTs ?? 0),
      updatedAt: this.now(),
      version: (prev?.version ?? 0) + 1,
    });
    this.contentVersion++;
  }

  /** Applies a trade price. Ignored until 24h stats exist (the ticker view needs them). */
  public applyTrade(pair: SupportedPairSymbol, price: number, tradeTs: number): void {
    const prev = this.stats.get(pair);
    if (!prev || !isPositive(price) || tradeTs < prev.priceTs) return;
    if (price === prev.lastPrice) {
      prev.priceTs = tradeTs;
      return;
    }
    this.stats.set(pair, {
      ...prev,
      lastPrice: price,
      high24h: Math.max(prev.high24h, price),
      low24h: prev.low24h > 0 ? Math.min(prev.low24h, price) : price,
      priceTs: tradeTs,
      eventTs: Math.max(tradeTs, prev.eventTs),
      updatedAt: this.now(),
      version: prev.version + 1,
    });
    this.contentVersion++;
  }

  public getVersion(pair: SupportedPairSymbol): number {
    return this.stats.get(pair)?.version ?? 0;
  }

  public getTicker(pair: SupportedPairSymbol): VersionedTicker | null {
    const s = this.stats.get(pair);
    if (!s) return null;
    return {
      version: s.version,
      ticker: {
        pair,
        price: s.lastPrice,
        change24h: s.change24h,
        high24h: s.high24h,
        low24h: s.low24h,
        volume24h: s.volume24h,
        updatedAt: s.updatedAt,
        eventTs: s.eventTs,
      },
    };
  }

  /** True once every supported pair has exchange reference data and 24h statistics. */
  public isReady(): boolean {
    return PAIRS.every((p) => this.statics.has(p) && this.stats.has(p));
  }

  /** Changes whenever any value served by `/pairs/meta` changes (used for the ETag). */
  public getContentVersion(): number {
    return this.contentVersion;
  }

  /** All pair metadata, or an empty list until `isReady()`. */
  public getAll(): PairMetadata[] {
    if (!this.isReady()) return [];
    return PAIRS.map((symbol) => {
      const info = this.statics.get(symbol)!;
      const s = this.stats.get(symbol)!;
      return {
        symbol,
        ...info,
        high24h: s.high24h,
        low24h: s.low24h,
        volume24h: s.volume24h,
        lastPrice: s.lastPrice,
        change24h: s.change24h,
      };
    });
  }
}

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function isNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
