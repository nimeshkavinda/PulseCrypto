import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { StatusTracker } from './marketSource.js';

export interface FreshnessMonitorOptions {
  status: StatusTracker;
  pairs: SupportedPairSymbol[];
  /** Returns when the pair's order book last received an upstream update (0 if never). */
  lastUpdateAt: (pair: SupportedPairSymbol) => number;
  staleAfterMs: number;
  intervalMs?: number;
  now?: () => number;
}

/**
 * Derives the upstream status published to clients:
 * - `connecting`: never connected yet.
 * - `live`: connected and every pair's book updated within `staleAfterMs`.
 * - `stale`: connected but at least one pair is frozen (listed in `stalePairs`).
 * - `down`: upstream socket closed after having connected.
 * The depth stream (100 ms per pair) is the heartbeat; tickers (1 s) and trades (bursty) are not.
 */
export class FreshnessMonitor {
  private connected = false;
  private everConnected = false;
  private connectedAt = 0;
  private timer: NodeJS.Timeout | null = null;
  private readonly now: () => number;

  constructor(private readonly opts: FreshnessMonitorOptions) {
    this.now = opts.now ?? Date.now;
  }

  public setConnected(connected: boolean): void {
    if (connected && !this.connected) this.connectedAt = this.now();
    this.connected = connected;
    if (connected) this.everConnected = true;
    this.evaluate();
  }

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.evaluate(), this.opts.intervalMs ?? 1000);
    this.timer.unref?.();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public evaluate(): void {
    if (!this.connected) {
      this.opts.status.set(this.everConnected ? 'down' : 'connecting');
      return;
    }
    const now = this.now();
    const stale = this.opts.pairs.filter((pair) => {
      const reference = Math.max(this.opts.lastUpdateAt(pair), this.connectedAt);
      return now - reference > this.opts.staleAfterMs;
    });
    this.opts.status.set(stale.length > 0 ? 'stale' : 'live', stale);
  }
}
