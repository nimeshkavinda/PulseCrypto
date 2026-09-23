import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PressureSpreadBar } from '../src/components/terminal/PressureSpreadBar';
import { bannerContent, latestDataAt } from '../src/components/common/MarketStatusBanner';

describe('PressureSpreadBar', () => {
  it('shows numeric buy/sell pressure and the absolute and relative spread', async () => {
    await render(<PressureSpreadBar buyPressure={58.2} sellPressure={41.8} spread={0.01} spreadPct={0.0000156} priceDecimals={2} quoteAsset="USDT" />);
    expect(screen.getByText('BUY 58.2%')).toBeTruthy();
    expect(screen.getByText('41.8% SELL')).toBeTruthy();
    expect(screen.getByText('0.01 USDT (0.0000%)')).toBeTruthy();
  });
});

describe('bannerContent', () => {
  const now = new Date(2026, 0, 1, 12, 0, 0).getTime();
  const at = new Date(2026, 0, 1, 11, 58, 30).getTime();

  it('is hidden when connected with a live feed, or while paused', () => {
    expect(bannerContent({ state: 'open', nextRetryAt: null }, { status: 'live', stalePairs: [], since: 1 }, at, now)).toBeNull();
    expect(bannerContent({ state: 'paused', nextRetryAt: null }, null, at, now)).toBeNull();
  });

  it('tells the user they are offline and how old the shown prices are', () => {
    expect(bannerContent({ state: 'offline', nextRetryAt: null }, null, at, now)).toEqual({
      tone: 'down',
      text: "You're offline. Showing prices from 11:58:30.",
    });
  });

  it('counts down to the next reconnect attempt', () => {
    expect(bannerContent({ state: 'backoff', nextRetryAt: now + 4_200 }, null, at, now)?.text).toBe('Connection lost. Reconnecting in 5s');
  });

  it('reports exchange-side problems while the socket is healthy', () => {
    expect(bannerContent({ state: 'open', nextRetryAt: null }, { status: 'down', stalePairs: [], since: 1 }, at, now)?.tone).toBe('down');
    expect(bannerContent({ state: 'open', nextRetryAt: null }, { status: 'stale', stalePairs: ['ETHUSDT', 'XRPUSDT'], since: 1 }, at, now)?.text).toBe(
      'Delayed: ETH, XRP'
    );
  });

  it('shows cached prices while (re)connecting', () => {
    expect(bannerContent({ state: 'connecting', nextRetryAt: null }, null, at, now)?.text).toBe('Connecting… Showing prices from 11:58:30.');
    expect(bannerContent({ state: 'connecting', nextRetryAt: null }, null, null, now)).toBeNull();
  });

  it('derives the newest on-screen price time', () => {
    expect(latestDataAt({ tickers: {} })).toBeNull();
    expect(latestDataAt({ tickers: { BTCUSDT: { updatedAt: 5 } as never, ETHUSDT: { updatedAt: 9 } as never } })).toBe(9);
  });
});
