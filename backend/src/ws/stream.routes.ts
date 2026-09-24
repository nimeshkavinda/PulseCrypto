import '@fastify/websocket';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ChannelHub } from '../hub/ChannelHub.js';
import { MetricsRegistry } from '../metrics.js';

export interface StreamRoutesOptions {
  hub: ChannelHub;
  metrics: MetricsRegistry;
  /** Browser origins allowed to connect; `['*']` allows any. Requests without an Origin (native apps) are always allowed. */
  allowedOrigins: string[];
}

/** Canonical market data stream. Protocol: docs/protocol.md */
export async function streamRoutes(app: FastifyInstance, options: StreamRoutesOptions): Promise<void> {
  const { hub, metrics, allowedOrigins } = options;
  const anyOrigin = allowedOrigins.includes('*');

  // Runs before the upgrade, so rejected clients get a plain HTTP status and never cost a socket.
  const preValidation = async (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin;
    if (origin && !anyOrigin && !allowedOrigins.includes(origin)) {
      metrics.upgradeRejections.inc({ reason: 'origin' });
      return reply.code(403).send({ error: 'ORIGIN_NOT_ALLOWED' });
    }
    if (!hub.hasCapacity()) {
      metrics.upgradeRejections.inc({ reason: 'capacity' });
      return reply.code(503).header('Retry-After', '5').send({ error: 'AT_CAPACITY' });
    }
  };

  app.get('/ws', { websocket: true, preValidation }, (socket) => {
    hub.attach(socket);
  });
}
