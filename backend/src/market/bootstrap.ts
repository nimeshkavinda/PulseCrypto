import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { MetadataService } from '../metadata.js';
import { BinanceRestClient } from './binanceRest.js';

export interface MetadataBootstrapOptions {
  rest: BinanceRestClient;
  metadata: MetadataService;
  pairs: SupportedPairSymbol[];
  retryInitialMs?: number;
  retryMaxMs?: number;
  /** Re-fetch exchange reference data (trading status, tick sizes) on this interval. */
  exchangeInfoRefreshMs?: number;
  logger?: { info: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void };
}

/**
 * Loads 24h statistics and exchange reference data from Binance REST on startup, retrying each
 * independently with capped exponential backoff and jitter until it succeeds, then refreshes
 * reference data periodically. Live statistics are kept current by the WebSocket ticker stream.
 */
export class MetadataBootstrap {
  private stopped = false;
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly retryInitialMs: number;
  private readonly retryMaxMs: number;
  private readonly refreshMs: number;

  constructor(private readonly opts: MetadataBootstrapOptions) {
    this.retryInitialMs = opts.retryInitialMs ?? 1000;
    this.retryMaxMs = opts.retryMaxMs ?? 30000;
    this.refreshMs = opts.exchangeInfoRefreshMs ?? 60 * 60 * 1000;
  }

  public start(): void {
    this.stopped = false;
    this.run('tickers24h', () => this.loadTickers(), 0);
    this.run('exchangeInfo', () => this.loadExchangeInfo(), 0, true);
  }

  public stop(): void {
    this.stopped = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  private async loadTickers(): Promise<void> {
    const tickers = await this.opts.rest.fetchTickers24h(this.opts.pairs);
    for (const [pair, t] of tickers) this.opts.metadata.applyTicker24h(pair, t);
  }

  private async loadExchangeInfo(): Promise<void> {
    const infos = await this.opts.rest.fetchExchangeInfo(this.opts.pairs);
    for (const [pair, info] of infos) this.opts.metadata.applyExchangeInfo(pair, info);
    const missing = this.opts.pairs.filter((p) => !infos.has(p));
    if (missing.length > 0) throw new Error(`exchangeInfo missing symbols: ${missing.join(', ')}`);
  }

  private run(name: string, task: () => Promise<void>, attempt: number, refresh = false): void {
    if (this.stopped) return;
    task().then(
      () => {
        this.opts.logger?.info({ task: name }, 'Metadata bootstrap step loaded');
        if (refresh) this.schedule(() => this.run(name, task, 0, true), this.refreshMs);
      },
      (err: unknown) => {
        const cap = Math.min(this.retryInitialMs * 2 ** attempt, this.retryMaxMs);
        const delay = Math.round(cap / 2 + (Math.random() * cap) / 2);
        this.opts.logger?.warn({ task: name, attempt, retryInMs: delay, err: String(err) }, 'Metadata bootstrap failed');
        this.schedule(() => this.run(name, task, attempt + 1, refresh), delay);
      }
    );
  }

  private schedule(fn: () => void, ms: number): void {
    if (this.stopped) return;
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    t.unref?.();
    this.timers.add(t);
  }
}
