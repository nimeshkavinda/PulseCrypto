import { describe, it, expect, beforeEach } from 'vitest';
import { StorageRepository, DEFAULT_FAVORITES, DEFAULT_THROTTLE_MS } from '../src/storage/storageRepository.js';

describe('StorageRepository Synchronous Persistence (Task T3.4)', () => {
  let storage: StorageRepository;

  beforeEach(() => {
    storage = new StorageRepository();
    storage.clearAll();
  });

  it('should return default favorites when no favorites are saved', () => {
    const favorites = storage.getFavorites();
    expect(favorites).toEqual(DEFAULT_FAVORITES);
  });

  it('should persist and retrieve custom favorites list', () => {
    storage.setFavorites(['DOGEUSDT', 'XRPUSDT']);
    expect(storage.getFavorites()).toEqual(['DOGEUSDT', 'XRPUSDT']);
  });

  it('should toggle favorites accurately', () => {
    // Start with default ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
    expect(storage.isFavorite('BTCUSDT')).toBe(true);

    // Toggle off
    const isNowFav = storage.toggleFavorite('BTCUSDT');
    expect(isNowFav).toBe(false);
    expect(storage.isFavorite('BTCUSDT')).toBe(false);

    // Toggle on
    const isFavAgain = storage.toggleFavorite('BTCUSDT');
    expect(isFavAgain).toBe(true);
    expect(storage.isFavorite('BTCUSDT')).toBe(true);
  });

  it('should clamp and persist client throttle interval (10ms - 1000ms)', () => {
    expect(storage.getClientThrottle()).toBe(DEFAULT_THROTTLE_MS);

    storage.setClientThrottle(250);
    expect(storage.getClientThrottle()).toBe(250);

    // Clamp below 10
    storage.setClientThrottle(2);
    expect(storage.getClientThrottle()).toBe(10);

    // Clamp above 1000
    storage.setClientThrottle(5000);
    expect(storage.getClientThrottle()).toBe(1000);
  });

  it('should handle generic key-value serialization and deletion', () => {
    storage.set('test_key', { hello: 'world', count: 42 });
    expect(storage.get('test_key')).toEqual({ hello: 'world', count: 42 });

    storage.delete('test_key');
    expect(storage.get('test_key')).toBeNull();
  });

  it('should retrieve default gateway URL when unset', () => {
    const originalEnv = process.env.EXPO_PUBLIC_GATEWAY_URL;
    delete process.env.EXPO_PUBLIC_GATEWAY_URL;
    try {
      expect(storage.getGatewayUrl()).toBe('ws://10.0.2.2:8080/ws');
    } finally {
      if (originalEnv !== undefined) {
        process.env.EXPO_PUBLIC_GATEWAY_URL = originalEnv;
      }
    }
  });

  it('should prioritize EXPO_PUBLIC_GATEWAY_URL env variable over default when unset in storage', () => {
    const originalEnv = process.env.EXPO_PUBLIC_GATEWAY_URL;
    try {
      process.env.EXPO_PUBLIC_GATEWAY_URL = 'ws://192.168.1.100:8080/ws';
      expect(storage.getGatewayUrl()).toBe('ws://192.168.1.100:8080/ws');
    } finally {
      if (originalEnv !== undefined) {
        process.env.EXPO_PUBLIC_GATEWAY_URL = originalEnv;
      } else {
        delete process.env.EXPO_PUBLIC_GATEWAY_URL;
      }
    }
  });

  it('should prioritize explicit storage override over EXPO_PUBLIC_GATEWAY_URL and default', () => {
    const originalEnv = process.env.EXPO_PUBLIC_GATEWAY_URL;
    try {
      process.env.EXPO_PUBLIC_GATEWAY_URL = 'ws://192.168.1.100:8080/ws';
      storage.setGatewayUrl('ws://custom-domain.com:8080/ws');
      expect(storage.getGatewayUrl()).toBe('ws://custom-domain.com:8080/ws');
    } finally {
      if (originalEnv !== undefined) {
        process.env.EXPO_PUBLIC_GATEWAY_URL = originalEnv;
      } else {
        delete process.env.EXPO_PUBLIC_GATEWAY_URL;
      }
    }
  });
});
