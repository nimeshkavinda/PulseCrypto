import { createMarketStore } from '../src/data/store/marketStore';
import { loadSnapshot, SnapshotPersister } from '../src/data/store/persistence';
import { InMemoryStorageBackend, StorageRepository, STORAGE_KEYS } from '../src/storage/storageRepository';
import { book, ticker } from './fixtures';

const storage = () => new StorageRepository(new InMemoryStorageBackend());

describe('market snapshot persistence', () => {
  it('returns an empty state when nothing was saved', () => {
    expect(loadSnapshot(storage())).toEqual({ tickers: {}, books: {}, cachedAt: null });
  });

  it('round-trips live data and marks it as cached on load', () => {
    const s = storage();
    const store = createMarketStore({
      tickers: { BTCUSDT: { ...ticker('BTCUSDT', 100), origin: 'live' } },
      books: { BTCUSDT: { ...book('BTCUSDT'), origin: 'live' } },
    });
    const persister = new SnapshotPersister(store, s, () => 42_000);
    expect(persister.save()).toBe(true);

    const loaded = loadSnapshot(s);
    expect(loaded.cachedAt).toBe(42_000);
    expect(loaded.tickers.BTCUSDT).toMatchObject({ price: 100, origin: 'cache' });
    expect(loaded.books.BTCUSDT).toMatchObject({ pair: 'BTCUSDT', origin: 'cache' });
  });

  it('does not rewrite unchanged data or save cache-only data', () => {
    const s = storage();
    const store = createMarketStore({ tickers: { ETHUSDT: { ...ticker('ETHUSDT', 10), origin: 'cache' } } });
    const persister = new SnapshotPersister(store, s);
    expect(persister.save()).toBe(false);

    store.setState({ tickers: { ETHUSDT: { ...ticker('ETHUSDT', 11), origin: 'live' } } });
    expect(persister.save()).toBe(true);
    expect(persister.save()).toBe(false);
  });

  it('drops invalid entries and ignores unknown snapshot versions', () => {
    const s = storage();
    s.set(STORAGE_KEYS.MARKET_SNAPSHOT, {
      v: 1,
      savedAt: 5,
      tickers: { BTCUSDT: ticker('BTCUSDT', 100), BAD: { pair: 'BAD', price: -1 } },
      books: {},
    });
    expect(Object.keys(loadSnapshot(s).tickers)).toEqual(['BTCUSDT']);

    s.set(STORAGE_KEYS.MARKET_SNAPSHOT, { v: 99, savedAt: 5, tickers: {}, books: {} });
    expect(loadSnapshot(s).cachedAt).toBeNull();
  });
});
