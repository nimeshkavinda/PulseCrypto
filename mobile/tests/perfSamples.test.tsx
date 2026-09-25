import { act, renderHook } from '@testing-library/react-native';
import { usePerfSamples } from '../src/components/telemetry/usePerfSamples';

jest.mock('../modules/perf-monitor', () => ({
  PerfMonitor: {
    startFrameMonitor: jest.fn(),
    stopFrameMonitor: jest.fn(),
    getUiFrameRate: jest.fn(() => 60),
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
