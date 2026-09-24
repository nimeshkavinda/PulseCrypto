import { SupportedPairSymbol } from '@pulsecrypto/shared';

/** Minimal socket surface the hub depends on (satisfied by `ws.WebSocket`; easy to fake in tests). */
export interface HubSocket {
  readonly readyState: number;
  readonly bufferedAmount: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  terminate(): void;
  on(event: 'message', listener: (data: Buffer | ArrayBuffer | Buffer[]) => void): unknown;
  on(event: 'close' | 'error', listener: (...args: unknown[]) => void): unknown;
}

/**
 * Per-connection state. Tracks, for every item the client can receive, the version it was last
 * sent. That makes delivery idempotent and self-healing: a client that skips frames (cadence or
 * backpressure) simply receives the latest version of whatever changed on its next frame.
 */
export class ClientSession {
  public subscribedTickers = false;
  public readonly bookPairs = new Set<SupportedPairSymbol>();

  public readonly sentTickerVersions = new Map<SupportedPairSymbol, number>();
  public readonly sentBookVersions = new Map<SupportedPairSymbol, number>();
  public sentStatusVersion = 0;

  /** Send at most one data frame every `cadenceTicks` hub ticks. */
  public cadenceTicks = 1;
  /** Hub tick of the last data frame sent; -Infinity so the first eligible tick always sends. */
  public lastSentTick = Number.NEGATIVE_INFINITY;
  /** Wall-clock ms when the socket first exceeded the soft buffer limit, or null when healthy. */
  public lagSince: number | null = null;
  public lastErrorAt = 0;
  public closed = false;

  constructor(public readonly socket: HubSocket) {}

  public channels(): string[] {
    const list: string[] = [];
    if (this.subscribedTickers) list.push('tickers');
    for (const pair of this.bookPairs) list.push(`book:${pair}`);
    return list;
  }
}
