import { useCallback, useEffect, useState } from 'react';
import { defaultStorage, StorageDetails, StorageRepository, StorageStats, STORAGE_KEYS } from '../storage/storageRepository';

export interface UseSettingsResult {
  /** User-preferred cadence in ms, or null for the gateway default. */
  cadenceMs: number | null;
  gatewayOverride: string | null;
  adaptivePollingEnabled: boolean;
  storage: StorageDetails;
  storageStats: StorageStats;
  setCadence: (ms: number | null) => void;
  setGatewayOverride: (url: string | null) => void;
  setAdaptivePolling: (enabled: boolean) => void;
}

/** The market snapshot is rewritten every few seconds; the storage card refreshes at most this often for it. */
export const SNAPSHOT_REFRESH_MS = 1000;

const read = (storage: StorageRepository) => ({
  cadenceMs: storage.getCadenceMs(),
  gatewayOverride: storage.getGatewayOverride(),
  adaptivePollingEnabled: storage.getAdaptivePolling(),
  storage: storage.getStorageDetails(),
  storageStats: storage.getStorageStats(),
});

/**
 * User preferences and the storage card's contents, backed by storage. Re-reads on any key change
 * (favourites toggled on the Markets tab included); snapshot writes are throttled to one per second.
 */
export function useSettings(storage: StorageRepository = defaultStorage): UseSettingsResult {
  const [state, setState] = useState(() => read(storage));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSnapshotRead = 0;
    const refresh = () => setState(read(storage));
    const unsubscribe = storage.subscribeAll((key) => {
      // Preference changes, and the snapshot being cleared, show at once.
      if (key !== STORAGE_KEYS.MARKET_SNAPSHOT || !storage.has(key)) {
        if (timer) clearTimeout(timer);
        timer = null;
        refresh();
        return;
      }
      if (timer) return; // a trailing refresh is already scheduled
      const wait = lastSnapshotRead + SNAPSHOT_REFRESH_MS - Date.now();
      if (wait <= 0) {
        lastSnapshotRead = Date.now();
        refresh();
      } else {
        timer = setTimeout(() => {
          timer = null;
          lastSnapshotRead = Date.now();
          refresh();
        }, wait);
      }
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [storage]);

  return {
    ...state,
    setCadence: useCallback((ms: number | null) => storage.setCadenceMs(ms), [storage]),
    setGatewayOverride: useCallback((url: string | null) => storage.setGatewayOverride(url), [storage]),
    setAdaptivePolling: useCallback((enabled: boolean) => storage.setAdaptivePolling(enabled), [storage]),
  };
}
