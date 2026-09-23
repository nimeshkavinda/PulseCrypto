import { FastifyInstance } from 'fastify';
import { ChannelHub } from '../hub/ChannelHub.js';

export interface HealthRoutesOptions {
  hub: ChannelHub;
}

export async function healthRoutes(app: FastifyInstance, options: HealthRoutesOptions): Promise<void> {
  app.get('/health', { logLevel: 'debug' }, async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
      clientsConnected: options.hub.getConnectedClientCount(),
    };
  });
}
