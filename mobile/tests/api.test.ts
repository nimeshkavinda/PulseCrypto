import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveHttpBaseUrl,
  fetchPairsMetadata,
  BASELINE_PAIRS_METADATA,
} from '../src/api/marketApi';
import { defaultStorage } from '../src/storage/storageRepository';
import { PairMetadataSchema } from '@pulsecrypto/shared';

describe('Market REST Client & URL Resolution (Task T4.4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve standard WebSocket URLs to clean HTTP URLs', () => {
    expect(resolveHttpBaseUrl('ws://localhost:8080/ws')).toBe('http://localhost:8080');
    expect(resolveHttpBaseUrl('ws://10.0.2.2:8080/ws')).toBe('http://10.0.2.2:8080');
    expect(resolveHttpBaseUrl('ws://192.168.1.50:8080/ws/')).toBe('http://192.168.1.50:8080');
    expect(resolveHttpBaseUrl('wss://stream.pulsecrypto.io/ws')).toBe('https://stream.pulsecrypto.io');
    expect(resolveHttpBaseUrl('http://localhost:8080')).toBe('http://localhost:8080');
  });

  it('StorageRepository.getHttpGatewayUrl should return correct HTTP base URL', () => {
    defaultStorage.setGatewayUrl('ws://10.0.2.2:8080/ws');
    expect(defaultStorage.getHttpGatewayUrl()).toBe('http://10.0.2.2:8080');

    defaultStorage.setGatewayUrl('ws://localhost:8080/ws');
    expect(defaultStorage.getHttpGatewayUrl()).toBe('http://localhost:8080');
  });

  it('BASELINE_PAIRS_METADATA should strictly conform to PairMetadataSchema for all 5 pairs', () => {
    expect(BASELINE_PAIRS_METADATA).toHaveLength(5);
    for (const meta of BASELINE_PAIRS_METADATA) {
      expect(() => PairMetadataSchema.parse(meta)).not.toThrow();
    }
  });

  it('should fetch and parse pairs metadata from mock endpoint', async () => {
    const mockData = [
      {
        symbol: 'BTCUSDT',
        displayName: 'BTC / USDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        tradingStatus: 'TRADING',
        priceDecimals: 2,
        qtyDecimals: 5,
        high24h: 70000,
        low24h: 60000,
        volume24h: 12345,
        lastPrice: 65000,
        change24h: 3.5,
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchPairsMetadata('http://localhost:8080');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/pairs/meta',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTCUSDT');
    expect(result[0].lastPrice).toBe(65000);
  });

  it('should fall back gracefully to BASELINE_PAIRS_METADATA if endpoint returns 500', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchPairsMetadata('http://localhost:8080');
    expect(result).toEqual(BASELINE_PAIRS_METADATA);
  });

  it('should fall back gracefully to BASELINE_PAIRS_METADATA if network throws', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network connection refused'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchPairsMetadata('http://localhost:8080');
    expect(result).toEqual(BASELINE_PAIRS_METADATA);
  });
});
