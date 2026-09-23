import { describe, it, expect } from 'vitest';
import { PairMetadataSchema, TickerSchema } from '@pulsecrypto/shared';
import { MetadataService } from '../src/metadata.js';
import { PAIRS, readyMetadata, staticInfo, ticker24h } from './helpers/market.js';

describe('MetadataService', () => {
  it('has no ticker and is not ready before upstream data', () => {
    const m = new MetadataService();
    expect(m.getTicker('BTCUSDT')).toBeNull();
    expect(m.getVersion('BTCUSDT')).toBe(0);
    expect(m.isReady()).toBe(false);
    expect(m.getAll()).toEqual([]);
  });

  it('serves a ticker from 24h stats alone, but is not ready until exchange info arrives', () => {
    const m = new MetadataService();
    for (const p of PAIRS) m.applyTicker24h(p, ticker24h());
    expect(TickerSchema.safeParse(m.getTicker('BTCUSDT')?.ticker).success).toBe(true);
    expect(m.isReady()).toBe(false);
    for (const p of PAIRS) m.applyExchangeInfo(p, staticInfo(p));
    expect(m.isReady()).toBe(true);
  });

  it('returns schema-valid metadata for every pair once ready', () => {
    const all = readyMetadata().getAll();
    expect(all.map((p) => p.symbol)).toEqual(PAIRS);
    for (const p of all) expect(PairMetadataSchema.safeParse(p).success).toBe(true);
  });

  it('applies trades: price, event time, widened range, version bump only on change', () => {
    const m = new MetadataService();
    m.applyTicker24h('BTCUSDT', ticker24h({ lastPrice: 100, high24h: 110, low24h: 90, eventTs: 1000 }));
    const v1 = m.getVersion('BTCUSDT');

    m.applyTrade('BTCUSDT', 120, 1100);
    const t = m.getTicker('BTCUSDT')!;
    expect(t.version).toBe(v1 + 1);
    expect(t.ticker).toMatchObject({ price: 120, high24h: 120, low24h: 90, eventTs: 1100 });

    m.applyTrade('BTCUSDT', 120, 1200);
    expect(m.getVersion('BTCUSDT')).toBe(v1 + 1);

    m.applyTrade('BTCUSDT', 80, 1300);
    expect(m.getTicker('BTCUSDT')!.ticker).toMatchObject({ price: 80, low24h: 80 });
  });

  it('ignores trades older than the last applied price', () => {
    const m = new MetadataService();
    m.applyTicker24h('BTCUSDT', ticker24h({ eventTs: 1000 }));
    m.applyTrade('BTCUSDT', 105, 2000);
    m.applyTrade('BTCUSDT', 101, 1500);
    expect(m.getTicker('BTCUSDT')!.ticker.price).toBe(105);
  });

  it('never lets a late ticker move the price backwards, but still updates 24h stats', () => {
    const m = new MetadataService();
    m.applyTicker24h('ETHUSDT', ticker24h({ lastPrice: 3000, eventTs: 1000 }));
    m.applyTrade('ETHUSDT', 3010, 2000);
    m.applyTicker24h('ETHUSDT', ticker24h({ lastPrice: 3005, high24h: 3100, low24h: 2900, volume24h: 999, changePct: 2.5, eventTs: 1900 }));

    expect(m.getTicker('ETHUSDT')!.ticker).toMatchObject({ price: 3010, volume24h: 999, change24h: 2.5, high24h: 3100 });

    m.applyTicker24h('ETHUSDT', ticker24h({ lastPrice: 3020, high24h: 3100, low24h: 2900, eventTs: 2100 }));
    expect(m.getTicker('ETHUSDT')!.ticker.price).toBe(3020);
  });

  it('rejects non-finite or non-positive ticker values', () => {
    const m = new MetadataService();
    m.applyTicker24h('BTCUSDT', ticker24h({ lastPrice: NaN }));
    m.applyTicker24h('BTCUSDT', ticker24h({ lastPrice: 0 }));
    m.applyTicker24h('BTCUSDT', ticker24h({ changePct: Infinity }));
    expect(m.getTicker('BTCUSDT')).toBeNull();
  });

  it('bumps the content version on every served change and not on identical exchange info', () => {
    const m = readyMetadata();
    const v = m.getContentVersion();
    m.applyExchangeInfo('BTCUSDT', staticInfo('BTCUSDT'));
    expect(m.getContentVersion()).toBe(v);
    m.applyExchangeInfo('BTCUSDT', staticInfo('BTCUSDT', { tradingStatus: 'HALTED' }));
    expect(m.getContentVersion()).toBe(v + 1);
    m.applyTrade('BTCUSDT', 101, 5000);
    expect(m.getContentVersion()).toBe(v + 2);
  });
});
