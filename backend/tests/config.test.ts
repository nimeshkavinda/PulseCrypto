import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('applies documented defaults', () => {
    const c = loadConfig({});
    expect(c).toMatchObject({
      FLUSH_INTERVAL_MS: 100,
      WS_SOFT_LIMIT_BYTES: 64 * 1024,
      WS_HARD_LIMIT_BYTES: 1024 * 1024,
      WS_LAG_GRACE_MS: 5000,
    });
  });

  it('coerces numeric env strings', () => {
    expect(loadConfig({ FLUSH_INTERVAL_MS: '250' }).FLUSH_INTERVAL_MS).toBe(250);
  });

  it('rejects a soft limit at or above the hard limit', () => {
    expect(() => loadConfig({ WS_SOFT_LIMIT_BYTES: '2048', WS_HARD_LIMIT_BYTES: '1024' })).toThrow(/WS_SOFT_LIMIT_BYTES/);
  });

  it('caps the tick at the 10 s maximum cadence', () => {
    expect(loadConfig({ FLUSH_INTERVAL_MS: '10000' }).FLUSH_INTERVAL_MS).toBe(10_000);
    expect(() => loadConfig({ FLUSH_INTERVAL_MS: '10001' })).toThrow(/FLUSH_INTERVAL_MS/);
  });

  it('rejects invalid values', () => {
    expect(() => loadConfig({ FLUSH_INTERVAL_MS: '-5' })).toThrow(/Invalid environment configuration/);
  });
});
