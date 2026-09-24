import { StreamRuntime } from '../src/data/StreamRuntime';
import { InMemoryStorageBackend, StorageRepository } from '../src/storage/storageRepository';
import { StreamClientDeps } from '../src/data/stream/MarketStreamClient';
import { ticker } from './fixtures';

const offlineDeps: StreamClientDeps = {
  createSocket: () => {
    throw new Error('unused');
  },
  subscribeNetwork: (cb) => {
    cb(false);
    return () => undefined;
  },
  subscribeAppState: (cb) => {
    cb(true);
    return () => undefined;
  },
  scheduler: { now: Date.now, setTimeout, clearTimeout: (h) => clearTimeout(h as never), setInterval, clearInterval: (h) => clearInterval(h as never) },
};

function runtime(storage = new StorageRepository(new InMemoryStorageBackend())) {
  const rt = new StreamRuntime({ storage, deps: offlineDeps, resolveUrl: () => 'ws://t/ws', scheduleFrame: (c) => c() });
  const setChannels = jest.spyOn(rt.client, 'setChannels');
  return { rt, storage, desired: () => [...(setChannels.mock.calls.at(-1)?.[0] ?? [])] };
}

describe('StreamRuntime', () => {
  it('ref-counts channels so a channel stays subscribed until its last holder releases it', () => {
    const { rt, desired } = runtime();
    const releaseWatchlist = rt.acquire(['tickers']);
    const releaseTerminal = rt.acquire(['tickers', 'book:BTCUSDT']);
    expect(desired().sort()).toEqual(['book:BTCUSDT', 'tickers']);

    releaseTerminal();
    expect(desired()).toEqual(['tickers']);
    releaseTerminal(); // idempotent
    expect(desired()).toEqual(['tickers']);
    releaseWatchlist();
    expect(desired()).toEqual([]);
  });

  it('persists the active pair and restores it on the next launch', () => {
    const { rt, storage } = runtime();
    rt.setActivePair('SOLUSDT');
    expect(rt.store.getState().activePair).toBe('SOLUSDT');
    expect(runtime(storage).rt.store.getState().activePair).toBe('SOLUSDT');
  });

  it('hydrates cached data at startup and saves live data on stop', () => {
    const { rt, storage } = runtime();
    rt.start();
    rt.ingestor.ingest([{ type: 'tickers', data: [ticker('ETHUSDT', 3000)] }]);
    rt.stop();

    const next = runtime(storage).rt;
    expect(next.store.getState().tickers.ETHUSDT).toMatchObject({ price: 3000, origin: 'cache' });
    expect(next.store.getState().cachedAt).not.toBeNull();
  });

  it('mirrors the client connection into the store', () => {
    const { rt } = runtime();
    rt.start();
    expect(rt.store.getState().connection.state).toBe('offline');
    rt.stop();
  });
});
