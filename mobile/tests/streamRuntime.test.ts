import { StreamRuntime } from '../src/data/StreamRuntime';
import { InMemoryStorageBackend, StorageRepository, STORAGE_KEYS } from '../src/storage/storageRepository';
import { StreamClientDeps } from '../src/data/stream/MarketStreamClient';
import { book, ticker } from './fixtures';

/** Channel changes are applied in a microtask; let it run. */
const settle = () => Promise.resolve();

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
  it('ref-counts channels so a channel stays subscribed until its last holder releases it', async () => {
    const { rt, desired } = runtime();
    const releaseWatchlist = rt.acquire(['tickers']);
    const releaseTerminal = rt.acquire(['tickers', 'book:BTCUSDT']);
    await settle();
    expect(desired().sort()).toEqual(['book:BTCUSDT', 'tickers']);

    releaseTerminal();
    await settle();
    expect(desired()).toEqual(['tickers']);
    releaseTerminal(); // idempotent
    await settle();
    expect(desired()).toEqual(['tickers']);
    releaseWatchlist();
    await settle();
    expect(desired()).toEqual([]);
  });

  it('coalesces a pair switch into one channel update that keeps tickers', async () => {
    const { rt } = runtime();
    const setChannels = jest.spyOn(rt.client, 'setChannels');
    const release = rt.acquire(['tickers', 'book:BTCUSDT']);
    await settle();
    setChannels.mockClear();

    // What useChannels does on BTC -> ETH: release the old set, acquire the new one, same turn.
    release();
    rt.acquire(['tickers', 'book:ETHUSDT']);
    await settle();
    expect(setChannels).toHaveBeenCalledTimes(1);
    expect([...setChannels.mock.calls[0][0]].sort()).toEqual(['book:ETHUSDT', 'tickers']);
  });

  it('commits buffered data before the final save on stop', () => {
    const storage = new StorageRepository(new InMemoryStorageBackend());
    const pending: Array<() => void> = [];
    const rt = new StreamRuntime({ storage, deps: offlineDeps, resolveUrl: () => 'ws://t/ws', scheduleFrame: (c) => void pending.push(c) });
    rt.start();
    rt.ingestor.ingest([{ type: 'tickers', data: [ticker('SOLUSDT', 150)] }]); // not yet committed
    rt.stop();
    expect(runtime(storage).rt.store.getState().tickers.SOLUSDT).toMatchObject({ price: 150, origin: 'cache' });
  });

  it('clears cached prices from memory and storage but keeps live entries', () => {
    const { rt: first, storage } = runtime();
    first.start();
    first.ingestor.ingest([{ type: 'tickers', data: [ticker('ETHUSDT', 3000)] }, { type: 'book', ...book('ETHUSDT') }]);
    first.stop();

    const { rt } = runtime(storage);
    rt.ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', 64000)] }]);
    expect(rt.store.getState().tickers.ETHUSDT?.origin).toBe('cache');

    rt.clearCachedPrices();
    const s = rt.store.getState();
    expect(s.tickers.ETHUSDT).toBeUndefined();
    expect(s.books.ETHUSDT).toBeUndefined();
    expect(s.tickers.BTCUSDT).toMatchObject({ origin: 'live', price: 64000 });
    expect(s.cachedAt).toBeNull();
    expect(storage.get(STORAGE_KEYS.MARKET_SNAPSHOT)).toBeNull();
  });

  it('reset preferences switches the running app back to the default pair', () => {
    const { rt, storage } = runtime();
    rt.setActivePair('SOLUSDT');
    storage.setCadenceMs(500);
    rt.resetPreferences();
    expect(rt.store.getState().activePair).toBe('BTCUSDT');
    expect(storage.getActivePair()).toBe('BTCUSDT');
    expect(storage.getCadenceMs()).toBeNull();
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
