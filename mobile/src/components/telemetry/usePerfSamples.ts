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
  const jsFrames = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = () => {
      jsFrames.current++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    PerfMonitor?.startFrameMonitor();

    let last = Date.now();
    jsFrames.current = 0;
    const id = setInterval(() => {
      const now = Date.now();
      setJsFps(Math.round((jsFrames.current * 1000) / (now - last)));
      jsFrames.current = 0;
      last = now;
      if (PerfMonitor) {
        const ui = PerfMonitor.getUiFrameRate();
        setUiFps(ui > 0 ? Math.round(ui) : null);
        const bytes = PerfMonitor.getMemoryFootprintBytes();
        if (bytes > 0) setMemoryMb((prev) => [...prev.slice(-(MEMORY_POINTS - 1)), bytes / (1024 * 1024)]);
      }
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
      PerfMonitor?.stopFrameMonitor();
    };
  }, [enabled]);

  return { uiFps, jsFps, memoryMb, nativeAvailable: PerfMonitor !== null };
}
