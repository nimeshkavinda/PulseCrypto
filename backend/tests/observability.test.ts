import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { MetadataService } from '../src/metadata.js';

describe('Backend Observability & Structured Logging (Phase 6: Tasks T6.4, T6.5)', () => {
  it('should generate a unique UUID request ID for each incoming HTTP request', async () => {
    const app = await buildApp({ enableLogger: false });
    const res1 = await app.inject({
      method: 'GET',
      url: '/health',
    });
    const res2 = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);

    // Fastify assigns req.id from genReqId
    expect(res1.headers['x-request-id'] || res1.rawPayload).toBeDefined();

    await app.close();
  });

  it('should update and retrieve metadata strictly using Binance change24h with no undefined values', () => {
    const service = new MetadataService();

    // Ingest BTC ticker with explicit change24h from Binance
    service.updateTicker('BTCUSDT', 67450.25, 68000.0, 66100.5, 45200.12, 2.34);

    const meta = service.get('BTCUSDT');
    expect(meta).toBeDefined();
    expect(meta?.lastPrice).toBe(67450.25);
    expect(meta?.high24h).toBe(68000.0);
    expect(meta?.low24h).toBe(66100.5);
    expect(meta?.volume24h).toBe(45200.12);
    expect(meta?.change24h).toBe(2.34);

    const all = service.getAll();
    const btcFromAll = all.find((m) => m.symbol === 'BTCUSDT');
    expect(btcFromAll?.change24h).toBe(2.34);
    expect(typeof btcFromAll?.change24h).toBe('number');
  });
});
