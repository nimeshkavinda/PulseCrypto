import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { defaultMetadataService, MetadataService } from './metadata.js';
import { defaultMetrics, MetricsRegistry } from './metrics.js';
import { defaultConflator, ConflationEngine } from './conflator.js';
import { config } from './config.js';
import { healthRoutes } from './http/health.routes.js';
import { metaRoutes } from './http/meta.routes.js';
import { metricsRoutes } from './http/metrics.routes.js';
import { streamRoutes } from './ws/stream.routes.js';

export interface AppOptions {
  enableLogger?: boolean;
  metadataService?: MetadataService;
  metricsRegistry?: MetricsRegistry;
  conflationEngine?: ConflationEngine;
}

/**
 * Fastify application composition root.
 * Creates Fastify instance, registers plugins (CORS, WebSocket), and mounts modular HTTP and WS routes.
 */
export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const isDev = config.NODE_ENV !== 'production';
  const shouldLog = options.enableLogger ?? isDev;
  const metadata = options.metadataService ?? defaultMetadataService;
  const metrics = options.metricsRegistry ?? defaultMetrics;
  const conflator = options.conflationEngine ?? defaultConflator;

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

  // Mount modular HTTP routes with injected services
  await app.register(healthRoutes, { conflator });
  await app.register(metaRoutes, { metadata });
  await app.register(metricsRoutes, { metrics });

  // Mount canonical WebSocket route (/ws)
  await app.register(streamRoutes, { conflator });

  return app;
}
