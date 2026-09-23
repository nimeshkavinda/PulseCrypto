import { SUPPORTED_PAIRS, SupportedPairSymbol } from '@pulsecrypto/shared';
import { buildApp } from './app.js';
import { MetadataService } from './metadata.js';
import { defaultMetrics } from './metrics.js';
import { OrderBookManager } from './orderbook.js';
import { BinanceConnector } from './binance.js';
import { ChannelHub } from './hub/ChannelHub.js';
import { InMemoryMarketSource, StatusTracker } from './market/marketSource.js';
import { createBinanceRestClient } from './market/binanceRest.js';
import { MetadataBootstrap } from './market/bootstrap.js';
import { FreshnessMonitor } from './market/freshness.js';
import { config } from './config.js';

/** Composition root: upstream ingestion -> market state -> channel hub -> HTTP/WS server. */
async function main() {
  const pairs = Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[];
  const metrics = defaultMetrics;
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
  });

  const server = await buildApp({ enableLogger: true, config, metadataService: metadata, metricsRegistry: metrics, hub });

  const freshness = new FreshnessMonitor({
    status,
    pairs,
    lastUpdateAt: (pair) => books.getUpdatedAt(pair),
    staleAfterMs: config.STALE_AFTER_MS,
  });

  const bootstrap = new MetadataBootstrap({
    rest: createBinanceRestClient({ baseUrl: config.BINANCE_REST_URL }),
    metadata,
    pairs,
    logger: server.log,
  });

  const binance = new BinanceConnector({ wsBaseUrl: config.BINANCE_WS_URL, pairs, metrics })
    .onDepth((pair, bids, asks) => books.updateDepth(pair, bids, asks))
    .onTrade((pair, price, tradeTs) => metadata.applyTrade(pair, price, tradeTs))
    .onTicker((pair, ticker) => metadata.applyTicker24h(pair, ticker))
    .onStatus((connected) => {
      freshness.setConnected(connected);
      server.log.info({ upstream: connected ? 'connected' : 'disconnected' }, 'Binance stream connection changed');
    });

  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down`);
    try {
      hub.stop();
      freshness.stop();
      bootstrap.stop();
      binance.disconnect();
      await server.close();
      process.exit(0);
    } catch (err) {
      server.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await server.listen({ port: config.PORT, host: config.HOST });
    bootstrap.start();
    binance.connect();
    freshness.start();
    hub.start();
    server.log.info(
      { tickMs: config.FLUSH_INTERVAL_MS, ws: `ws://${config.HOST}:${config.PORT}/ws`, upstream: binance.streamUrl.split('?')[0] },
      'PulseCrypto gateway ready'
    );
  } catch (err) {
    server.log.error(err, 'Startup error');
    process.exit(1);
  }
}

void main();
