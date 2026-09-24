import { SupportedPairSymbol, UpstreamStatus } from '@pulsecrypto/shared';
import { MetadataService, VersionedTicker } from '../metadata.js';
import { OrderBookManager, VersionedBook } from '../orderbook.js';

export interface GatewayStatus {
  upstream: UpstreamStatus;
  stalePairs: SupportedPairSymbol[];
  since: number;
}

export interface VersionedStatus {
  version: number;
  status: GatewayStatus;
}

/**
 * Read-side view of market state consumed by the ChannelHub.
 * Every item carries a monotonic version; version 0 / null means "no upstream data yet".
 * Version reads must be O(1) and allocation-free because the hub polls them every tick.
 */
export interface MarketSource {
  getTickerVersion(pair: SupportedPairSymbol): number;
  getTicker(pair: SupportedPairSymbol): VersionedTicker | null;
  getBookVersion(pair: SupportedPairSymbol): number;
  getBook(pair: SupportedPairSymbol): VersionedBook | null;
  getStatus(): VersionedStatus;
}

/** Tracks gateway/upstream health as a versioned value. */
export class StatusTracker {
  private current: VersionedStatus = {
    version: 1,
    status: { upstream: 'connecting', stalePairs: [], since: Date.now() },
  };

  public set(upstream: UpstreamStatus, stalePairs: SupportedPairSymbol[] = []): void {
    const prev = this.current.status;
    const sameStale =
      prev.stalePairs.length === stalePairs.length && prev.stalePairs.every((p, i) => p === stalePairs[i]);
    if (prev.upstream === upstream && sameStale) return;
    this.current = {
      version: this.current.version + 1,
      status: { upstream, stalePairs: [...stalePairs], since: Date.now() },
    };
  }

  public get(): VersionedStatus {
    return this.current;
  }
}

/** Adapter exposing the in-memory ticker and order book state as a MarketSource. */
export class InMemoryMarketSource implements MarketSource {
  constructor(
    private readonly metadata: MetadataService,
    private readonly books: OrderBookManager,
    private readonly statusTracker: StatusTracker
  ) {}

  getTickerVersion(pair: SupportedPairSymbol): number {
    return this.metadata.getVersion(pair);
  }

  getTicker(pair: SupportedPairSymbol): VersionedTicker | null {
    return this.metadata.getTicker(pair);
  }

  getBookVersion(pair: SupportedPairSymbol): number {
    return this.books.getVersion(pair);
  }

  getBook(pair: SupportedPairSymbol): VersionedBook | null {
    return this.books.getBook(pair);
  }

  getStatus(): VersionedStatus {
    return this.statusTracker.get();
  }
}
