import '@fastify/websocket';
import { FastifyInstance } from 'fastify';
import { ChannelHub } from '../hub/ChannelHub.js';

export interface StreamRoutesOptions {
  hub: ChannelHub;
}

/** Canonical market data stream. Protocol: docs/protocol.md */
export async function streamRoutes(app: FastifyInstance, options: StreamRoutesOptions): Promise<void> {
  app.get('/ws', { websocket: true }, (socket) => {
    options.hub.attach(socket);
  });
}
