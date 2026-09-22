import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime(), timestamp: Date.now() };
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const server = await buildApp();
  const port = Number(process.env.PORT) || 8080;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    console.log(`[PulseCrypto Gateway] Server running on http://${host}:${port}`);
  } catch (err) {
    console.error('[PulseCrypto Gateway] Startup error:', err);
    process.exit(1);
  }
}
