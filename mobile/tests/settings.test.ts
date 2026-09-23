import { describe, it, expect, beforeEach } from 'vitest';
import {
  StorageRepository,
  DEFAULT_FAVORITES,
  DEFAULT_THROTTLE_MS,
  DEFAULT_GATEWAY_URL,
} from '../src/storage/storageRepository';

describe('Settings & Storage Repository (Phase 6: Tasks T6.1, T6.3, ADR 4)', () => {
  let storage: StorageRepository;

  beforeEach(() => {
    storage = new StorageRepository();
    storage.clearAll();
  });

  describe('Storage Flags & Settings Persistence', () => {
    it('should default binary compression to true as specified in Mockup 2', () => {
      expect(storage.getBinaryCompression()).toBe(true);
    });

    it('should persist and retrieve binary compression flag', () => {
      storage.setBinaryCompression(false);
      expect(storage.getBinaryCompression()).toBe(false);
      storage.setBinaryCompression(true);
      expect(storage.getBinaryCompression()).toBe(true);
    });

    it('should default adaptive polling to false as specified in Mockup 2', () => {
      expect(storage.getAdaptivePolling()).toBe(false);
    });

    it('should persist and retrieve adaptive polling flag', () => {
      storage.setAdaptivePolling(true);
      expect(storage.getAdaptivePolling()).toBe(true);
      storage.setAdaptivePolling(false);
      expect(storage.getAdaptivePolling()).toBe(false);
    });

    it('should calculate storage statistics (key count and bytes)', () => {
      const initialStats = storage.getStorageStats();
      expect(initialStats.keysCount).toBe(0);
      expect(initialStats.estimatedBytes).toBe(0);
      expect(initialStats.isMeasured).toBe(true);

      storage.setFavorites(['BTCUSDT', 'ETHUSDT']);
      storage.setClientThrottle(250);

      const updatedStats = storage.getStorageStats();
      expect(updatedStats.keysCount).toBe(2);
      expect(updatedStats.estimatedBytes).toBeGreaterThan(0);
      expect(updatedStats.isMeasured).toBe(true);
    });

    it('should auto-initialize default configuration keys upon instantiation', () => {
      const freshStorage = new StorageRepository();
      const stats = freshStorage.getStorageStats();
      expect(stats.keysCount).toBe(6);
      expect(stats.isMeasured).toBe(true);
      expect(stats.estimatedBytes).toBeGreaterThan(0);
    });

    it('should report isMeasured false and zeros if backend does not support key listing', () => {
      const restrictedBackend = {
        getString: () => undefined,
        set: () => {},
        delete: () => {},
        clearAll: () => {},
      };
      const unmeasuredStorage = new StorageRepository(restrictedBackend);
      const stats = unmeasuredStorage.getStorageStats();
      expect(stats.isMeasured).toBe(false);
      expect(stats.keysCount).toBe(0);
      expect(stats.estimatedKb).toBe(0);
    });

    it('should reset all settings and preferences back to default on resetDefaults()', () => {
      storage.setFavorites(['DOGEUSDT']);
      storage.setClientThrottle(500);
      storage.setGatewayUrl('ws://custom-proxy:9999/ws');
      storage.setBinaryCompression(false);
      storage.setAdaptivePolling(true);

      expect(storage.getFavorites()).toEqual(['DOGEUSDT']);
      expect(storage.getClientThrottle()).toBe(500);
      expect(storage.getGatewayUrl()).toBe('ws://custom-proxy:9999/ws');
      expect(storage.getBinaryCompression()).toBe(false);
      expect(storage.getAdaptivePolling()).toBe(true);

      storage.resetDefaults();

      expect(storage.getFavorites()).toEqual(DEFAULT_FAVORITES);
      expect(storage.getClientThrottle()).toBe(DEFAULT_THROTTLE_MS);
      expect(storage.getGatewayUrl()).toBe(DEFAULT_GATEWAY_URL);
      expect(storage.getBinaryCompression()).toBe(true);
      expect(storage.getAdaptivePolling()).toBe(false);
    });

    it('should clamp throttle values between 10ms and 1000ms bounds', () => {
      storage.setClientThrottle(5);
      expect(storage.getClientThrottle()).toBe(10);

      storage.setClientThrottle(1500);
      expect(storage.getClientThrottle()).toBe(1000);

      storage.setClientThrottle(100);
      expect(storage.getClientThrottle()).toBe(100);
    });
  });
});
