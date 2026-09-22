import { FastifyInstance } from 'fastify';
import { ConflationEngine } from '../conflator.js';

export interface HealthRoutesOptions {
  conflator: ConflationEngine;
}

export async function healthRoutes(app: FastifyInstance, options: HealthRoutesOptions): Promise<void> {
  app.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
      clientsConnected: options.conflator.getConnectedClientCount(),
    };
  });
}
