import '@fastify/websocket';
import {
  FastifyInstance,
  FastifyRequest,
  FastifyBaseLogger,
  FastifyTypeProvider,
  FastifyTypeProviderDefault,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
} from 'fastify';
import WebSocket from 'ws';
import { ConflationEngine } from '../conflator.js';
import { handleClientMessage } from './commands.js';

declare module 'fastify' {
  interface RouteShorthandMethod<
    RawServer extends RawServerBase = RawServerDefault,
    RawRequest extends RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
    RawReply extends RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
    TypeProvider extends FastifyTypeProvider = FastifyTypeProviderDefault,
    Logger extends FastifyBaseLogger = FastifyBaseLogger
  > {
    (
      path: string,
      opts: { websocket: true },
      handler: (socket: WebSocket, req: FastifyRequest) => void
    ): FastifyInstance<RawServer, RawRequest, RawReply, Logger, TypeProvider>;
  }
}

export interface StreamRoutesOptions {
  conflator: ConflationEngine;
}

export async function streamRoutes(app: FastifyInstance, options: StreamRoutesOptions): Promise<void> {
  app.get('/ws', { websocket: true }, (socket: WebSocket) => {
    const session = options.conflator.registerClient(socket);

    socket.on('message', (data: WebSocket.RawData) => {
      handleClientMessage(session, data);
    });
  });
}
