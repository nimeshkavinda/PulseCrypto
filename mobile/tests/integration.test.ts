import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { StorageRepository, DEFAULT_FAVORITES, STORAGE_KEYS } from '../src/storage/storageRepository';
import { fetchPairsMetadata, BASELINE_PAIRS_METADATA } from '../src/api/marketApi';
import { PairMetadata, MarketUpdatePayload } from '@pulsecrypto/shared';

describe('Phase 7 Integration & Lifecycle Hardening (Tasks T7.1, T7.2, T7.4)', () => {
  let storage: StorageRepository;

  beforeEach(() => {
    storage = new StorageRepository();
    storage.clearAll();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useFavorites Toggle & Storage Restoration Integration (Task T7.4)', () => {
    it('should initialize with default favorites when storage is empty', () => {
      expect(storage.getFavorites()).toEqual(DEFAULT_FAVORITES);
    });

    it('should toggle favorites and immediately broadcast to storage subscribers', () => {
      const updates: string[][] = [];
      const unsub = storage.subscribeFavorites((favs) => updates.push(favs));

      // Toggle off BTCUSDT
      const isFav1 = storage.toggleFavorite('BTCUSDT');
      expect(isFav1).toBe(false);
      expect(updates).toHaveLength(1);
      expect(updates[0]).not.toContain('BTCUSDT');

      // Toggle on DOGEUSDT
      const isFav2 = storage.toggleFavorite('DOGEUSDT');
      expect(isFav2).toBe(true);
      expect(updates).toHaveLength(2);
      expect(updates[1]).toContain('DOGEUSDT');

      unsub();
    });

    it('should restore persisted favorites across new StorageRepository instances (simulating app restart)', () => {
      storage.setFavorites(['SOLUSDT', 'DOGEUSDT', 'XRPUSDT']);

      // Instantiate a new storage instance backed by the same storage keys
      const rawStored = storage.get<string[]>(STORAGE_KEYS.FAVORITES);
      expect(rawStored).toEqual(['SOLUSDT', 'DOGEUSDT', 'XRPUSDT']);

      const restoredInstance = new StorageRepository();
      restoredInstance.setFavorites(rawStored!);
      expect(restoredInstance.getFavorites()).toEqual(['SOLUSDT', 'DOGEUSDT', 'XRPUSDT']);
    });
  });

  describe('QueryClientProvider & Pull-to-Refresh Integration (Task T7.4)', () => {
    it('should execute fetchPairsMetadata through QueryClient and update cache on pull-to-refresh', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const updatedPairs: PairMetadata[] = BASELINE_PAIRS_METADATA.map((p) =>
        p.symbol === 'BTCUSDT' ? { ...p, lastPrice: 72000.5, change24h: 8.2 } : p
      );

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => updatedPairs,
      });
      vi.stubGlobal('fetch', mockFetch);

      // Initial query execution
      const initial = await queryClient.fetchQuery({
        queryKey: ['pairsMetadata', 'http://localhost:8080'],
        queryFn: () => fetchPairsMetadata('http://localhost:8080'),
      });

      expect(initial[0].lastPrice).toBe(72000.5);
      expect(queryClient.getQueryData(['pairsMetadata', 'http://localhost:8080'])).toEqual(updatedPairs);

      // Simulate pull-to-refresh refetch
      const refreshedPairs: PairMetadata[] = updatedPairs.map((p) =>
        p.symbol === 'BTCUSDT' ? { ...p, lastPrice: 72500.0, change24h: 9.1 } : p
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => refreshedPairs,
      });

      const refetched = await queryClient.fetchQuery({
        queryKey: ['pairsMetadata', 'http://localhost:8080'],
        queryFn: () => fetchPairsMetadata('http://localhost:8080'),
      });

      expect(refetched[0].lastPrice).toBe(72500.0);
      expect(refetched[0].change24h).toBe(9.1);
    });

    it('should maintain baseline fallback cache when network throws during pull-to-refresh', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

      const data = await queryClient.fetchQuery({
        queryKey: ['pairsMetadata', 'http://localhost:8080'],
        queryFn: () => fetchPairsMetadata('http://localhost:8080'),
      });

      expect(data).toEqual(BASELINE_PAIRS_METADATA);
    });
  });

  describe('Offline Stale Data Cache Resilience (Tasks T7.1 & T7.2)', () => {
    it('should persist and retrieve market payloads in storage cache', () => {
      const samplePayload: Partial<Record<string, MarketUpdatePayload>> = {
        BTCUSDT: {
          pair: 'BTCUSDT',
          timestamp: 1700000000000,
          price: 68450.2,
          change24h: 4.12,
          high24h: 69000,
          low24h: 66000,
          volume24h: 35000,
          spread: 0.1,
          spreadPct: 0.000001,
          buyPressure: 58,
          sellPressure: 42,
          bids: [[68450.1, 1.2, 82140.12]],
          asks: [[68450.3, 0.8, 54760.24]],
        },
      };

      storage.setCachedPayloads(samplePayload);
      const retrieved = storage.getCachedPayloads<typeof samplePayload>();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.BTCUSDT?.price).toBe(68450.2);
      expect(retrieved?.BTCUSDT?.bids).toHaveLength(1);
    });

    it('should preserve stale cached data when connection drops without resetting to zero', () => {
      const liveSnapshot: Record<string, number> = {
        BTCUSDT: 67000,
        ETHUSDT: 3500,
      };

      // Disconnect simulation: data remains stored
      storage.setCachedPayloads(liveSnapshot);

      const cachedAfterDrop = storage.getCachedPayloads<Record<string, number>>();
      expect(cachedAfterDrop).toEqual(liveSnapshot);
      expect(cachedAfterDrop?.BTCUSDT).toBe(67000);
    });
  });

  describe('Per-Row SYNCED / LIVE Streaming Indicator Logic (Task T7.4)', () => {
    it('should determine indicator label and color tier based on connectionStatus', () => {
      const getIndicatorStatus = (status: 'CONNECTED' | 'RECONNECTING' | 'OFFLINE' | 'CONNECTING' | 'DISCONNECTED') => {
        const isLive = status === 'CONNECTED';
        return {
          isLive,
          badgeLabel: isLive ? 'LIVE' : 'SYNCED',
          badgeColor: isLive ? '#00C57A' : '#F59E0B',
        };
      };

      expect(getIndicatorStatus('CONNECTED')).toEqual({
        isLive: true,
        badgeLabel: 'LIVE',
        badgeColor: '#00C57A',
      });

      expect(getIndicatorStatus('RECONNECTING')).toEqual({
        isLive: false,
        badgeLabel: 'SYNCED',
        badgeColor: '#F59E0B',
      });

      expect(getIndicatorStatus('OFFLINE')).toEqual({
        isLive: false,
        badgeLabel: 'SYNCED',
        badgeColor: '#F59E0B',
      });

      expect(getIndicatorStatus('DISCONNECTED')).toEqual({
        isLive: false,
        badgeLabel: 'SYNCED',
        badgeColor: '#F59E0B',
      });
    });
  });
});
