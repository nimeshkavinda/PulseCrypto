import 'react-native-gesture-handler/jestSetup';
import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SettingsScreen } from '../src/components/settings/SettingsScreen';
import { SNAPSHOT_REFRESH_MS, useSettings } from '../src/hooks/useSettings';
import { InMemoryStorageBackend, StorageRepository, STORAGE_KEYS, utf8ByteLength } from '../src/storage/storageRepository';
import { createTestRuntime } from './runtimeHarness';
import { ticker } from './fixtures';

// Settings reads its tab's focus to pause while hidden; these tests render it focused.
jest.mock('expo-router', () => ({ useIsFocused: () => true }));

/** Storage listeners run in a microtask. */
const settle = () => act(async () => {});

async function renderSettings() {
  const t = createTestRuntime();
  await render(t.wrap(<SettingsScreen />));
  await act(async () => {
    fireEvent(screen.getByTestId('cadence-track'), 'layout', { nativeEvent: { layout: { width: 300 } } });
  });
  return t;
}

describe('Settings storage card', () => {
  it('shows favourites, active pair, cadence and cached prices, and follows changes made elsewhere', async () => {
    const t = await renderSettings();
    expect(screen.getByTestId('storage-favorites')).toHaveTextContent('3 · BTC, ETH, SOL');
    expect(screen.getByTestId('storage-active-pair')).toHaveTextContent('BTC / USDT');
    expect(screen.getByTestId('storage-cadence')).toHaveTextContent('Gateway default');
    expect(screen.getByTestId('storage-cached-prices')).toHaveTextContent('None');

    // A favourite toggled on the Markets tab, and a pair opened on the terminal.
    await act(async () => {
      t.runtime.storage.toggleFavorite('XRPUSDT');
      t.runtime.setActivePair('SOLUSDT');
      t.runtime.storage.setCadenceMs(500);
    });
    await settle();
    expect(screen.getByTestId('storage-favorites')).toHaveTextContent('4 · BTC, ETH, SOL, XRP');
    expect(screen.getByTestId('storage-active-pair')).toHaveTextContent('SOL / USDT');
    expect(screen.getByTestId('storage-cadence')).toHaveTextContent('500ms');
  });

  it('reports the exact UTF-8 size of the cached prices and clears them on request', async () => {
    const t = await renderSettings();
    const snapshot = { v: 1, savedAt: 1, tickers: { BTCUSDT: ticker('BTCUSDT', 1) }, books: {} };
    await act(async () => t.runtime.storage.set(STORAGE_KEYS.MARKET_SNAPSHOT, snapshot));
    await settle();
    const bytes = utf8ByteLength(JSON.stringify(snapshot));
    expect(screen.getByTestId('storage-cached-prices')).toHaveTextContent(`1 pairs · ${bytes.toLocaleString('en-US')} bytes`);

    await act(async () => fireEvent.press(screen.getByText('Clear Cached Prices')));
    await settle();
    expect(t.runtime.storage.get(STORAGE_KEYS.MARKET_SNAPSHOT)).toBeNull();
    expect(screen.getByTestId('storage-cached-prices')).toHaveTextContent('None');
  });

  it('Reset Preferences switches the running terminal back to BTC', async () => {
    const t = await renderSettings();
    await act(async () => t.runtime.setActivePair('SOLUSDT'));
    await act(async () => fireEvent.press(screen.getByText('Reset Preferences')));
    await settle();
    expect(t.runtime.store.getState().activePair).toBe('BTCUSDT');
    expect(screen.getByTestId('storage-active-pair')).toHaveTextContent('BTC / USDT');
  });
});

describe('useSettings snapshot refresh', () => {
  afterEach(() => jest.useRealTimers());

  it('refreshes on snapshot writes at most once per second (with a trailing refresh)', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    const storage = new StorageRepository(new InMemoryStorageBackend());
    const spy = jest.spyOn(storage, 'getStorageDetails');
    await renderHook(() => useSettings(storage));
    const reads = () => spy.mock.calls.length;
    const start = reads();

    const write = async () => {
      await act(async () => storage.set(STORAGE_KEYS.MARKET_SNAPSHOT, { v: 1, savedAt: Date.now(), tickers: {}, books: {} }));
    };
    await write(); // leading refresh
    expect(reads()).toBe(start + 1);
    await write();
    await write();
    expect(reads()).toBe(start + 1); // throttled
    await act(async () => jest.advanceTimersByTime(SNAPSHOT_REFRESH_MS));
    expect(reads()).toBe(start + 2); // one trailing refresh for both writes

    // Preference writes are never throttled.
    await act(async () => storage.setAdaptivePolling(true));
    expect(reads()).toBe(start + 3);
  });
});

describe('cadence slider', () => {
  it('commits the dragged cadence when the drag ends', async () => {
    const t = await renderSettings();
    await act(async () =>
      fireGestureHandler(getByGestureTestId('cadence-pan'), [
        { state: State.BEGAN, x: 0 },
        { state: State.ACTIVE, x: 100 },
        { state: State.END, x: 100 },
      ])
    );
    await settle();
    // 100 px of 300 px on a 100–1000 ms scale.
    expect(t.runtime.storage.getCadenceMs()).toBe(400);
  });

  it('does not commit when the drag is cancelled (e.g. the scroll view takes over)', async () => {
    const t = await renderSettings();
    await act(async () =>
      fireGestureHandler(getByGestureTestId('cadence-pan'), [
        { state: State.BEGAN, x: 0 },
        { state: State.ACTIVE, x: 150 },
        { state: State.CANCELLED, x: 150 },
      ])
    );
    await settle();
    expect(t.runtime.storage.getCadenceMs()).toBeNull();
  });

  it('sets the cadence from a tap on the track', async () => {
    const t = await renderSettings();
    await act(async () =>
      fireGestureHandler(getByGestureTestId('cadence-tap'), [
        { state: State.BEGAN, x: 200 },
        { state: State.ACTIVE, x: 200 },
        { state: State.END, x: 200 },
      ])
    );
    await settle();
    // 200 px of 300 px on a 100–1000 ms scale.
    expect(t.runtime.storage.getCadenceMs()).toBe(700);
  });

  it('supports screen-reader increment and decrement', async () => {
    const t = await renderSettings();
    const slider = screen.getByTestId('cadence-slider');
    await act(async () => fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }));
    await settle();
    expect(t.runtime.storage.getCadenceMs()).toBe(200);
    await act(async () => fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } }));
    await settle();
    expect(t.runtime.storage.getCadenceMs()).toBeNull(); // back at the minimum = gateway default
  });
});
