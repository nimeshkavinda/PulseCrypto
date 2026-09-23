import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { MarketStreamClient, StreamClientDeps } from './stream/MarketStreamClient';
import { createMarketStore, MarketStore } from './store/marketStore';
import { FrameScheduler, MarketIngestor } from './store/ingestor';
import { loadSnapshot, SnapshotPersister } from './store/persistence';
import { StorageRepository, STORAGE_KEYS } from '../storage/storageRepository';
import { effectiveCadence, NetworkCost } from './adaptiveCadence';

export interface StreamRuntimeOptions {
  storage: StorageRepository;
  deps: StreamClientDeps;
  /** Resolves the gateway WebSocket URL; re-evaluated when the developer override changes. */
  resolveUrl: () => string;
  scheduleFrame?: FrameScheduler;
  /** Connection cost updates for adaptive cadence (NetInfo on device). */
  subscribeNetworkCost?: (onChange: (cost: NetworkCost) => void) => () => void;
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
  private networkCost: NetworkCost = { expensive: false, type: 'unknown' };

  constructor(private readonly opts: StreamRuntimeOptions) {
    const { storage } = opts;
    this.store = createMarketStore({ ...loadSnapshot(storage), activePair: storage.getActivePair() });
    this.client = new MarketStreamClient({ url: opts.resolveUrl() }, opts.deps);
    this.ingestor = new MarketIngestor(this.store, opts.scheduleFrame);
    this.persister = new SnapshotPersister(this.store, storage);
    this.applyCadence();
  }

  /** Requests the cadence from the user's preference, adjusted by adaptive mode on metered networks. */
  private applyCadence(): void {
    const { storage } = this.opts;
    const decision = effectiveCadence(storage.getCadenceMs(), storage.getAdaptivePolling(), this.networkCost);
    this.client.setCadence(decision.cadenceMs);
    if (this.store.getState().adaptiveActive !== decision.adaptiveActive) {
      this.store.setState({ adaptiveActive: decision.adaptiveActive });
    }
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
      storage.subscribe(STORAGE_KEYS.CADENCE_MS, () => this.applyCadence()),
      storage.subscribe(STORAGE_KEYS.ADAPTIVE_POLLING, () => this.applyCadence()),
      storage.subscribe(STORAGE_KEYS.GATEWAY_URL_OVERRIDE, () => this.client.setUrl(this.opts.resolveUrl()))
    );
    if (this.opts.subscribeNetworkCost) {
      this.disposers.push(
        this.opts.subscribeNetworkCost((cost) => {
          this.networkCost = cost;
          this.applyCadence();
        })
      );
    }
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
