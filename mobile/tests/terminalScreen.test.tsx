import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { PairMetadata } from '@pulsecrypto/shared';
import { TerminalScreen } from '../src/components/terminal/TerminalScreen';
import { LastPriceHero } from '../src/components/terminal/LastPriceHero';
import { ticker } from './fixtures';
import { createTestRuntime } from './runtimeHarness';

let mockFocused = true;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));

let mockMeta: PairMetadata[] | undefined;
jest.mock('../src/hooks/usePairsMetadata', () => ({ usePairsMetadata: () => ({ data: mockMeta }) }));

const doge = (priceDecimals: number): PairMetadata => ({
  symbol: 'DOGEUSDT', displayName: 'DOGE / USDT', baseAsset: 'DOGE', quoteAsset: 'USDT', tradingStatus: 'TRADING',
  priceDecimals, qtyDecimals: 0, high24h: 0.2, low24h: 0.1, volume24h: 1, lastPrice: 0.123456, change24h: 1,
});

describe('TerminalScreen', () => {
  afterEach(() => {
    mockMeta = undefined;
    mockFocused = true;
  });

  it('keeps showing its last prices while its tab is hidden, and catches up when shown', async () => {
    const t = createTestRuntime();
    t.runtime.setActivePair('DOGEUSDT');
    await render(t.wrap(<TerminalScreen />));
    const tick = (price: number) =>
      act(async () => {
        t.runtime.ingestor.ingest([{ type: 'tickers', data: [ticker('DOGEUSDT', price, Date.now())] }]);
        t.flush();
      });
    await act(async () => t.goLive());
    await tick(0.11);
    expect(screen.getByText('$0.11000')).toBeTruthy();

    mockFocused = false;
    await screen.rerender(t.wrap(<TerminalScreen />));
    await tick(0.12);
    await tick(0.13);
    expect(screen.getByText('$0.11000')).toBeTruthy();
    expect(screen.queryByText('$0.13000')).toBeNull();

    mockFocused = true;
    await screen.rerender(t.wrap(<TerminalScreen />));
    expect(screen.getByText('$0.13000')).toBeTruthy();
  });

  async function showDoge() {
    const t = createTestRuntime();
    t.runtime.setActivePair('DOGEUSDT');
    await render(t.wrap(<TerminalScreen />));
    await act(async () => {
      t.goLive();
      t.runtime.ingestor.ingest([{ type: 'tickers', data: [ticker('DOGEUSDT', 0.123456, Date.now())] }]);
      t.flush();
    });
    return t;
  }

  it('formats prices with the decimals from /pairs/meta', async () => {
    mockMeta = [doge(5)];
    await showDoge();
    expect(screen.getByText('$0.12346')).toBeTruthy();
  });

  it('prefers /pairs/meta over the static table, and falls back to it before metadata loads', async () => {
    mockMeta = [doge(3)];
    await showDoge();
    expect(screen.getByText('$0.123')).toBeTruthy();

    mockMeta = undefined;
    await showDoge();
    expect(screen.getAllByText('$0.12346').length).toBeGreaterThan(0); // static DOGE table: 5
  });

  it('changes only the book channels on a pair switch', async () => {
    const t = createTestRuntime();
    const setChannels = jest.spyOn(t.runtime.client, 'setChannels');
    await render(t.wrap(<TerminalScreen />));
    await act(async () => {});
    setChannels.mockClear();

    await act(async () => t.runtime.setActivePair('ETHUSDT'));
    expect(setChannels).toHaveBeenCalledTimes(1);
    expect([...setChannels.mock.calls[0][0]].sort()).toEqual(['book:ETHUSDT', 'tickers']);
  });
});

describe('LastPriceHero', () => {
  it('judges the badge by the ticker alone, while "Updated" shows the newer of ticker and book', async () => {
    const t = createTestRuntime();
    const now = Date.now();
    const old = { ...ticker('BTCUSDT', 64000, now - 60_000), origin: 'live' as const, receivedAt: now - 60_000 };
    const bookAt = now - 100;
    await render(t.wrap(<LastPriceHero pair="BTCUSDT" ticker={old} bookUpdatedAt={bookAt} priceDecimals={2} baseAsset="BTC" />));
    await act(async () => t.goLive());
    expect(screen.getByText('DELAYED')).toBeTruthy(); // a fresh book does not make a 60 s old price LIVE
    const hh = (n: number) => String(n).padStart(2, '0');
    const d = new Date(bookAt);
    expect(screen.getByLabelText(`Last updated ${hh(d.getHours())}:${hh(d.getMinutes())}:${hh(d.getSeconds())}`)).toBeTruthy();
  });

  it('bases the "ago" suffix on the same moment as "Updated": an old ticker with a fresh book shows none', async () => {
    const t = createTestRuntime();
    const now = Date.now();
    const old = { ...ticker('BTCUSDT', 64000, now - 60_000), origin: 'live' as const, receivedAt: now - 60_000 };
    await render(
      t.wrap(<LastPriceHero pair="BTCUSDT" ticker={old} bookUpdatedAt={now - 100} bookReceivedAt={now - 100} priceDecimals={2} baseAsset="BTC" />)
    );
    await act(async () => t.goLive());
    await act(async () => {}); // let the age clock tick once
    expect(screen.getByText('DELAYED')).toBeTruthy();
    expect(screen.queryByText(/ago/)).toBeNull();
  });

  it('shows LIVE and no "ago" when the gateway clock is 10 s behind the device', async () => {
    const t = createTestRuntime();
    const now = Date.now();
    const skewed = { ...ticker('BTCUSDT', 64000, now - 10_000), origin: 'live' as const, receivedAt: now };
    await render(t.wrap(<LastPriceHero pair="BTCUSDT" ticker={skewed} bookUpdatedAt={undefined} priceDecimals={2} baseAsset="BTC" />));
    await act(async () => t.goLive());
    expect(screen.getByText('LIVE')).toBeTruthy();
    expect(screen.queryByText(/ago/)).toBeNull();
  });

  it('does not flash when the first live ticker replaces a cached price', async () => {
    const reanimated = jest.requireMock('react-native-reanimated') as { withSequence: (...a: unknown[]) => unknown };
    const flash = jest.spyOn(reanimated, 'withSequence');
    const t = createTestRuntime();
    t.runtime.store.setState({ tickers: { BTCUSDT: { ...ticker('BTCUSDT', 63000), origin: 'cache' } } });
    await render(t.wrap(<TerminalScreen />));
    expect(screen.getByText('$63,000.00')).toBeTruthy();
    await act(async () => {
      t.goLive();
      t.runtime.ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', 64000, Date.now())] }]);
      t.flush();
    });
    expect(screen.getByText('$64,000.00')).toBeTruthy();
    expect(flash).not.toHaveBeenCalled();
    flash.mockRestore();
  });
});
