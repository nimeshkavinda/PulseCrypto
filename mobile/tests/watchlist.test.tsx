import React, { Profiler } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { MarketPairCard } from '../src/components/watchlist/MarketPairCard';
import { buildRows } from '../src/components/watchlist/filterUtils';
import { ticker } from './fixtures';
import { createTestRuntime } from './runtimeHarness';

const rows = buildRows(undefined);
const row = (s: SupportedPairSymbol) => rows.find((r) => r.symbol === s)!;
const noop = () => undefined;

describe('MarketPairCard (live row)', () => {
  it('shows skeletons until data exists, then the live price, ▲/▼ change and LIVE badge', async () => {
    const t = createTestRuntime();
    await render(t.wrap(<MarketPairCard row={row('BTCUSDT')} isFavorite={false} onPress={noop} onToggleFavorite={noop} />));
    expect(screen.getByRole('button', { name: /BTC \/ USDT, loading/ })).toBeTruthy();

    await act(async () => {
      t.goLive();
      t.runtime.ingestor.ingest([{ type: 'tickers', data: [{ ...ticker('BTCUSDT', 64238.17, Date.now()), change24h: 1.82 }] }]);
      t.flush();
    });
    expect(screen.getByText('$64,238.17')).toBeTruthy();
    expect(screen.getByText('▲ 1.82%')).toBeTruthy();
    expect(screen.getByText('LIVE')).toBeTruthy();
  });

  it('uses REST metadata until the first ticker, and shows ▼ for negative change', async () => {
    const t = createTestRuntime();
    const [eth] = buildRows([
      { symbol: 'ETHUSDT', displayName: 'ETH / USDT', baseAsset: 'ETH', quoteAsset: 'USDT', tradingStatus: 'TRADING', priceDecimals: 2, qtyDecimals: 4, high24h: 2800, low24h: 2700, volume24h: 1000, lastPrice: 2742.02, change24h: -0.41 },
    ]).filter((r) => r.symbol === 'ETHUSDT');
    await render(t.wrap(<MarketPairCard row={eth} isFavorite={false} onPress={noop} onToggleFavorite={noop} />));
    expect(screen.getByText('$2,742.02')).toBeTruthy();
    expect(screen.getByText('▼ 0.41%')).toBeTruthy();
    expect(screen.getByText('SYNCING')).toBeTruthy();
  });

  it('marks a pair DELAYED when the gateway reports it stale, leaving other pairs LIVE', async () => {
    const t = createTestRuntime();
    await render(
      t.wrap(
        <>
          <MarketPairCard row={row('BTCUSDT')} isFavorite={false} onPress={noop} onToggleFavorite={noop} />
          <MarketPairCard row={row('ETHUSDT')} isFavorite={false} onPress={noop} onToggleFavorite={noop} />
        </>
      )
    );
    await act(async () => {
      t.goLive();
      t.runtime.ingestor.ingest([
        { type: 'tickers', data: [ticker('BTCUSDT', 100, Date.now()), ticker('ETHUSDT', 10, Date.now())] },
        { type: 'status', upstream: 'stale', stalePairs: ['ETHUSDT'], since: 1 },
      ]);
      t.flush();
    });
    expect(screen.getByRole('button', { name: /BTC \/ USDT.*live$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /ETH \/ USDT.*delayed$/ })).toBeTruthy();
  });

  it('re-renders only the row whose ticker changed', async () => {
    const t = createTestRuntime();
    const renders: Record<string, number> = { BTCUSDT: 0, ETHUSDT: 0 };
    const onRender = (id: string) => void renders[id]++;
    await render(
      t.wrap(
        <>
          <Profiler id="BTCUSDT" onRender={onRender}>
            <MarketPairCard row={row('BTCUSDT')} isFavorite={false} onPress={noop} onToggleFavorite={noop} />
          </Profiler>
          <Profiler id="ETHUSDT" onRender={onRender}>
            <MarketPairCard row={row('ETHUSDT')} isFavorite={false} onPress={noop} onToggleFavorite={noop} />
          </Profiler>
        </>
      )
    );
    await act(async () => {
      t.goLive();
      t.runtime.ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', 100, Date.now()), ticker('ETHUSDT', 10, Date.now())] }]);
      t.flush();
    });
    const before = { ...renders };
    for (let i = 1; i <= 10; i++) {
      await act(async () => {
        t.runtime.ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', 100 + i, Date.now())] }]);
        t.flush();
      });
    }
    expect(renders.BTCUSDT - before.BTCUSDT).toBeGreaterThanOrEqual(10);
    expect(renders.ETHUSDT - before.ETHUSDT).toBe(0);
  });

  it('opens the pair on row press and toggles the favourite without opening', async () => {
    const t = createTestRuntime();
    const onPress = jest.fn();
    const onToggleFavorite = jest.fn();
    await render(t.wrap(<MarketPairCard row={row('SOLUSDT')} isFavorite onPress={onPress} onToggleFavorite={onToggleFavorite} />));
    const star = screen.getByLabelText('Toggle favourite for SOLUSDT');
    expect(star).toBeChecked();
    await fireEvent.press(star, { stopPropagation: jest.fn() });
    expect(onToggleFavorite).toHaveBeenCalledWith('SOLUSDT');
    expect(onPress).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: /SOL \/ USDT/ }));
    expect(onPress).toHaveBeenCalledWith('SOLUSDT');
  });
});
