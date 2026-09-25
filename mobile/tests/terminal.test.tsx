import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { PressureSpreadBar } from '../src/components/terminal/PressureSpreadBar';
import { MarketDepthChart } from '../src/components/terminal/MarketDepthChart';
import { OrderBookTable } from '../src/components/terminal/OrderBookTable';
import { formatPrice } from '../src/utils/formatters';
import { bannerContent, latestDataAt, MarketStatusBanner } from '../src/components/common/MarketStatusBanner';
import { book, ticker } from './fixtures';
import { createTestRuntime } from './runtimeHarness';

describe('PressureSpreadBar', () => {
  it('shows numeric buy/sell pressure and the absolute and relative spread', async () => {
    await render(<PressureSpreadBar buyPressure={58.2} sellPressure={41.8} spread={0.01} spreadPct={0.0000156} priceDecimals={2} quoteAsset="USDT" />);
    expect(screen.getByText('BUY 58.2%')).toBeTruthy();
    expect(screen.getByText('41.8% SELL')).toBeTruthy();
    // Two significant figures: a tight spread no longer rounds to 0.0000%.
    expect(screen.getByText('0.01 USDT (0.000016%)')).toBeTruthy();
    expect(screen.getByLabelText('Spread 0.01 USDT, 0.000016 percent')).toBeTruthy();
  });

  it('formats the spread amount in the a11y label with the pair decimals', async () => {
    await render(<PressureSpreadBar buyPressure={50} sellPressure={50} spread={0.00001} spreadPct={0.0123} priceDecimals={5} quoteAsset="USDT" />);
    expect(screen.getByLabelText('Spread 0.00001 USDT, 0.012 percent')).toBeTruthy();
  });
});

describe('OrderBookTable', () => {
  const levels = (start: number, step: number) =>
    Array.from({ length: 12 }, (_, i): [number, number, number] => {
      const price = start + i * step;
      const qty = (i + 1) * 0.3; // never 1, so no total equals a price
      return [price, qty, price * qty];
    });

  it('shows the top 10 bids and asks with pair decimals, and drops deeper levels', async () => {
    const bids = levels(64000, -0.5);
    const asks = levels(64000.5, 0.5);
    await render(<OrderBookTable bids={bids} asks={asks} baseAsset="BTC" quoteAsset="USDT" priceDecimals={2} qtyDecimals={5} />);

    expect(screen.getAllByText('PRICE (USDT)')).toHaveLength(2);
    expect(screen.getAllByText('AMOUNT (BTC)')).toHaveLength(2);
    for (const [price] of [...bids.slice(0, 10), ...asks.slice(0, 10)]) {
      expect(screen.getByText(formatPrice(price, 2))).toBeTruthy();
    }
    for (const [price] of [...bids.slice(10), ...asks.slice(10)]) {
      expect(screen.queryByText(formatPrice(price, 2))).toBeNull();
    }
    expect(screen.getAllByText((0.3).toFixed(5))).toHaveLength(2); // best bid and best ask amounts
  });

  it('updates in place when a new book arrives', async () => {
    const first = levels(64000, -0.5);
    const asks = levels(64000.5, 0.5);
    const view = await render(<OrderBookTable bids={first} asks={asks} baseAsset="BTC" quoteAsset="USDT" priceDecimals={2} qtyDecimals={5} />);
    const next = levels(63990, -0.5);
    await view.rerender(<OrderBookTable bids={next} asks={asks} baseAsset="BTC" quoteAsset="USDT" priceDecimals={2} qtyDecimals={5} />);
    expect(screen.getByText(formatPrice(63990, 2))).toBeTruthy();
    expect(screen.queryByText(formatPrice(64000, 2))).toBeNull();
  });
});

describe('MarketDepthChart', () => {
  it('shows the spread % in the liquidity badge to two significant figures', async () => {
    const b = book('BTCUSDT', 64000);
    await render(<MarketDepthChart bids={b.bids} asks={b.asks} baseAsset="BTC" priceDecimals={2} spreadPct={0.0000156} buyPressure={60} sellPressure={40} />);
    expect(screen.getByText('Low (0.000016%)')).toBeTruthy();
  });
});

describe('MarketStatusBanner', () => {
  it('shows the reconnect countdown but keeps it out of the accessibility label', async () => {
    const t = createTestRuntime();
    await render(t.wrap(<MarketStatusBanner />));
    const at = Date.now() - 60_000;
    await act(async () =>
      t.runtime.store.setState({
        tickers: { BTCUSDT: { ...ticker('BTCUSDT', 64000, at), origin: 'live' } },
        connection: { ...t.runtime.store.getState().connection, state: 'backoff', nextRetryAt: Date.now() + 4_200 },
      })
    );
    const text = screen.getByText(/^Connection lost\. Reconnecting in \d+s · showing prices from /);
    expect(text.props.accessibilityLabel).toMatch(/^Connection lost\. Reconnecting · showing prices from /);
    expect(text.props.accessibilityLabel).not.toMatch(/in \d+s/);
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
    expect(bannerContent({ state: 'offline', nextRetryAt: null }, null, at, now)).toMatchObject({
      tone: 'down',
      text: "You're offline. Showing prices from 11:58:30.",
    });
  });

  it('makes no claim about shown prices when offline with nothing received', () => {
    const content = bannerContent({ state: 'offline', nextRetryAt: null }, null, null, now);
    expect(content?.text).toBe("You're offline.");
    expect(content?.text).not.toMatch(/prices/i);
  });

  it('counts down to the next reconnect attempt and keeps saying which prices are shown', () => {
    const content = bannerContent({ state: 'backoff', nextRetryAt: now + 4_200 }, null, at, now);
    expect(content?.text).toBe('Connection lost. Reconnecting in 5s · showing prices from 11:58:30');
    // Screen readers get the text without the per-second countdown.
    expect(content?.announcement).toBe('Connection lost. Reconnecting · showing prices from 11:58:30');
    expect(bannerContent({ state: 'backoff', nextRetryAt: now + 4_200 }, null, null, now)?.text).toBe('Connection lost. Reconnecting in 5s');
  });

  it('says the gateway is still connecting to the exchange while it warms up', () => {
    expect(bannerContent({ state: 'open', nextRetryAt: null }, { status: 'connecting', stalePairs: [], since: 1 }, at, now)).toMatchObject({
      tone: 'info',
      text: 'Connecting to the exchange feed…',
    });
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
