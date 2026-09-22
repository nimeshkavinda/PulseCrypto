import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { WebSocket } from 'ws';
import { defaultMetadataService, MetadataService } from './metadata.js';
import { defaultMetrics, MetricsRegistry } from './metrics.js';
import { defaultConflator, ConflationEngine } from './conflator.js';

export interface AppOptions {
  enableLogger?: boolean;
  metadataService?: MetadataService;
  metricsRegistry?: MetricsRegistry;
  conflationEngine?: ConflationEngine;
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
  const conflator = options.conflationEngine ?? defaultConflator;

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
      clientsConnected: conflator.getConnectedClientCount(),
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

  type WebSocketConnection = WebSocket | { socket: WebSocket };

  const wsRouteHandler = (connection: WebSocketConnection) => {
    const socket: WebSocket = 'socket' in connection ? connection.socket : connection;
    conflator.handleConnection(socket);
  };

  const wsOptions = { websocket: true } as unknown as Parameters<typeof app.get>[1];

  app.get('/ws', wsOptions, wsRouteHandler as unknown as Parameters<typeof app.get>[2]);
  app.get('/stream', wsOptions, wsRouteHandler as unknown as Parameters<typeof app.get>[2]);

  return app;
}
