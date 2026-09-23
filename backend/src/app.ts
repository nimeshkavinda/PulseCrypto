import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { MetadataService } from './metadata.js';
import { MetricsRegistry } from './metrics.js';
import { OrderBookManager } from './orderbook.js';
import { ChannelHub } from './hub/ChannelHub.js';
import { InMemoryMarketSource, StatusTracker } from './market/marketSource.js';
import { AppConfig, config as defaultConfig } from './config.js';
import { healthRoutes, Readiness } from './http/health.routes.js';
import { metaRoutes } from './http/meta.routes.js';
import { streamRoutes } from './ws/stream.routes.js';

export interface AppOptions {
  enableLogger?: boolean;
  config?: AppConfig;
  metadataService?: MetadataService;
  metricsRegistry?: MetricsRegistry;
  hub?: ChannelHub;
  /** Readiness probe; defaults to "metadata loaded". The composition root adds upstream status. */
  readiness?: () => Readiness;
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
      maxConnections: config.WS_MAX_CONNECTIONS,
      rateLimitBurst: config.WS_RATE_LIMIT_BURST,
      rateLimitPerSec: config.WS_RATE_LIMIT_PER_SEC,
    });
  const readiness =
    options.readiness ??
    (() => (metadata.isReady() ? { ready: true, reasons: [] } : { ready: false, reasons: ['metadata not loaded'] }));

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

  const allowedOrigins = config.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

  // CORS: open in development for local Android Emulator & Expo dev client.
  await app.register(cors, {
    origin: isDev || allowedOrigins.includes('*') ? true : allowedOrigins,
    methods: ['GET', 'OPTIONS'],
  });

  // Inbound client messages are tiny JSON commands; anything larger closes the socket with 1009.
  await app.register(websocket, { options: { maxPayload: config.WS_MAX_PAYLOAD_BYTES } });

  await app.register(healthRoutes, { hub, readiness });
  await app.register(metaRoutes, { metadata });
  await app.register(streamRoutes, { hub, metrics, allowedOrigins });

  return app;
}
