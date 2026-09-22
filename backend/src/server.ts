import { buildApp } from './app.js';
import { defaultMetadataService } from './metadata.js';
import { defaultMetrics } from './metrics.js';
import { defaultOrderBookManager } from './orderbook.js';
import { defaultConflator } from './conflator.js';
import { BinanceConnector } from './binance.js';

import { config } from './config.js';

async function main() {
  const metadataService = defaultMetadataService;
  const metricsRegistry = defaultMetrics;
  const orderBookManager = defaultOrderBookManager;
  const conflator = defaultConflator;

  // Initialize and connect to Binance WebSocket streams
  const binance = new BinanceConnector({ metrics: metricsRegistry });
  binance
    .onDepth((symbol, bids, asks) => {
      orderBookManager.updateDepth(symbol, bids, asks);
    })
    .onTicker((updates) => {
      for (const update of updates) {
        metadataService.updateFromMiniTicker(
          update.symbol,
          update.lastPrice,
          update.high24h,
          update.low24h,
          update.volume24h
        );
      }
    })
    .onStatus((connected) => {
      if (connected) {
        console.log('[PulseCrypto Gateway] Connected to Binance upstream streams.');
      } else {
        console.log('[PulseCrypto Gateway] Disconnected from Binance upstream.');
      }
    });

  binance.connect();

  // Start the conflation engine emission timer
  conflator.start();
  console.log(`[PulseCrypto Gateway] Conflation engine started (cadence: ${conflator.flushIntervalMs}ms).`);

  const server = await buildApp({
    enableLogger: true,
    metadataService,
    metricsRegistry,
    conflationEngine: conflator,
  });

  const port = config.PORT;
  const host = config.HOST;

  const shutdown = async (signal: string) => {
    server.log.info(`[PulseCrypto Gateway] Received ${signal}, closing gracefully...`);
    try {
      conflator.stop();
      binance.disconnect();
      await server.close();
      server.log.info('[PulseCrypto Gateway] Closed successfully.');
      process.exit(0);
    } catch (err) {
      server.log.error(err, '[PulseCrypto Gateway] Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  try {
    await server.listen({ port, host });
    server.log.info(`[PulseCrypto Gateway] Server running on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err, '[PulseCrypto Gateway] Startup error');
    process.exit(1);
  }
}

void main();
