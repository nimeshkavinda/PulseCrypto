import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { MetadataService } from '../src/metadata.js';
import { MetricsRegistry } from '../src/metrics.js';
import { PairMetadataSchema } from '@pulsecrypto/shared';

describe('Fastify HTTP Server & Routes (Task T2.1)', () => {
  it('should return 200 and valid health payload on GET /health', async () => {
    const app = await buildApp({ enableLogger: false });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.status).toBe('ok');
    expect(typeof data.uptime).toBe('number');
    expect(typeof data.timestamp).toBe('number');
    await app.close();
  });

  it('should return 200 and all 5 pairs metadata conforming to PairMetadataSchema on GET /pairs/meta', async () => {
    const app = await buildApp({ enableLogger: false });
    const response = await app.inject({ method: 'GET', url: '/pairs/meta' });

    expect(response.statusCode).toBe(200);
    const pairs = JSON.parse(response.body);
    expect(Array.isArray(pairs)).toBe(true);
    expect(pairs).toHaveLength(5);

    // Verify every single pair conforms to shared Zod schema
    for (const pair of pairs) {
      const parsed = PairMetadataSchema.safeParse(pair);
      expect(parsed.success).toBe(true);
    }

    const symbols = pairs.map((p: { symbol: string }) => p.symbol);
    expect(symbols).toContain('BTCUSDT');
    expect(symbols).toContain('ETHUSDT');
    expect(symbols).toContain('SOLUSDT');
    expect(symbols).toContain('DOGEUSDT');
    expect(symbols).toContain('XRPUSDT');

    await app.close();
  });

  it('should update pair metadata dynamically via MetadataService', () => {
    const metadataService = new MetadataService();
    metadataService.updateFromMiniTicker('BTCUSDT', 67000.0, 68000.0, 63000.0, 31000.0);

    const btc = metadataService.get('BTCUSDT');
    expect(btc).toBeDefined();
    expect(btc?.lastPrice).toBe(67000.0);
    expect(btc?.high24h).toBe(68000.0);
    expect(btc?.low24h).toBe(63000.0);
    expect(btc?.volume24h).toBe(31000.0);
  });

  it('should return 200 and Prometheus metrics on GET /metrics', async () => {
    const metricsRegistry = new MetricsRegistry();
    metricsRegistry.connectedClients.set(4);
    metricsRegistry.wsMessagesReceived.inc({ stream: 'depth', symbol: 'BTCUSDT' }, 10);

    const app = await buildApp({ enableLogger: false, metricsRegistry });
    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('pulsecrypto_connected_clients 4');
    expect(response.body).toContain('pulsecrypto_ws_messages_received_total{stream="depth",symbol="BTCUSDT"} 10');

    await app.close();
  });
});
