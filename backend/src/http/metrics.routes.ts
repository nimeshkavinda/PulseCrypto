import Fastify, { FastifyInstance } from 'fastify';
import { MetricsRegistry } from '../metrics.js';

/**
 * Prometheus metrics on a separate Fastify instance, bound to METRICS_PORT.
 * Keeping it off the public port means it is reachable from the cluster network (scrapers)
 * without exposing operational detail to clients.
 */
export function buildMetricsApp(metrics: MetricsRegistry): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', metrics.getContentType());
    return metrics.getMetrics();
  });
  return app;
}
