import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Observability', () => {
  it('propagates an incoming x-request-id as the request id', async () => {
    const app = await buildApp({ enableLogger: false });
    app.get('/_id', async (req) => ({ id: req.id }));
    const res = await app.inject({ method: 'GET', url: '/_id', headers: { 'x-request-id': 'abc-123' } });
    expect(res.json()).toEqual({ id: 'abc-123' });
    await app.close();
  });

  it('generates distinct request ids when none is supplied', async () => {
    const app = await buildApp({ enableLogger: false });
    app.get('/_id', async (req) => ({ id: req.id }));
    const a = (await app.inject({ method: 'GET', url: '/_id' })).json().id;
    const b = (await app.inject({ method: 'GET', url: '/_id' })).json().id;
    expect(a).not.toBe(b);
    await app.close();
  });
});
