import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { MarketStreamClient, StreamClientDeps } from './stream/MarketStreamClient';
import { createMarketStore, MarketStore } from './store/marketStore';
import { FrameScheduler, MarketIngestor } from './store/ingestor';
import { loadSnapshot, SnapshotPersister } from './store/persistence';
import { StorageRepository, STORAGE_KEYS } from '../storage/storageRepository';

export interface StreamRuntimeOptions {
  storage: StorageRepository;
  deps: StreamClientDeps;
  /** Resolves the gateway WebSocket URL; re-evaluated when the developer override changes. */
  resolveUrl: () => string;
  scheduleFrame?: FrameScheduler;
}

/**
 * Composition root for market data on the device: stream client → ingestor → store, plus snapshot
 * persistence and a ref-counted channel registry. One instance per app; React only reads from it.
 */
export class StreamRuntime {
  public readonly store: MarketStore;
  public readonly client: MarketStreamClient;
  public readonly ingestor: MarketIngestor;
  private readonly persister: SnapshotPersister;
  private readonly channelRefs = new Map<string, number>();
  private readonly disposers: Array<() => void> = [];

  constructor(private readonly opts: StreamRuntimeOptions) {
    const { storage } = opts;
    this.store = createMarketStore({ ...loadSnapshot(storage), activePair: storage.getActivePair() });
    this.client = new MarketStreamClient({ url: opts.resolveUrl() }, opts.deps);
    this.ingestor = new MarketIngestor(this.store, opts.scheduleFrame);
    this.persister = new SnapshotPersister(this.store, storage);
    this.client.setCadence(storage.getCadenceMs());
  }

  public start(): void {
    const { storage } = this.opts;
    this.disposers.push(
      this.client.onMessages((msgs) => this.ingestor.ingest(msgs)),
      this.client.onConnection((connection) => {
        this.store.setState({ connection });
        if (connection.state === 'paused') {
          // Backgrounded: make sure the last live data is on disk.
          this.ingestor.commit();
          this.persister.save();
        }
      }),
      storage.subscribe(STORAGE_KEYS.CADENCE_MS, () => this.client.setCadence(storage.getCadenceMs())),
      storage.subscribe(STORAGE_KEYS.GATEWAY_URL_OVERRIDE, () => this.client.setUrl(this.opts.resolveUrl()))
    );
    this.client.start();
    this.persister.start();
  }

  public stop(): void {
    this.disposers.splice(0).forEach((d) => d());
    this.client.stop();
    this.persister.stop();
    this.persister.save();
  }

  /** Registers interest in channels; returns a release function. Channels stay subscribed while any holder remains. */
  public acquire(channels: string[]): () => void {
    for (const c of channels) this.channelRefs.set(c, (this.channelRefs.get(c) ?? 0) + 1);
    this.syncChannels();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const c of channels) {
        const n = (this.channelRefs.get(c) ?? 0) - 1;
        if (n <= 0) this.channelRefs.delete(c);
        else this.channelRefs.set(c, n);
      }
      this.syncChannels();
    };
  }

  public setActivePair(pair: SupportedPairSymbol): void {
    if (this.store.getState().activePair === pair) return;
    this.store.setState({ activePair: pair });
    this.opts.storage.setActivePair(pair);
  }

  private syncChannels(): void {
    this.client.setChannels([...this.channelRefs.keys()]);
  }
}
