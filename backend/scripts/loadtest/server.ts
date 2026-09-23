/**
 * Load-test gateway: the real Fastify app + ChannelHub fed by a synthetic market (no Binance).
 * Feed rates match Binance's order of magnitude: per pair, depth every 100 ms, a trade every
 * 20 ms and a 24h ticker every second. Exposes GET /stats on METRICS_PORT for the runner.
 */
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { SUPPORTED_PAIRS, SupportedPairSymbol } from '@pulsecrypto/shared';
import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { MetadataService } from '../../src/metadata.js';
import { MetricsRegistry } from '../../src/metrics.js';
import { OrderBookManager } from '../../src/orderbook.js';
import { ChannelHub } from '../../src/hub/ChannelHub.js';
import { InMemoryMarketSource, StatusTracker } from '../../src/market/marketSource.js';
import { buildMetricsApp } from '../../src/http/metrics.routes.js';

const config = loadConfig({ ...process.env, NODE_ENV: 'production' });
const pairs = Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[];
const metrics = new MetricsRegistry();
const metadata = new MetadataService();
const books = new OrderBookManager();
const status = new StatusTracker();

const hub = new ChannelHub({
  source: new InMemoryMarketSource(metadata, books, status),
  metrics,
  tickMs: config.FLUSH_INTERVAL_MS,
  softLimitBytes: config.WS_SOFT_LIMIT_BYTES,
  hardLimitBytes: config.WS_HARD_LIMIT_BYTES,
  lagGraceMs: config.WS_LAG_GRACE_MS,
  maxConnections: config.WS_MAX_CONNECTIONS,
  rateLimitBurst: config.WS_RATE_LIMIT_BURST,
  rateLimitPerSec: config.WS_RATE_LIMIT_PER_SEC,
  heartbeatMs: config.WS_HEARTBEAT_MS,
});

// --- Tick timing -----------------------------------------------------------
let tickSamples: number[] = [];
const originalTick = hub.tick.bind(hub);
hub.tick = () => {
  const t0 = performance.now();
  originalTick();
  tickSamples.push(performance.now() - t0);
};

// --- Synthetic market ------------------------------------------------------
const base: Record<SupportedPairSymbol, number> = { BTCUSDT: 86000, ETHUSDT: 2740, SOLUSDT: 118, DOGEUSDT: 0.1011, XRPUSDT: 1.62 };
const price = { ...base };
let now = Date.now();
for (const p of pairs) {
  const c = SUPPORTED_PAIRS[p];
  metadata.applyExchangeInfo(p, { displayName: c.displayName, baseAsset: c.baseAsset, quoteAsset: c.quoteAsset, tradingStatus: 'TRADING', priceDecimals: c.priceDecimals, qtyDecimals: c.qtyDecimals });
  metadata.applyTicker24h(p, { lastPrice: price[p], high24h: price[p] * 1.02, low24h: price[p] * 0.98, volume24h: 1e6, changePct: 0.5, eventTs: now });
}
status.set('live');

const walk = (p: SupportedPairSymbol) => (price[p] = Math.max(base[p] * 0.5, price[p] * (1 + (Math.random() - 0.5) * 0.0004)));
setInterval(() => {
  now = Date.now();
  for (const p of pairs) metadata.applyTrade(p, Number(walk(p).toPrecision(8)), now);
}, 20);
setInterval(() => {
  for (const p of pairs) {
    const mid = price[p];
    const step = mid * 0.00005;
    const bids = Array.from({ length: 20 }, (_, i) => [mid - step * (i + 1), Math.random() * 5] as [number, number]);
    const asks = Array.from({ length: 20 }, (_, i) => [mid + step * (i + 1), Math.random() * 5] as [number, number]);
    books.updateDepth(p, bids, asks);
  }
}, 100);
setInterval(() => {
  for (const p of pairs) {
    metadata.applyTicker24h(p, { lastPrice: price[p], high24h: base[p] * 1.02, low24h: base[p] * 0.98, volume24h: 1e6, changePct: 0.5, eventTs: Date.now() - 1 });
  }
}, 1000);

// --- Stats endpoint ----------------------------------------------------------
const loopDelay = monitorEventLoopDelay({ resolution: 10 });
loopDelay.enable();
let cpuMark = process.cpuUsage();
let wallMark = performance.now();
let eluMark = performance.eventLoopUtilization();

const pct = (xs: number[], q: number) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

const metricsApp = buildMetricsApp(metrics);
metricsApp.get('/stats', async (req) => {
  const reset = (req.query as { reset?: string }).reset === '1';
  const cpu = process.cpuUsage(cpuMark);
  const wall = performance.now() - wallMark;
  const elu = performance.eventLoopUtilization(eluMark);
  const text = await metrics.getMetrics();
  const counter = (name: string) => Number(new RegExp(`^${name} (\\d+(?:\\.\\d+)?)$`, 'm').exec(text)?.[1] ?? 0);
  const out = {
    clients: hub.getConnectedClientCount(),
    cpuPercent: Number((((cpu.user + cpu.system) / 1000 / wall) * 100).toFixed(1)),
    eventLoopUtilization: Number(elu.utilization.toFixed(3)),
    eventLoopDelayP99Ms: Number((loopDelay.percentile(99) / 1e6).toFixed(2)),
    rssMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
    heapUsedMb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)),
    tickP50Ms: Number(pct(tickSamples, 0.5).toFixed(2)),
    tickP99Ms: Number(pct(tickSamples, 0.99).toFixed(2)),
    tickMaxMs: Number(Math.max(0, ...tickSamples).toFixed(2)),
    framesSent: counter('pulsecrypto_frames_sent_total'),
    framesDropped: counter('pulsecrypto_frames_dropped_total'),
    slowConsumerDisconnects: counter('pulsecrypto_slow_consumer_disconnects_total'),
    bytesSent: counter('pulsecrypto_bytes_sent_total'),
  };
  if (reset) {
    cpuMark = process.cpuUsage();
    wallMark = performance.now();
    eluMark = performance.eventLoopUtilization();
    tickSamples = [];
    loopDelay.reset();
  }
  return out;
});

const app = await buildApp({ enableLogger: false, config, metadataService: metadata, metricsRegistry: metrics, hub, readiness: () => ({ ready: true, reasons: [] }) });
await app.listen({ port: config.PORT, host: '127.0.0.1' });
await metricsApp.listen({ port: config.METRICS_PORT, host: '127.0.0.1' });
hub.start();
process.on('SIGTERM', () => process.exit(0));
process.send?.({ type: 'ready' });
