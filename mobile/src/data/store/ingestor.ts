import { ServerMessage, SupportedPairSymbol } from '@pulsecrypto/shared';
import { BookView, MarketStore, TickerView, UpstreamView } from './marketStore';

export type FrameScheduler = (commit: () => void) => void;

/** Commits on the next animation frame (one render pass per display frame at most). */
export const animationFrameScheduler: FrameScheduler = (commit) => {
  requestAnimationFrame(() => commit());
};

/**
 * Buffers stream messages and applies them to the store in one `setState` per animation frame.
 * Latest value wins per pair; unchanged pairs keep their object identity so components
 * selecting them do not re-render.
 */
export class MarketIngestor {
  private tickers = new Map<SupportedPairSymbol, TickerView>();
  private books = new Map<SupportedPairSymbol, BookView>();
  private upstream: UpstreamView | null = null;
  private scheduled = false;
  public commits = 0;

  constructor(
    private readonly store: MarketStore,
    private readonly schedule: FrameScheduler = animationFrameScheduler
  ) {}

  public ingest(msgs: ServerMessage[]): void {
    for (const m of msgs) {
      if (m.type === 'tickers') {
        for (const t of m.data) this.tickers.set(t.pair, { ...t, origin: 'live' });
      } else if (m.type === 'book') {
        const { type: _type, ...book } = m;
        this.books.set(book.pair, { ...book, origin: 'live' });
      } else if (m.type === 'status') {
        this.upstream = { status: m.upstream, stalePairs: m.stalePairs, since: m.since };
      }
    }
    if (!this.scheduled && (this.tickers.size > 0 || this.books.size > 0 || this.upstream)) {
      this.scheduled = true;
      this.schedule(() => this.commit());
    }
  }

  /** Applies everything buffered. Public for tests and for flushing before app suspension. */
  public commit(): void {
    this.scheduled = false;
    if (this.tickers.size === 0 && this.books.size === 0 && !this.upstream) return;
    const tickers = this.tickers;
    const books = this.books;
    const upstream = this.upstream;
    this.tickers = new Map();
    this.books = new Map();
    this.upstream = null;
    this.commits++;
    this.store.setState((s) => ({
      tickers: tickers.size > 0 ? { ...s.tickers, ...Object.fromEntries(tickers) } : s.tickers,
      books: books.size > 0 ? { ...s.books, ...Object.fromEntries(books) } : s.books,
      upstream: upstream ?? s.upstream,
    }));
  }
}
