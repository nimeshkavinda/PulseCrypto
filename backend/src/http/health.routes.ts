import { FastifyInstance } from 'fastify';
import { ChannelHub } from '../hub/ChannelHub.js';

export interface Readiness {
  ready: boolean;
  /** Human-readable reasons the gateway is not ready (empty when ready). */
  reasons: string[];
}

export interface HealthRoutesOptions {
  hub: ChannelHub;
  readiness: () => Readiness;
}

/**
 * - `/health`: liveness. The process is up and serving HTTP (restart if it fails).
 * - `/ready`: readiness. Metadata has loaded and the upstream feed is live or partially stale,
 *   so the instance has real data to serve (take it out of the load balancer if it fails).
 */
export async function healthRoutes(app: FastifyInstance, options: HealthRoutesOptions): Promise<void> {
  app.get('/health', { logLevel: 'warn' }, async () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    clientsConnected: options.hub.getConnectedClientCount(),
  }));

  app.get('/ready', { logLevel: 'warn' }, async (_req, reply) => {
    const r = options.readiness();
    return reply.code(r.ready ? 200 : 503).send({ ready: r.ready, reasons: r.reasons });
  });
}
