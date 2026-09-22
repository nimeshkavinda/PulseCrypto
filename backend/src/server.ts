import { buildApp } from './app.js';

async function main() {
  const server = await buildApp({ enableLogger: true });
  const port = Number(process.env.PORT) || 8080;
  const host = process.env.HOST || '0.0.0.0';

  const shutdown = async (signal: string) => {
    server.log.info(`[PulseCrypto Gateway] Received ${signal}, closing gracefully...`);
    try {
      await server.close();
      server.log.info('[PulseCrypto Gateway] Closed successfully.');
      process.exit(0);
    } catch (err) {
      server.log.error(err, '[PulseCrypto Gateway] Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  try {
    await server.listen({ port, host });
    server.log.info(`[PulseCrypto Gateway] Server running on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err, '[PulseCrypto Gateway] Startup error');
    process.exit(1);
  }
}

void main();
