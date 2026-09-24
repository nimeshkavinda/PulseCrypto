/**
 * Type bridge for @fastify/websocket route options.
 *
 * In this npm workspace `@fastify/websocket` is hoisted to the repository root while `fastify`
 * is installed under `backend/node_modules`, so the plugin's own `declare module 'fastify'`
 * augmentation cannot resolve `fastify` and never applies. This re-declares the one overload
 * the gateway uses: `app.get(path, { websocket: true, ...routeOptions }, handler)`.
 */
import type { FastifyRequest, RouteShorthandOptions } from 'fastify';
import type WebSocket from 'ws';

declare module 'fastify' {
  interface RouteShorthandMethod<RawServer, RawRequest, RawReply, TypeProvider, Logger> {
    (
      path: string,
      opts: RouteShorthandOptions<RawServer, RawRequest, RawReply> & { websocket: true },
      handler: (socket: WebSocket, req: FastifyRequest) => void
    ): FastifyInstance<RawServer, RawRequest, RawReply, Logger, TypeProvider>;
  }
}
