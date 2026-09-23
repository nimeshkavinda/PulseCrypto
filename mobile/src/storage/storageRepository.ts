import { SUPPORTED_PAIRS, SupportedPairSymbol } from '@pulsecrypto/shared';

/**
 * Synchronous key-value storage with a persistent engine chosen at startup:
 *  1. MMKV (react-native-mmkv v4 / Nitro): development and release builds.
 *  2. SQLite key-value store (expo-sqlite/kv-store, synchronous API): Expo Go, which does not
 *     ship Nitro modules. Still persistent, only slower than MMKV.
 *  3. In-memory: last resort (e.g. unit tests); reported as not persistent.
 */
export interface IStorageBackend {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  clearAll(): void;
  getAllKeys(): string[];
}

export type StorageEngine = 'mmkv' | 'sqlite' | 'memory';

export class InMemoryStorageBackend implements IStorageBackend {
  private map = new Map<string, string>();
  getString(key: string) {
    return this.map.get(key);
  }
  set(key: string, value: string) {
    this.map.set(key, value);
  }
  delete(key: string) {
    this.map.delete(key);
  }
  clearAll() {
    this.map.clear();
  }
  getAllKeys() {
    return Array.from(this.map.keys());
  }
}

function createMmkvBackend(): IStorageBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
  const mmkv = createMMKV({ id: 'pulsecrypto-storage' });
  return {
    getString: (key) => mmkv.getString(key),
    set: (key, value) => mmkv.set(key, value),
    delete: (key) => {
      mmkv.remove(key);
    },
    clearAll: () => mmkv.clearAll(),
    getAllKeys: () => mmkv.getAllKeys(),
  };
}

function createSqliteBackend(): IStorageBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SQLiteStorage } = require('expo-sqlite/kv-store') as typeof import('expo-sqlite/kv-store');
  const kv = new SQLiteStorage('pulsecrypto-storage.db');
  kv.getAllKeysSync(); // opens the database now so a failure selects the next engine
  return {
    getString: (key) => kv.getItemSync(key) ?? undefined,
    set: (key, value) => kv.setItemSync(key, value),
    delete: (key) => {
      kv.removeItemSync(key);
    },
    clearAll: () => {
      kv.clearSync();
    },
    getAllKeys: () => kv.getAllKeysSync(),
  };
}

function createPersistentBackend(): { backend: IStorageBackend; engine: StorageEngine } {
  const attempts: Array<[StorageEngine, () => IStorageBackend]> = [
    ['mmkv', createMmkvBackend],
    ['sqlite', createSqliteBackend],
  ];
  for (const [engine, create] of attempts) {
    try {
      return { backend: create(), engine };
    } catch {
      // Not available in this runtime (e.g. MMKV in Expo Go); try the next engine.
    }
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[storage] No persistent storage available; favourites and settings will not survive a restart.');
  }
  return { backend: new InMemoryStorageBackend(), engine: 'memory' };
}

export const STORAGE_KEYS = {
  FAVORITES: 'pulse_favorites',
  ACTIVE_PAIR: 'pulse_active_pair',
  /** Preferred stream cadence in ms; absent means the gateway default. */
  CADENCE_MS: 'pulse_cadence_ms',
  /** Developer override of the gateway URL (honoured in development builds only). */
  GATEWAY_URL_OVERRIDE: 'pulse_gateway_url_override',
  BINARY_COMPRESSION: 'pulse_binary_compression',
  ADAPTIVE_POLLING: 'pulse_adaptive_polling',
  MARKET_SNAPSHOT: 'pulse_market_snapshot_v1',
} as const;

/** Keys written by earlier app versions; removed on startup. */
const LEGACY_KEYS = ['pulse_gateway_url', 'pulse_cached_payloads', 'pulse_throttle_ms'];

export const DEFAULT_FAVORITES: SupportedPairSymbol[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
export const DEFAULT_ACTIVE_PAIR: SupportedPairSymbol = 'BTCUSDT';

export interface StorageStats {
  keysCount: number;
  estimatedBytes: number;
  engine: StorageEngine;
  isPersistent: boolean;
}

type Listener = () => void;
type AnyListener = (key: string) => void;

export class StorageRepository {
  private readonly backend: IStorageBackend;
  private readonly engine: StorageEngine;
  private readonly keyListeners = new Map<string, Set<Listener>>();
  private readonly anyListeners = new Set<AnyListener>();

  constructor(backend?: IStorageBackend, engine?: StorageEngine) {
    if (backend) {
      this.backend = backend;
      this.engine = engine ?? (backend instanceof InMemoryStorageBackend ? 'memory' : 'mmkv');
    } else {
      ({ backend: this.backend, engine: this.engine } = createPersistentBackend());
    }
    for (const key of LEGACY_KEYS) this.backend.delete(key);
  }

  public getEngine(): StorageEngine {
    return this.engine;
  }

  public isPersistent(): boolean {
    return this.engine !== 'memory';
  }

  // --- Generic --------------------------------------------------------------

  public get<T>(key: string): T | null {
    try {
      const raw = this.backend.getString(key);
      return raw === undefined ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  public set<T>(key: string, value: T): void {
    this.backend.set(key, JSON.stringify(value));
    this.notify(key);
  }

  public delete(key: string): void {
    this.backend.delete(key);
    this.notify(key);
  }

  public clearAll(): void {
    const keys = this.backend.getAllKeys();
    this.backend.clearAll();
    keys.forEach((k) => this.notify(k));
  }

  /** Subscribe to writes of one key. Listeners run in a microtask, never during a React render. */
  public subscribe(key: string, listener: Listener): () => void {
    let set = this.keyListeners.get(key);
    if (!set) this.keyListeners.set(key, (set = new Set()));
    set.add(listener);
    return () => set!.delete(listener);
  }

  /** Subscribe to writes of any key; the listener receives the key that changed. */
  public subscribeAll(listener: AnyListener): () => void {
    this.anyListeners.add(listener);
    return () => this.anyListeners.delete(listener);
  }

  private notify(key: string): void {
    const keyListeners = [...(this.keyListeners.get(key) ?? [])];
    const anyListeners = [...this.anyListeners];
    if (keyListeners.length === 0 && anyListeners.length === 0) return;
    queueMicrotask(() => {
      const run = (fn: () => void) => {
        try {
          fn();
        } catch (err) {
          console.error('[storage] listener failed', err);
        }
      };
      keyListeners.forEach((l) => run(l));
      anyListeners.forEach((l) => run(() => l(key)));
    });
  }

  // --- Domain accessors -----------------------------------------------------

  public getFavorites(): SupportedPairSymbol[] {
    const favs = this.get<string[]>(STORAGE_KEYS.FAVORITES);
    if (!Array.isArray(favs)) return [...DEFAULT_FAVORITES];
    return favs.filter((s): s is SupportedPairSymbol => Object.prototype.hasOwnProperty.call(SUPPORTED_PAIRS, s));
  }

  public setFavorites(favorites: SupportedPairSymbol[]): void {
    this.set(STORAGE_KEYS.FAVORITES, favorites);
  }

  /** Toggles a favourite; returns whether it is now a favourite. */
  public toggleFavorite(symbol: SupportedPairSymbol): boolean {
    const favs = new Set(this.getFavorites());
    const nowFavorite = !favs.has(symbol);
    if (nowFavorite) favs.add(symbol);
    else favs.delete(symbol);
    this.setFavorites(Array.from(favs));
    return nowFavorite;
  }

  public getActivePair(): SupportedPairSymbol {
    const v = this.get<string>(STORAGE_KEYS.ACTIVE_PAIR);
    return v && Object.prototype.hasOwnProperty.call(SUPPORTED_PAIRS, v) ? (v as SupportedPairSymbol) : DEFAULT_ACTIVE_PAIR;
  }

  public setActivePair(pair: SupportedPairSymbol): void {
    if (this.getActivePair() !== pair) this.set(STORAGE_KEYS.ACTIVE_PAIR, pair);
  }

  public getCadenceMs(): number | null {
    const v = this.get<number>(STORAGE_KEYS.CADENCE_MS);
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  }

  public setCadenceMs(ms: number | null): void {
    if (ms === null) this.delete(STORAGE_KEYS.CADENCE_MS);
    else this.set(STORAGE_KEYS.CADENCE_MS, Math.round(ms));
  }

  public getGatewayOverride(): string | null {
    const v = this.get<string>(STORAGE_KEYS.GATEWAY_URL_OVERRIDE);
    return typeof v === 'string' && v.length > 0 ? v : null;
  }

  public setGatewayOverride(url: string | null): void {
    if (url === null) this.delete(STORAGE_KEYS.GATEWAY_URL_OVERRIDE);
    else this.set(STORAGE_KEYS.GATEWAY_URL_OVERRIDE, url);
  }

  public getBinaryCompression(): boolean {
    return this.get<boolean>(STORAGE_KEYS.BINARY_COMPRESSION) ?? true;
  }

  public setBinaryCompression(enabled: boolean): void {
    this.set(STORAGE_KEYS.BINARY_COMPRESSION, enabled);
  }

  public getAdaptivePolling(): boolean {
    return this.get<boolean>(STORAGE_KEYS.ADAPTIVE_POLLING) ?? false;
  }

  public setAdaptivePolling(enabled: boolean): void {
    this.set(STORAGE_KEYS.ADAPTIVE_POLLING, enabled);
  }

  /** Restores user preferences to defaults (keeps the market snapshot). */
  public resetDefaults(): void {
    this.setFavorites([...DEFAULT_FAVORITES]);
    this.setActivePair(DEFAULT_ACTIVE_PAIR);
    this.setCadenceMs(null);
    this.setGatewayOverride(null);
    this.setBinaryCompression(true);
    this.setAdaptivePolling(false);
  }

  public getStorageStats(): StorageStats {
    const keys = this.backend.getAllKeys();
    let bytes = 0;
    for (const k of keys) bytes += k.length + (this.backend.getString(k)?.length ?? 0);
    return { keysCount: keys.length, estimatedBytes: bytes, engine: this.engine, isPersistent: this.isPersistent() };
  }
}

export const defaultStorage = new StorageRepository();
