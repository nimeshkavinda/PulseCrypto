import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { defaultMetadataService, MetadataService } from './metadata.js';
import { defaultMetrics, MetricsRegistry } from './metrics.js';

export interface AppOptions {
  enableLogger?: boolean;
  metadataService?: MetadataService;
  metricsRegistry?: MetricsRegistry;
}

/**
 * Builds and configures the Fastify application instance.
 * Separated from server listening to enable fast, isolated integration testing.
 */
export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const isDev = process.env.NODE_ENV !== 'production';
  const shouldLog = options.enableLogger ?? isDev;
  const metadata = options.metadataService ?? defaultMetadataService;
  const metrics = options.metricsRegistry ?? defaultMetrics;

  const app = Fastify({
    logger: shouldLog
      ? {
          level: isDev ? 'info' : 'warn',
        }
      : false,
  });

  // CORS: open in development for local Android Emulator & Expo dev client.
  // TODO: Lock down allowed origins to specific production domains when deployed.
  await app.register(cors, {
    origin: isDev ? true : (process.env.ALLOWED_ORIGINS?.split(',') || true),
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  await app.register(websocket);

  // Health check endpoint (satisfies Docker healthcheck & monitoring)
  app.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
    };
  });

  // REST Trading pairs metadata (Part 1, Section 4 of brief)
  app.get('/pairs/meta', async () => {
    return metadata.getAll();
  });

  // Prometheus exposition metrics
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', metrics.getContentType());
    return metrics.getMetrics();
  });

  return app;
}
