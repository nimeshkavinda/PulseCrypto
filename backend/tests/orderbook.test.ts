import { describe, it, expect } from 'vitest';
import { BookSchema } from '@pulsecrypto/shared';
import { OrderBookManager, BOOK_DEPTH } from '../src/orderbook.js';

describe('OrderBookManager', () => {
  it('reports no book (version 0) until upstream depth arrives', () => {
    const obm = new OrderBookManager();
    expect(obm.getVersion('BTCUSDT')).toBe(0);
    expect(obm.getBook('BTCUSDT')).toBeNull();
  });

  it('bumps the version on every depth update and returns a schema-valid book', () => {
    const obm = new OrderBookManager();
    obm.updateDepth('BTCUSDT', [[60000, 1]], [[60001, 1]]);
    obm.updateDepth('BTCUSDT', [[60000, 2]], [[60001, 1]]);

    const result = obm.getBook('BTCUSDT');
    expect(result?.version).toBe(2);
    expect(BookSchema.safeParse(result?.book).success).toBe(true);
  });

  it('memoises derivation per version', () => {
    const obm = new OrderBookManager();
    obm.updateDepth('ETHUSDT', [[3000, 1]], [[3001, 1]]);
    expect(obm.getBook('ETHUSDT')).toBe(obm.getBook('ETHUSDT'));
  });

  it('emits per-level notional as the third tuple element', () => {
    const obm = new OrderBookManager();
    obm.updateDepth(
      'BTCUSDT',
      [
        [60000, 1],
        [59900, 2],
      ],
      [
        [60100, 1],
        [60200, 3],
      ]
    );
    const book = obm.getBook('BTCUSDT')!.book;
    expect(book.bids).toEqual([
      [60000, 1, 60000],
      [59900, 2, 119800],
    ]);
    expect(book.asks).toEqual([
      [60100, 1, 60100],
      [60200, 3, 180600],
    ]);
  });

  it('computes spread, spread % and buy/sell pressure from quantities', () => {
    const obm = new OrderBookManager();
    obm.updateDepth('ETHUSDT', [[3000, 3]], [[3010, 1]]);
    const book = obm.getBook('ETHUSDT')!.book;

    expect(book.spread).toBe(10);
    expect(book.spreadPct).toBeCloseTo((10 / 3000) * 100, 6);
    expect(book.buyPressure).toBe(75);
    expect(book.sellPressure).toBe(25);
  });

  it('sorts sides, drops zero-quantity levels and caps depth', () => {
    const obm = new OrderBookManager();
    const bids = Array.from({ length: 35 }, (_, i) => [60000 - i * 10, 1] as [number, number]);
    const asks = Array.from({ length: 35 }, (_, i) => [60010 + i * 10, 1] as [number, number]);
    bids.push([60005, 0]);
    obm.updateDepth('SOLUSDT', [...bids].reverse(), [...asks].reverse());
    const book = obm.getBook('SOLUSDT')!.book;

    expect(book.bids).toHaveLength(BOOK_DEPTH);
    expect(book.asks).toHaveLength(BOOK_DEPTH);
    expect(book.bids[0][0]).toBe(60000);
    expect(book.asks[0][0]).toBe(60010);
    expect(book.bids.some(([, qty]) => qty === 0)).toBe(false);
  });
});
