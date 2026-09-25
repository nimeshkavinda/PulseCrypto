import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PerfOverlay } from '../src/components/common/PerfOverlay';
import { defaultStorage } from '../src/storage/storageRepository';

jest.mock('../modules/perf-monitor', () => ({
  PerfMonitor: {
    startFrameMonitor: jest.fn(),
    stopFrameMonitor: jest.fn(),
    getUiFrameRate: jest.fn(() => 60),
    getMemoryFootprintBytes: jest.fn(() => 200 * 1024 * 1024),
  },
}));
let mockPath = '/';
jest.mock('expo-router', () => ({ usePathname: () => mockPath }));

const mockNative = (jest.requireMock('../modules/perf-monitor') as { PerfMonitor: Record<string, jest.Mock> }).PerfMonitor;

const metrics = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 40, left: 0, right: 0, bottom: 0 } };

describe('PerfOverlay', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    defaultStorage.setPerfOverlay(false);
    mockPath = '/';
  });

  it('stays hidden on the Telemetry tab, which already shows the full readings', async () => {
    mockPath = '/telemetry';
    defaultStorage.setPerfOverlay(true);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PerfOverlay />
      </SafeAreaProvider>
    );
    await act(async () => jest.advanceTimersByTime(1000));
    expect(screen.queryByLabelText(/^Performance:/)).toBeNull();
  });

  it('shows UI/JS FPS and memory only while switched on, and stops sampling when switched off', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <PerfOverlay />
      </SafeAreaProvider>
    );
    expect(screen.queryByLabelText(/^Performance:/)).toBeNull();

    await act(async () => defaultStorage.setPerfOverlay(true));
    await act(async () => jest.advanceTimersByTime(2000));
    expect(screen.getByLabelText(/^Performance: UI 60 FPS, JS \d+ FPS, 200 MB$/)).toBeTruthy();

    // Storage change notifications are delivered on the next timer tick.
    await act(async () => {
      defaultStorage.setPerfOverlay(false);
      jest.advanceTimersByTime(0);
    });
    expect(screen.queryByLabelText(/^Performance:/)).toBeNull();
    expect(mockNative.stopFrameMonitor).toHaveBeenCalled();
  });
});
