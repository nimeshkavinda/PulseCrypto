import {
  SUPPORTED_PAIRS,
  SupportedPairSymbol,
  PairMetadata,
  PairMetadataSchema,
} from '@pulsecrypto/shared';

export class MetadataService {
  private metadataStore: Map<SupportedPairSymbol, PairMetadata> = new Map();

  constructor() {
    this.initializeDefaults();
  }

  /**
   * Seed metadata store with baseline values for all 5 pairs
   */
  private initializeDefaults(): void {
    const defaultBaselines: Record<
      SupportedPairSymbol,
      { high24h: number; low24h: number; volume24h: number; lastPrice: number; change24h: number }
    > = {
      BTCUSDT: { high24h: 65200.0, low24h: 62800.0, volume24h: 28410.5, lastPrice: 64238.17, change24h: 2.45 },
      ETHUSDT: { high24h: 3550.0, low24h: 3380.0, volume24h: 154200.0, lastPrice: 3485.5, change24h: -1.2 },
      SOLUSDT: { high24h: 158.0, low24h: 142.5, volume24h: 895400.0, lastPrice: 152.3, change24h: 5.8 },
      DOGEUSDT: { high24h: 0.135, low24h: 0.118, volume24h: 42000000.0, lastPrice: 0.1245, change24h: 3.1 },
      XRPUSDT: { high24h: 0.62, low24h: 0.56, volume24h: 19800000.0, lastPrice: 0.584, change24h: -0.8 },
    };

    for (const [symbol, config] of Object.entries(SUPPORTED_PAIRS) as [
      SupportedPairSymbol,
      (typeof SUPPORTED_PAIRS)[SupportedPairSymbol]
    ][]) {
      const baseline = defaultBaselines[symbol];
      const meta: PairMetadata = {
        symbol,
        displayName: config.displayName,
        baseAsset: config.baseAsset,
        quoteAsset: config.quoteAsset,
        tradingStatus: 'TRADING',
        priceDecimals: config.priceDecimals,
        qtyDecimals: config.qtyDecimals,
        high24h: baseline.high24h,
        low24h: baseline.low24h,
        volume24h: baseline.volume24h,
        lastPrice: baseline.lastPrice,
        change24h: baseline.change24h,
      };

      PairMetadataSchema.parse(meta); // Validate against shared contract
      this.metadataStore.set(symbol, meta);
    }
  }

  /**
   * Update 24h ticker metadata dynamically from Binance !miniTicker@arr
   */
  public updateFromMiniTicker(
    symbol: SupportedPairSymbol,
    lastPrice: number,
    high24h: number,
    low24h: number,
    volume24h: number
  ): void {
    const existing = this.metadataStore.get(symbol);
    if (!existing) return;

    const change24h = low24h > 0 ? ((lastPrice - low24h) / low24h) * 100 : 0;

    const updated: PairMetadata = {
      ...existing,
      lastPrice: Math.max(lastPrice, 0.000001),
      high24h: Math.max(high24h, lastPrice),
      low24h: Math.max(low24h, 0.000001),
      volume24h: Math.max(volume24h, 0),
      change24h: Number(change24h.toFixed(2)),
    };

    this.metadataStore.set(symbol, updated);
  }

  /**
   * Return all pair metadata records conforming to PairMetadata[]
   */
  public getAll(): PairMetadata[] {
    return Array.from(this.metadataStore.values());
  }

  /**
   * Return metadata for a specific symbol
   */
  public get(symbol: SupportedPairSymbol): PairMetadata | undefined {
    return this.metadataStore.get(symbol);
  }
}

export const defaultMetadataService = new MetadataService();
