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

/**
 * Platform-aware default gateway URL.
 * - Android Emulator: 10.0.2.2 is the special alias to the host machine's loopback.
 * - iOS Simulator: shares host network, so localhost works directly.
 * - Vitest/Node: falls back to localhost (no Platform module available).
 */
function getDefaultGatewayUrl(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native');
    const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    return `ws://${host}:8080/ws`;
  } catch {
    return 'ws://localhost:8080/ws';
  }
}

export const DEFAULT_GATEWAY_URL = getDefaultGatewayUrl();

import { resolveHttpBaseUrl } from '../api/urlUtils';

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

  // --- Strongly Typed Domain Accessors & Subscriptions ---

  private favoritesListeners = new Set<(favorites: string[]) => void>();
  private gatewayUrlListeners = new Set<(url: string) => void>();
  private throttleListeners = new Set<(throttleMs: number) => void>();
  private activePairListeners = new Set<(pair: string) => void>();

  public subscribeFavorites(listener: (favorites: string[]) => void): () => void {
    this.favoritesListeners.add(listener);
    return () => {
      this.favoritesListeners.delete(listener);
    };
  }

  private notifyFavorites(favorites: string[]): void {
    for (const listener of this.favoritesListeners) {
      try {
        listener(favorites);
      } catch (err) {
        console.error('[StorageRepository] Error in favorites listener:', err);
      }
    }
  }

  public subscribeGatewayUrl(listener: (url: string) => void): () => void {
    this.gatewayUrlListeners.add(listener);
    return () => {
      this.gatewayUrlListeners.delete(listener);
    };
  }

  private notifyGatewayUrl(url: string): void {
    for (const listener of this.gatewayUrlListeners) {
      try {
        listener(url);
      } catch (err) {
        console.error('[StorageRepository] Error in gatewayUrl listener:', err);
      }
    }
  }

  public subscribeClientThrottle(listener: (throttleMs: number) => void): () => void {
    this.throttleListeners.add(listener);
    return () => {
      this.throttleListeners.delete(listener);
    };
  }

  private notifyClientThrottle(throttleMs: number): void {
    for (const listener of this.throttleListeners) {
      try {
        listener(throttleMs);
      } catch (err) {
        console.error('[StorageRepository] Error in clientThrottle listener:', err);
      }
    }
  }

  public subscribeActivePair(listener: (pair: string) => void): () => void {
    this.activePairListeners.add(listener);
    return () => {
      this.activePairListeners.delete(listener);
    };
  }

  private notifyActivePair(pair: string): void {
    for (const listener of this.activePairListeners) {
      try {
        listener(pair);
      } catch (err) {
        console.error('[StorageRepository] Error in activePair listener:', err);
      }
    }
  }

  public getFavorites(): string[] {
    const favs = this.get<string[]>(STORAGE_KEYS.FAVORITES);
    if (Array.isArray(favs)) {
      return favs;
    }
    return DEFAULT_FAVORITES;
  }

  public setFavorites(favorites: string[]): void {
    this.set(STORAGE_KEYS.FAVORITES, favorites);
    this.notifyFavorites(favorites);
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
    if (this.getClientThrottle() === clamped) {
      return;
    }
    this.set(STORAGE_KEYS.THROTTLE_INTERVAL, clamped);
    this.notifyClientThrottle(clamped);
  }

  public getGatewayUrl(): string {
    const val = this.get<string>(STORAGE_KEYS.GATEWAY_URL);
    return val || process.env.EXPO_PUBLIC_GATEWAY_URL || DEFAULT_GATEWAY_URL;
  }

  public setGatewayUrl(url: string): void {
    if (this.getGatewayUrl() === url) {
      return;
    }
    this.set(STORAGE_KEYS.GATEWAY_URL, url);
    this.notifyGatewayUrl(url);
  }

  public getHttpGatewayUrl(): string {
    return resolveHttpBaseUrl(this.getGatewayUrl());
  }

  public getActivePair(): string {
    const val = this.get<string>(STORAGE_KEYS.ACTIVE_PAIR);
    return val || 'BTCUSDT';
  }

  public setActivePair(symbol: string): void {
    if (this.getActivePair() === symbol) {
      return;
    }
    this.set(STORAGE_KEYS.ACTIVE_PAIR, symbol);
    this.notifyActivePair(symbol);
  }
}

export const defaultStorage = new StorageRepository();
