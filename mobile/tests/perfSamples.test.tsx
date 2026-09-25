import { act, renderHook } from '@testing-library/react-native';
import { usePerfSamples } from '../src/components/telemetry/usePerfSamples';

jest.mock('../modules/perf-monitor', () => ({
  PerfMonitor: {
    startFrameMonitor: jest.fn(),
    stopFrameMonitor: jest.fn(),
    getUiFrameRate: jest.fn(() => 60),
    getJsFrameRate: jest.fn(() => -1),
    getMemoryFootprintBytes: jest.fn(() => 100 * 1024 * 1024),
  },
}));
const mockNative = (jest.requireMock('../modules/perf-monitor') as { PerfMonitor: Record<string, jest.Mock> }).PerfMonitor;

describe('usePerfSamples', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockNative.getUiFrameRate.mockImplementation(() => 60);
    mockNative.getJsFrameRate.mockImplementation(() => -1);
  });

  it('samples only while enabled and starts each session from empty history', async () => {
    const { result, rerender } = await renderHook(({ on }: { on: boolean }) => usePerfSamples(on), { initialProps: { on: true } });
    await act(async () => jest.advanceTimersByTime(3000));
    expect(result.current.uiFps).toBe(60);
    expect(result.current.memoryMb).toHaveLength(3);

    await rerender({ on: false });
    expect(mockNative.stopFrameMonitor).toHaveBeenCalled();
    await rerender({ on: true });
    expect(result.current.memoryMb).toEqual([]);
    expect(result.current.uiFps).toBeNull();
  });

  it('turns native readings off instead of crashing when a native call throws', async () => {
    mockNative.getUiFrameRate.mockImplementation(() => {
      throw new Error('native failure');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result, unmount } = await renderHook(() => usePerfSamples(true));
    await act(async () => jest.advanceTimersByTime(1000));
    expect(result.current.nativeAvailable).toBe(false);
    expect(result.current.uiFps).toBeNull();
    // The native monitor is still stopped when the screen goes away.
    const stopsBefore = mockNative.stopFrameMonitor.mock.calls.length;
    await unmount();
    expect(mockNative.stopFrameMonitor.mock.calls.length).toBe(stopsBefore + 1);
    warn.mockRestore();
  });
});

describe('JS frame rate source', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockNative.getJsFrameRate.mockImplementation(() => -1);
  });

  it('uses the native JS-thread reading where the platform provides one (Android) and stops counting rAF', async () => {
    mockNative.getJsFrameRate.mockImplementation(() => 58.6);
    const cancel = jest.spyOn(global, 'cancelAnimationFrame');
    const { result, unmount } = await renderHook(() => usePerfSamples(true));
    await act(async () => jest.advanceTimersByTime(2000));
    expect(result.current.jsFps).toBe(59);
    expect(cancel).toHaveBeenCalled();
    await unmount();
    cancel.mockRestore();
  });

  it('counts requestAnimationFrame callbacks where the native reading is not measured (iOS)', async () => {
    const { result, unmount } = await renderHook(() => usePerfSamples(true));
    await act(async () => jest.advanceTimersByTime(2000));
    expect(result.current.jsFps).toBeGreaterThan(0);
    await unmount();
  });
});

describe('shared perf sampler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('keeps the native monitor running until the last consumer stops (Telemetry + overlay)', async () => {
    const a = await renderHook(() => usePerfSamples(true));
    const b = await renderHook(() => usePerfSamples(true));
    expect(mockNative.startFrameMonitor).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(2000));
    expect(b.result.current.uiFps).toBe(60);

    await a.unmount();
    expect(mockNative.stopFrameMonitor).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1000));
    expect(b.result.current.memoryMb.length).toBeGreaterThan(0);

    await b.unmount();
    expect(mockNative.stopFrameMonitor).toHaveBeenCalledTimes(1);
  });
});
