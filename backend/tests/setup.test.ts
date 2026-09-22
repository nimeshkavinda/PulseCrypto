import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/index.js';

describe('Backend Gateway Setup (Task T1.4)', () => {
  it('should initialize Fastify app and respond to /health', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    await app.close();
  });
});
