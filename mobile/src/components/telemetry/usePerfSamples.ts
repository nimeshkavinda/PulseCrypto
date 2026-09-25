import { useCallback, useSyncExternalStore } from 'react';
import { perfSampler, PerfSamples } from './perfSampler';

export type { PerfSamples } from './perfSampler';

const noopSubscribe = () => () => {};

/**
 * Performance samples while `enabled` (e.g. the Telemetry tab is focused, or the overlay is on).
 * All consumers share one sampler, which runs only while at least one of them is enabled.
 */
export function usePerfSamples(enabled: boolean): PerfSamples {
  const subscribe = useCallback((listener: () => void) => perfSampler.subscribe(listener), []);
  return useSyncExternalStore(enabled ? subscribe : noopSubscribe, perfSampler.getSnapshot);
}
