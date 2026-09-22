import { FastifyInstance } from 'fastify';
import { MetricsRegistry } from '../metrics.js';

export interface MetricsRoutesOptions {
  metrics: MetricsRegistry;
}

export async function metricsRoutes(app: FastifyInstance, options: MetricsRoutesOptions): Promise<void> {
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', options.metrics.getContentType());
    return options.metrics.getMetrics();
  });
}
