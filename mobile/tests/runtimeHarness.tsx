import React, { ReactNode } from 'react';
import { StreamRuntime } from '../src/data/StreamRuntime';
import { StreamProvider } from '../src/data/StreamProvider';
import { InMemoryStorageBackend, StorageRepository } from '../src/storage/storageRepository';
import { StreamClientDeps } from '../src/data/stream/MarketStreamClient';

/** A runtime with no network; tests drive data through `runtime.ingestor` and store state. */
export function createTestRuntime() {
  const pending: Array<() => void> = [];
  const deps: StreamClientDeps = {
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
  const runtime = new StreamRuntime({
    storage: new StorageRepository(new InMemoryStorageBackend()),
    deps,
    resolveUrl: () => 'ws://test/ws',
    scheduleFrame: (c) => void pending.push(c),
  });
  const flush = () => pending.splice(0).forEach((c) => c());
  const wrap = (ui: ReactNode) => <StreamProvider runtime={runtime}>{ui}</StreamProvider>;
  /** Marks the socket open with a live exchange feed (as after a successful connect). */
  const goLive = () =>
    runtime.store.setState({
      connection: { ...runtime.store.getState().connection, state: 'open' },
      upstream: { status: 'live', stalePairs: [], since: 1 },
    });
  return { runtime, flush, wrap, goLive };
}
