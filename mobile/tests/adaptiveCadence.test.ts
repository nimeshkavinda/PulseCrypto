import { ADAPTIVE_METERED_CADENCE_MS, effectiveCadence } from '../src/data/adaptiveCadence';
import { StreamRuntime } from '../src/data/StreamRuntime';
import { InMemoryStorageBackend, StorageRepository } from '../src/storage/storageRepository';
import { NetworkCost } from '../src/data/adaptiveCadence';
import { StreamClientDeps } from '../src/data/stream/MarketStreamClient';

const wifi: NetworkCost = { expensive: false, type: 'wifi' };
const cellular: NetworkCost = { expensive: true, type: 'cellular' };

describe('effectiveCadence', () => {
  it('leaves the preference alone on Wi-Fi', () => {
    expect(effectiveCadence(100, true, wifi)).toEqual({ cadenceMs: 100, adaptiveActive: false });
    expect(effectiveCadence(null, true, wifi)).toEqual({ cadenceMs: null, adaptiveActive: false });
  });

  it('slows to the metered cadence on cellular or expensive connections', () => {
    expect(effectiveCadence(100, true, cellular)).toEqual({ cadenceMs: ADAPTIVE_METERED_CADENCE_MS, adaptiveActive: true });
    expect(effectiveCadence(null, true, { expensive: true, type: 'wifi' })).toEqual({ cadenceMs: 500, adaptiveActive: true });
  });

  it('never speeds up a slower user preference', () => {
    expect(effectiveCadence(1000, true, cellular)).toEqual({ cadenceMs: 1000, adaptiveActive: false });
  });

  it('does nothing when adaptive mode is off', () => {
    expect(effectiveCadence(100, false, cellular)).toEqual({ cadenceMs: 100, adaptiveActive: false });
  });
});

describe('StreamRuntime adaptive cadence wiring', () => {
  const deps: StreamClientDeps = {
    createSocket: () => {
      throw new Error('unused');
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

  it('re-applies the cadence when the network, the preference or the toggle changes', async () => {
    const storage = new StorageRepository(new InMemoryStorageBackend());
    storage.setAdaptivePolling(true);
    storage.setCadenceMs(100);
    let emit: (c: NetworkCost) => void = () => undefined;
    const rt = new StreamRuntime({
      storage,
      deps,
      resolveUrl: () => 'ws://t/ws',
      scheduleFrame: (c) => c(),
      subscribeNetworkCost: (cb) => {
        emit = cb;
        return () => undefined;
      },
    });
    const setCadence = jest.spyOn(rt.client, 'setCadence');
    rt.start();

    emit(cellular);
    expect(setCadence).toHaveBeenLastCalledWith(500);
    expect(rt.store.getState().adaptiveActive).toBe(true);

    storage.setAdaptivePolling(false);
    await Promise.resolve();
    expect(setCadence).toHaveBeenLastCalledWith(100);
    expect(rt.store.getState().adaptiveActive).toBe(false);

    emit(wifi);
    storage.setAdaptivePolling(true);
    await Promise.resolve();
    expect(setCadence).toHaveBeenLastCalledWith(100);
    rt.stop();
  });
});
