import { useCallback, useEffect, useState } from 'react';
import { defaultStorage, StorageStats, STORAGE_KEYS } from '../storage/storageRepository';

export interface UseSettingsResult {
  /** User-preferred cadence in ms, or null for the gateway default. */
  cadenceMs: number | null;
  gatewayOverride: string | null;
  adaptivePollingEnabled: boolean;
  storageStats: StorageStats;
  setCadence: (ms: number | null) => void;
  setGatewayOverride: (url: string | null) => void;
  setAdaptivePolling: (enabled: boolean) => void;
  resetDefaults: () => void;
}

const read = () => ({
  cadenceMs: defaultStorage.getCadenceMs(),
  gatewayOverride: defaultStorage.getGatewayOverride(),
  adaptivePollingEnabled: defaultStorage.getAdaptivePolling(),
  storageStats: defaultStorage.getStorageStats(),
});

/** User preferences backed by storage; re-reads whenever any key changes. */
export function useSettings(): UseSettingsResult {
  const [state, setState] = useState(read);

  // The market snapshot is rewritten every few seconds; it is not a preference, so ignore it.
  useEffect(
    () =>
      defaultStorage.subscribeAll((key) => {
        if (key !== STORAGE_KEYS.MARKET_SNAPSHOT) setState(read());
      }),
    []
  );

  return {
    ...state,
    setCadence: useCallback((ms: number | null) => defaultStorage.setCadenceMs(ms), []),
    setGatewayOverride: useCallback((url: string | null) => defaultStorage.setGatewayOverride(url), []),
    setAdaptivePolling: useCallback((enabled: boolean) => defaultStorage.setAdaptivePolling(enabled), []),
    resetDefaults: useCallback(() => defaultStorage.resetDefaults(), []),
  };
}
