/**
 * Synchronous local key-value storage repository.
 * Backed by react-native-mmkv in native runtime with seamless in-memory fallback
 * for headless unit testing (Vitest / Node.js).
 */

export interface IStorageBackend {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  clearAll(): void;
}

class InMemoryStorageBackend implements IStorageBackend {
  private map = new Map<string, string>();

  public getString(key: string): string | undefined {
    return this.map.get(key);
  }

  public set(key: string, value: string): void {
    this.map.set(key, value);
  }

  public delete(key: string): void {
    this.map.delete(key);
  }

  public clearAll(): void {
    this.map.clear();
  }
}

let nativeBackend: IStorageBackend | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv');
  if (typeof MMKV === 'function') {
    nativeBackend = new MMKV({ id: 'pulsecrypto-storage' });
  }
} catch {
  // Native MMKV module not present in Node/Vitest test environment
  nativeBackend = null;
}

export const STORAGE_KEYS = {
  FAVORITES: 'pulse_favorites',
  THROTTLE_INTERVAL: 'pulse_throttle_ms',
  GATEWAY_URL: 'pulse_gateway_url',
  ACTIVE_PAIR: 'pulse_active_pair',
} as const;

export const DEFAULT_FAVORITES = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
export const DEFAULT_THROTTLE_MS = 100;
export const DEFAULT_GATEWAY_URL = 'ws://10.0.2.2:8080/ws';

export class StorageRepository {
  private backend: IStorageBackend;

  constructor(customBackend?: IStorageBackend) {
    this.backend = customBackend ?? nativeBackend ?? new InMemoryStorageBackend();
  }

  public get<T>(key: string): T | null {
    try {
      const raw = this.backend.getString(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  public set<T>(key: string, value: T): void {
    try {
      this.backend.set(key, JSON.stringify(value));
    } catch (err) {
      console.error(`[StorageRepository] Error writing key "${key}":`, err);
    }
  }

  public delete(key: string): void {
    this.backend.delete(key);
  }

  public clearAll(): void {
    this.backend.clearAll();
  }

  // --- Strongly Typed Domain Accessors ---

  public getFavorites(): string[] {
    const favs = this.get<string[]>(STORAGE_KEYS.FAVORITES);
    if (Array.isArray(favs) && favs.length > 0) {
      return favs;
    }
    return DEFAULT_FAVORITES;
  }

  public setFavorites(favorites: string[]): void {
    this.set(STORAGE_KEYS.FAVORITES, favorites);
  }

  public toggleFavorite(symbol: string): boolean {
    const favs = new Set(this.getFavorites());
    const isFav = !favs.has(symbol);
    if (isFav) {
      favs.add(symbol);
    } else {
      favs.delete(symbol);
    }
    this.setFavorites(Array.from(favs));
    return isFav;
  }

  public isFavorite(symbol: string): boolean {
    const favs = this.getFavorites();
    return favs.includes(symbol);
  }

  public getClientThrottle(): number {
    const val = this.get<number>(STORAGE_KEYS.THROTTLE_INTERVAL);
    if (typeof val === 'number' && val >= 10 && val <= 1000) {
      return val;
    }
    return DEFAULT_THROTTLE_MS;
  }

  public setClientThrottle(intervalMs: number): void {
    const clamped = Math.max(10, Math.min(1000, intervalMs));
    this.set(STORAGE_KEYS.THROTTLE_INTERVAL, clamped);
  }

  public getGatewayUrl(): string {
    const val = this.get<string>(STORAGE_KEYS.GATEWAY_URL);
    return val || process.env.EXPO_PUBLIC_GATEWAY_URL || DEFAULT_GATEWAY_URL;
  }

  public setGatewayUrl(url: string): void {
    this.set(STORAGE_KEYS.GATEWAY_URL, url);
  }

  public getActivePair(): string {
    const val = this.get<string>(STORAGE_KEYS.ACTIVE_PAIR);
    return val || 'BTCUSDT';
  }

  public setActivePair(symbol: string): void {
    this.set(STORAGE_KEYS.ACTIVE_PAIR, symbol);
  }
}

export const defaultStorage = new StorageRepository();
