import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { createMarketStore } from '../src/data/store/marketStore';
import { MarketIngestor } from '../src/data/store/ingestor';
import { StreamRuntime } from '../src/data/StreamRuntime';
import { StreamProvider } from '../src/data/StreamProvider';
import { useTicker } from '../src/data/store/hooks';
import { InMemoryStorageBackend, StorageRepository } from '../src/storage/storageRepository';
import { StreamClientDeps } from '../src/data/stream/MarketStreamClient';
import { book, ticker } from './fixtures';

/** Collects scheduled commits so tests decide when an "animation frame" happens. */
function manualFrames() {
  const pending: Array<() => void> = [];
  return {
    schedule: (commit: () => void) => void pending.push(commit),
    flush: () => pending.splice(0).forEach((c) => c()),
    count: () => pending.length,
  };
}

describe('MarketIngestor', () => {
  it('coalesces a burst of frames into one store commit per animation frame', () => {
    const store = createMarketStore();
    const frames = manualFrames();
    const ingestor = new MarketIngestor(store, frames.schedule);
    const listener = jest.fn();
    store.subscribe(listener);

    for (let i = 0; i < 5; i++) ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', 100 + i)] }]);
    expect(frames.count()).toBe(1);
    expect(listener).not.toHaveBeenCalled();

    frames.flush();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().tickers.BTCUSDT?.price).toBe(104);
    expect(ingestor.commits).toBe(1);
  });

  it('replaces only the changed pair, preserving object identity of the others', () => {
    const store = createMarketStore();
    const frames = manualFrames();
    const ingestor = new MarketIngestor(store, frames.schedule);
    ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', 100), ticker('ETHUSDT', 10)] }]);
    frames.flush();
    const eth = store.getState().tickers.ETHUSDT;
    const books = store.getState().books;

    ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', 101)] }]);
    frames.flush();
    expect(store.getState().tickers.ETHUSDT).toBe(eth);
    expect(store.getState().books).toBe(books);
    expect(store.getState().tickers.BTCUSDT).toMatchObject({ price: 101, origin: 'live' });
  });

  it('applies books and upstream status', () => {
    const store = createMarketStore();
    const frames = manualFrames();
    const ingestor = new MarketIngestor(store, frames.schedule);
    const { type: _t, ...plain } = { type: 'book' as const, ...book('SOLUSDT') };
    ingestor.ingest([
      { type: 'book', ...plain },
      { type: 'status', upstream: 'stale', stalePairs: ['XRPUSDT'], since: 5 },
    ]);
    frames.flush();
    expect(store.getState().books.SOLUSDT).toMatchObject({ pair: 'SOLUSDT', origin: 'live' });
    expect(store.getState().upstream).toEqual({ status: 'stale', stalePairs: ['XRPUSDT'], since: 5 });
  });
});

describe('render isolation', () => {
  const idleDeps: StreamClientDeps = {
    createSocket: () => {
      throw new Error('no network in tests');
    },
    subscribeNetwork: (cb) => {
      cb(false);
      return () => undefined;
    },
    subscribeAppState: (cb) => {
      cb(true);
      return () => undefined;
    },
    scheduler: { now: Date.now, setTimeout, clearTimeout: (h) => clearTimeout(h as never), setInterval, clearInterval: (h) => clearInterval(h as never) },
  };

  it('does not re-render a component selecting ETH when only BTC changes', async () => {
    const frames = manualFrames();
    const runtime = new StreamRuntime({
      storage: new StorageRepository(new InMemoryStorageBackend()),
      deps: idleDeps,
      resolveUrl: () => 'ws://test/ws',
      scheduleFrame: frames.schedule,
    });
    const renders: Record<string, number> = { BTCUSDT: 0, ETHUSDT: 0 };
    function Price({ pair }: { pair: SupportedPairSymbol }) {
      renders[pair]++;
      const t = useTicker(pair);
      return <Text testID={pair}>{t ? String(t.price) : '-'}</Text>;
    }

    await render(
      <StreamProvider runtime={runtime}>
        <Price pair="BTCUSDT" />
        <Price pair="ETHUSDT" />
      </StreamProvider>
    );
    await act(async () => {
      runtime.ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', 100), ticker('ETHUSDT', 10)] }]);
      frames.flush();
    });
    const before = { ...renders };

    for (let i = 1; i <= 20; i++) {
      // One act per frame: React would otherwise batch all updates into a single render.
      await act(async () => {
        runtime.ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', 100 + i)] }]);
        frames.flush();
      });
    }

    expect(screen.getByTestId('BTCUSDT')).toHaveTextContent('120');
    expect(renders.BTCUSDT - before.BTCUSDT).toBe(20);
    expect(renders.ETHUSDT - before.ETHUSDT).toBe(0);
  });
});
