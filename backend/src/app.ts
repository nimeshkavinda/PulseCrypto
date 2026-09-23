import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { MetadataService } from './metadata.js';
import { MetricsRegistry } from './metrics.js';
import { OrderBookManager } from './orderbook.js';
import { ChannelHub } from './hub/ChannelHub.js';
import { InMemoryMarketSource, StatusTracker } from './market/marketSource.js';
import { AppConfig, config as defaultConfig } from './config.js';
import { healthRoutes } from './http/health.routes.js';
import { metaRoutes } from './http/meta.routes.js';
import { metricsRoutes } from './http/metrics.routes.js';
import { streamRoutes } from './ws/stream.routes.js';

export interface AppOptions {
  enableLogger?: boolean;
  config?: AppConfig;
  metadataService?: MetadataService;
  metricsRegistry?: MetricsRegistry;
  hub?: ChannelHub;
}

/**
 * Fastify application factory: registers plugins (CORS, WebSocket) and mounts HTTP and WS routes.
 * Collaborators are injected; anything omitted gets a fresh instance (no shared module state).
 */
export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? defaultConfig;
  const isDev = config.NODE_ENV !== 'production';
  const shouldLog = options.enableLogger ?? isDev;
  const metadata = options.metadataService ?? new MetadataService();
  const metrics = options.metricsRegistry ?? new MetricsRegistry();
  const hub =
    options.hub ??
    new ChannelHub({
      source: new InMemoryMarketSource(metadata, new OrderBookManager(), new StatusTracker()),
      metrics,
      tickMs: config.FLUSH_INTERVAL_MS,
      softLimitBytes: config.WS_SOFT_LIMIT_BYTES,
      hardLimitBytes: config.WS_HARD_LIMIT_BYTES,
      lagGraceMs: config.WS_LAG_GRACE_MS,
    });

  const app = Fastify({
    genReqId: (req) => (req.headers['x-request-id'] as string) || `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    logger: shouldLog
      ? {
          level: isDev ? 'info' : 'warn',
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          serializers: {
            req(req) {
              return {
                method: req.method,
                url: req.url,
                id: req.id,
                remoteAddress: req.ip,
              };
            },
          },
        }
      : false,
  });

  // CORS: open in development for local Android Emulator & Expo dev client.
  await app.register(cors, {
    origin: isDev ? true : (config.ALLOWED_ORIGINS === '*' ? true : config.ALLOWED_ORIGINS.split(',')),
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  await app.register(websocket);

  await app.register(healthRoutes, { hub });
  await app.register(metaRoutes, { metadata });
  await app.register(metricsRoutes, { metrics });
  await app.register(streamRoutes, { hub });

  return app;
}
