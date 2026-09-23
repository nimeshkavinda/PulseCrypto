import { describe, it, expect } from 'vitest';
import { PairMetadataSchema } from '@pulsecrypto/shared';
import { buildApp } from '../src/app.js';
import { MetadataService } from '../src/metadata.js';
import { MetricsRegistry } from '../src/metrics.js';
import { PAIRS, readyMetadata } from './helpers/market.js';

describe('HTTP routes', () => {
  it('GET /health returns liveness data', async () => {
    const app = await buildApp({ enableLogger: false });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', clientsConnected: 0 });
    await app.close();
  });

  it('GET /pairs/meta returns 503 with Retry-After until metadata is loaded', async () => {
    const app = await buildApp({ enableLogger: false, metadataService: new MetadataService() });
    const res = await app.inject({ method: 'GET', url: '/pairs/meta' });
    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('2');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.json()).toMatchObject({ error: 'METADATA_UNAVAILABLE' });
    await app.close();
  });

  it('GET /pairs/meta returns every pair with caching headers once ready', async () => {
    const app = await buildApp({ enableLogger: false, metadataService: readyMetadata() });
    const res = await app.inject({ method: 'GET', url: '/pairs/meta' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=2');
    expect(res.headers.etag).toMatch(/^W\/"meta-\d+"$/);
    const pairs = res.json();
    expect(pairs.map((p: { symbol: string }) => p.symbol)).toEqual(PAIRS);
    for (const p of pairs) expect(PairMetadataSchema.safeParse(p).success).toBe(true);
    await app.close();
  });

  it('GET /pairs/meta answers 304 for a matching If-None-Match and 200 after data changes', async () => {
    const metadata = readyMetadata();
    const app = await buildApp({ enableLogger: false, metadataService: metadata });
    const first = await app.inject({ method: 'GET', url: '/pairs/meta' });
    const etag = first.headers.etag as string;

    const cached = await app.inject({ method: 'GET', url: '/pairs/meta', headers: { 'if-none-match': etag } });
    expect(cached.statusCode).toBe(304);
    expect(cached.body).toBe('');

    metadata.applyTrade('BTCUSDT', 101, 10_000);
    const changed = await app.inject({ method: 'GET', url: '/pairs/meta', headers: { 'if-none-match': etag } });
    expect(changed.statusCode).toBe(200);
    expect(changed.headers.etag).not.toBe(etag);
    await app.close();
  });

  it('GET /pairs/meta strips fields not in the response schema', async () => {
    const metadata = readyMetadata();
    const original = metadata.getAll.bind(metadata);
    metadata.getAll = () => original().map((p) => ({ ...p, internal: 'secret' }));
    const app = await buildApp({ enableLogger: false, metadataService: metadata });
    const res = await app.inject({ method: 'GET', url: '/pairs/meta' });
    expect(res.body).not.toContain('secret');
    await app.close();
  });

  it('GET /metrics exposes Prometheus metrics', async () => {
    const metricsRegistry = new MetricsRegistry();
    metricsRegistry.connectedClients.set(4);
    metricsRegistry.wsMessagesReceived.inc({ stream: 'depth20', symbol: 'BTCUSDT' }, 10);
    const app = await buildApp({ enableLogger: false, metricsRegistry });
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain('pulsecrypto_connected_clients 4');
    expect(res.body).toContain('pulsecrypto_ws_messages_received_total{stream="depth20",symbol="BTCUSDT"} 10');
    await app.close();
  });
});
