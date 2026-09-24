import { useEffect, useRef, useState } from 'react';
import { PerfMonitor } from '../../../modules/perf-monitor';

export interface PerfSamples {
  /** UI (main) thread frames per second from the native frame monitor; null if unavailable. */
  uiFps: number | null;
  /** JS thread frames per second (requestAnimationFrame callbacks per second). */
  jsFps: number | null;
  /** Process memory footprint history in MB (oldest first); empty if unavailable. */
  memoryMb: number[];
  nativeAvailable: boolean;
}

const MEMORY_POINTS = 30;

/**
 * Samples performance only while `enabled` (the telemetry tab is focused): the rAF loop, the 1 s
 * poll and the native frame monitor all stop when the tab is hidden.
 */
export function usePerfSamples(enabled: boolean): PerfSamples {
  const [uiFps, setUiFps] = useState<number | null>(null);
  const [jsFps, setJsFps] = useState<number | null>(null);
  const [memoryMb, setMemoryMb] = useState<number[]>([]);
  const [nativeFailed, setNativeFailed] = useState(false);
  const jsFrames = useRef(0);

  // Each focus starts a fresh session: no FPS or memory carried over from the last visit.
  // Reset during render on the off -> on transition (React's pattern for state derived from props).
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (enabled) {
      setUiFps(null);
      setJsFps(null);
      setMemoryMb([]);
      setNativeFailed(false);
    }
  }

  useEffect(() => {
    if (!enabled) return;

    // A native call that throws turns the native readings off for this session instead of
    // crashing the screen; the gauges then say "unavailable".
    let native = PerfMonitor;
    const callNative = <T,>(fn: (m: NonNullable<typeof PerfMonitor>) => T): T | null => {
      if (!native) return null;
      try {
        return fn(native);
      } catch (err) {
        if (__DEV__) console.warn('[perf] native monitor failed', err);
        native = null;
        setNativeFailed(true);
        setUiFps(null);
        return null;
      }
    };

    let raf = 0;
    const loop = () => {
      jsFrames.current++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    callNative((m) => m.startFrameMonitor());

    let last = Date.now();
    jsFrames.current = 0;
    const id = setInterval(() => {
      const now = Date.now();
      setJsFps(Math.round((jsFrames.current * 1000) / (now - last)));
      jsFrames.current = 0;
      last = now;
      const ui = callNative((m) => m.getUiFrameRate());
      if (ui !== null) setUiFps(ui > 0 ? Math.round(ui) : null);
      const bytes = callNative((m) => m.getMemoryFootprintBytes());
      if (bytes !== null && bytes > 0) setMemoryMb((prev) => [...prev.slice(-(MEMORY_POINTS - 1)), bytes / (1024 * 1024)]);
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
      // Always stop the native monitor, even after a failed call switched readings off: otherwise
      // the Android Choreographer callback keeps running while the tab is hidden.
      try {
        PerfMonitor?.stopFrameMonitor();
      } catch {
        // nothing more to do
      }
    };
  }, [enabled]);

  return { uiFps, jsFps, memoryMb, nativeAvailable: PerfMonitor !== null && !nativeFailed };
}
