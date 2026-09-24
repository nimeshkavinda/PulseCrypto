import { buildApp } from './app.js';
import { MetadataService } from './metadata.js';
import { defaultMetrics } from './metrics.js';
import { OrderBookManager } from './orderbook.js';
import { BinanceConnector } from './binance.js';
import { ChannelHub } from './hub/ChannelHub.js';
import { InMemoryMarketSource, StatusTracker } from './market/marketSource.js';
import { config } from './config.js';

/** Composition root: wires upstream ingestion -> market state -> channel hub -> HTTP/WS server. */
async function main() {
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

  const server = await buildApp({
    enableLogger: true,
    config,
    metadataService: metadata,
    metricsRegistry: metrics,
    hub,
  });

  const binance = new BinanceConnector({ metrics });
  binance
    .onDepth((symbol, bids, asks) => {
      books.updateDepth(symbol, bids, asks);
    })
    .onTrade((symbol, price) => {
      metadata.updateTradePrice(symbol, price);
    })
    .onTicker((updates) => {
      for (const update of updates) {
        if (update.change24h !== undefined) {
          metadata.updateTicker(
            update.symbol,
            update.lastPrice,
            update.high24h,
            update.low24h,
            update.volume24h,
            update.change24h
          );
        } else {
          metadata.updateFromMiniTicker(
            update.symbol,
            update.lastPrice,
            update.high24h,
            update.low24h,
            update.volume24h
          );
        }
      }
    })
    .onStatus((connected) => {
      status.set(connected ? 'live' : 'down');
      server.log.info({ upstream: connected ? 'live' : 'down' }, 'Binance upstream status changed');
    });

  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down`);
    try {
      hub.stop();
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
    binance.connect();
    hub.start();
    server.log.info(
      { tickMs: config.FLUSH_INTERVAL_MS, ws: `ws://${config.HOST}:${config.PORT}/ws` },
      'PulseCrypto gateway ready'
    );
  } catch (err) {
    server.log.error(err, 'Startup error');
    process.exit(1);
  }
}

void main();
