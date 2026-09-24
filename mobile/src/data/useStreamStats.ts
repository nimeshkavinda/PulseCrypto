import { useEffect, useRef, useState } from 'react';
import { useStreamRuntime } from './StreamProvider';

export interface StreamRates {
  framesPerSec: number;
  messagesPerSec: number;
  kbPerSec: number;
}

/**
 * Samples the client's counters once per second while `enabled` (e.g. while the telemetry screen is
 * focused). Nothing else re-renders because of telemetry.
 */
export function useStreamStats(enabled: boolean): { rates: StreamRates; reset: () => void } {
  const runtime = useStreamRuntime();
  const [rates, setRates] = useState<StreamRates>({ framesPerSec: 0, messagesPerSec: 0, kbPerSec: 0 });
  const last = useRef(runtime.client.getStats());

  useEffect(() => {
    if (!enabled) return;
    last.current = runtime.client.getStats();
    const id = setInterval(() => {
      const now = runtime.client.getStats();
      setRates({
        framesPerSec: now.frames - last.current.frames,
        messagesPerSec: now.messages - last.current.messages,
        kbPerSec: Number(((now.bytes - last.current.bytes) / 1024).toFixed(1)),
      });
      last.current = now;
    }, 1000);
    return () => clearInterval(id);
  }, [runtime, enabled]);

  const reset = () => {
    last.current = runtime.client.getStats();
    setRates({ framesPerSec: 0, messagesPerSec: 0, kbPerSec: 0 });
  };
  return { rates, reset };
}
