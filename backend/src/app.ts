import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export interface AppOptions {
  enableLogger?: boolean;
}

/**
 * Builds and configures the Fastify application instance.
 * Separated from server listening to enable fast, isolated integration testing.
 */
export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const isDev = process.env.NODE_ENV !== 'production';
  const shouldLog = options.enableLogger ?? isDev;

  const app = Fastify({
    logger: shouldLog
      ? {
          level: isDev ? 'info' : 'warn',
          transport: isDev
            ? {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
              }
            : undefined,
        }
      : false,
  });

  // CORS: open in development for local Android Emulator & Expo dev client.
  // TODO: Lock down allowed origins to specific production domains when deployed.
  await app.register(cors, {
    origin: isDev ? true : (process.env.ALLOWED_ORIGINS?.split(',') || true),
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Health check endpoint (satisfies Docker healthcheck & monitoring)
  app.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
    };
  });

  return app;
}
