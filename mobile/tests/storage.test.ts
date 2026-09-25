import { DEFAULT_FAVORITES, InMemoryStorageBackend, StorageRepository, STORAGE_KEYS, utf8ByteLength } from '../src/storage/storageRepository';

describe('StorageRepository', () => {
  it('uses MMKV (createMMKV) when the native module is available, and persists across instances', () => {
    const a = new StorageRepository();
    expect(a.isPersistent()).toBe(true);
    a.setFavorites(['SOLUSDT', 'XRPUSDT']);

    const b = new StorageRepository(); // simulates an app restart on the same MMKV instance
    expect(b.getFavorites()).toEqual(['SOLUSDT', 'XRPUSDT']);
    b.clearAll();
  });

  it('reports in-memory storage as not persistent', () => {
    expect(new StorageRepository(new InMemoryStorageBackend()).isPersistent()).toBe(false);
  });

  it('defaults favourites, toggles them, and filters unknown symbols', () => {
    const s = new StorageRepository(new InMemoryStorageBackend());
    expect(s.getFavorites()).toEqual(DEFAULT_FAVORITES);
    expect(s.toggleFavorite('BTCUSDT')).toBe(false);
    expect(s.toggleFavorite('DOGEUSDT')).toBe(true);
    expect(s.getFavorites()).toEqual(['ETHUSDT', 'SOLUSDT', 'DOGEUSDT']);
    s.set(STORAGE_KEYS.FAVORITES, ['BTCUSDT', 'NOPE']);
    expect(s.getFavorites()).toEqual(['BTCUSDT']);
  });

  it('never writes a gateway default, so env configuration is not shadowed', () => {
    const s = new StorageRepository(new InMemoryStorageBackend());
    expect(s.getGatewayOverride()).toBeNull();
    s.setGatewayOverride('ws://x/ws');
    expect(s.getGatewayOverride()).toBe('ws://x/ws');
    s.setGatewayOverride(null);
    expect(s.getGatewayOverride()).toBeNull();
  });

  it('removes keys written by earlier app versions on startup', () => {
    const backend = new InMemoryStorageBackend();
    backend.set('pulse_gateway_url', '"ws://old/ws"');
    backend.set('pulse_cached_payloads', '{}');
    new StorageRepository(backend);
    expect(backend.getAllKeys()).toEqual([]);
  });

  it('validates stored values and restores defaults', () => {
    const s = new StorageRepository(new InMemoryStorageBackend());
    s.set(STORAGE_KEYS.ACTIVE_PAIR, 'NOPE');
    expect(s.getActivePair()).toBe('BTCUSDT');
    s.setCadenceMs(250);
    expect(s.getCadenceMs()).toBe(250);
    expect(s.getPerfOverlay()).toBe(false);
    s.setPerfOverlay(true);
    s.resetDefaults();
    expect(s.getCadenceMs()).toBeNull();
    expect(s.getPerfOverlay()).toBe(false);
  });

  it('notifies key subscribers asynchronously (never during a render)', async () => {
    const s = new StorageRepository(new InMemoryStorageBackend());
    const favs = jest.fn();
    const any = jest.fn();
    s.subscribe(STORAGE_KEYS.FAVORITES, favs);
    s.subscribeAll(any);
    s.setFavorites(['BTCUSDT']);
    expect(favs).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(favs).toHaveBeenCalledTimes(1);
    expect(any).toHaveBeenCalledWith(STORAGE_KEYS.FAVORITES);
    s.setCadenceMs(100);
    await Promise.resolve();
    expect(favs).toHaveBeenCalledTimes(1);
  });

  it('measures stored sizes as exact UTF-8 bytes', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('€')).toBe(3);
    expect(utf8ByteLength('😀')).toBe(4);
    const s = new StorageRepository(new InMemoryStorageBackend());
    s.set('k', '€');
    expect(s.getStorageStats().estimatedBytes).toBe(1 + utf8ByteLength('"€"'));
  });

  it('describes the stored preferences and cached prices for the Settings card', () => {
    const s = new StorageRepository(new InMemoryStorageBackend());
    expect(s.getStorageDetails()).toMatchObject({ favorites: DEFAULT_FAVORITES, activePair: 'BTCUSDT', cadenceMs: null, cachedPrices: null });
    const snap = { v: 1, savedAt: 1, tickers: { BTCUSDT: {}, ETHUSDT: {} }, books: {} };
    s.set(STORAGE_KEYS.MARKET_SNAPSHOT, snap);
    s.setCadenceMs(250);
    expect(s.getStorageDetails()).toMatchObject({ cadenceMs: 250, cachedPrices: { pairs: 2, bytes: JSON.stringify(snap).length } });
  });
});
