import { BookSchema, SupportedPairSymbol, TickerSchema } from '@pulsecrypto/shared';
import { StorageRepository, STORAGE_KEYS } from '../../storage/storageRepository';
import { BookView, MarketState, MarketStore, TickerView } from './marketStore';

interface SnapshotV1 {
  v: 1;
  savedAt: number;
  tickers: Record<string, unknown>;
  books: Record<string, unknown>;
}

/**
 * Reads the last saved market snapshot so the app can show real (clearly labelled) data at cold
 * start and while offline. Entries that fail validation are dropped; nothing is ever synthesized.
 */
export function loadSnapshot(storage: StorageRepository): Pick<MarketState, 'tickers' | 'books' | 'cachedAt'> {
  const snap = storage.get<SnapshotV1>(STORAGE_KEYS.MARKET_SNAPSHOT);
  if (!snap || snap.v !== 1 || typeof snap.savedAt !== 'number') return { tickers: {}, books: {}, cachedAt: null };

  const tickers: Partial<Record<SupportedPairSymbol, TickerView>> = {};
  for (const value of Object.values(snap.tickers ?? {})) {
    const parsed = TickerSchema.safeParse(value);
    if (parsed.success) tickers[parsed.data.pair] = { ...parsed.data, origin: 'cache' };
  }
  const books: Partial<Record<SupportedPairSymbol, BookView>> = {};
  for (const value of Object.values(snap.books ?? {})) {
    const parsed = BookSchema.safeParse(value);
    if (parsed.success) books[parsed.data.pair] = { ...parsed.data, origin: 'cache' };
  }
  const any = Object.keys(tickers).length > 0 || Object.keys(books).length > 0;
  return { tickers, books, cachedAt: any ? snap.savedAt : null };
}

const strip = <T extends { origin: unknown }>(v: T) => {
  const { origin: _origin, ...rest } = v;
  return rest;
};

/** Saves live data periodically (default every 5 s) and on demand (e.g. when backgrounding). */
export class SnapshotPersister {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSaved: MarketState['tickers'] | null = null;
  private lastSavedBooks: MarketState['books'] | null = null;

  constructor(
    private readonly store: MarketStore,
    private readonly storage: StorageRepository,
    private readonly now: () => number = Date.now
  ) {}

  public start(intervalMs = 5000): void {
    this.stop();
    this.timer = setInterval(() => this.save(), intervalMs);
  }

  public stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Writes a snapshot if live data changed since the last save. */
  public save(): boolean {
    const { tickers, books } = this.store.getState();
    if (tickers === this.lastSaved && books === this.lastSavedBooks) return false;
    const liveTickers = Object.values(tickers).filter((t): t is TickerView => !!t && t.origin === 'live');
    const liveBooks = Object.values(books).filter((b): b is BookView => !!b && b.origin === 'live');
    if (liveTickers.length === 0 && liveBooks.length === 0) return false;

    const snapshot: SnapshotV1 = {
      v: 1,
      savedAt: this.now(),
      tickers: Object.fromEntries(Object.values(tickers).filter(Boolean).map((t) => [t!.pair, strip(t!)])),
      books: Object.fromEntries(Object.values(books).filter(Boolean).map((b) => [b!.pair, strip(b!)])),
    };
    this.storage.set(STORAGE_KEYS.MARKET_SNAPSHOT, snapshot);
    this.lastSaved = tickers;
    this.lastSavedBooks = books;
    return true;
  }
}
