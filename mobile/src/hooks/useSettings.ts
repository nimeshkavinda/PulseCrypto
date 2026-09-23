import { useState, useEffect, useCallback } from 'react';
import { defaultStorage, StorageStats } from '../storage/storageRepository';

export interface UseSettingsResult {
  throttleMs: number;
  gatewayUrl: string;
  compressionEnabled: boolean;
  adaptivePollingEnabled: boolean;
  storageStats: StorageStats;
  setThrottle: (intervalMs: number) => void;
  setGatewayUrl: (url: string) => void;
  setCompression: (enabled: boolean) => void;
  setAdaptivePolling: (enabled: boolean) => void;
  resetDefaults: () => void;
  clearCache: () => void;
}

export function useSettings(): UseSettingsResult {
  const [throttleMs, setThrottleState] = useState<number>(() => defaultStorage.getClientThrottle());
  const [gatewayUrl, setGatewayUrlState] = useState<string>(() => defaultStorage.getGatewayUrl());
  const [compressionEnabled, setCompressionState] = useState<boolean>(() => defaultStorage.getBinaryCompression());
  const [adaptivePollingEnabled, setAdaptivePollingState] = useState<boolean>(() => defaultStorage.getAdaptivePolling());
  const [storageStats, setStorageStats] = useState(() => defaultStorage.getStorageStats());

  useEffect(() => {
    const unsubThrottle = defaultStorage.subscribeClientThrottle((ms) => {
      setThrottleState(ms);
    });
    const unsubGateway = defaultStorage.subscribeGatewayUrl((url) => {
      setGatewayUrlState(url);
    });
    // Re-read storage stats whenever any key is written/deleted
    const unsubStorageChange = defaultStorage.subscribeStorageChange(() => {
      setStorageStats(defaultStorage.getStorageStats());
    });

    return () => {
      unsubThrottle();
      unsubGateway();
      unsubStorageChange();
    };
  }, []);

  const setThrottle = useCallback((intervalMs: number) => {
    defaultStorage.setClientThrottle(intervalMs);
    setThrottleState(intervalMs);
  }, []);

  const setGatewayUrl = useCallback((url: string) => {
    defaultStorage.setGatewayUrl(url);
    setGatewayUrlState(url);
  }, []);

  const setCompression = useCallback((enabled: boolean) => {
    defaultStorage.setBinaryCompression(enabled);
    setCompressionState(enabled);
  }, []);

  const setAdaptivePolling = useCallback((enabled: boolean) => {
    defaultStorage.setAdaptivePolling(enabled);
    setAdaptivePollingState(enabled);
  }, []);

  const resetDefaults = useCallback(() => {
    defaultStorage.resetDefaults();
    setThrottleState(defaultStorage.getClientThrottle());
    setGatewayUrlState(defaultStorage.getGatewayUrl());
    setCompressionState(defaultStorage.getBinaryCompression());
    setAdaptivePollingState(defaultStorage.getAdaptivePolling());
    setStorageStats(defaultStorage.getStorageStats());
  }, []);

  const clearCache = useCallback(() => {
    defaultStorage.clearAll();
    defaultStorage.resetDefaults();
    setThrottleState(defaultStorage.getClientThrottle());
    setGatewayUrlState(defaultStorage.getGatewayUrl());
    setCompressionState(defaultStorage.getBinaryCompression());
    setAdaptivePollingState(defaultStorage.getAdaptivePolling());
    setStorageStats(defaultStorage.getStorageStats());
  }, []);

  return {
    throttleMs,
    gatewayUrl,
    compressionEnabled,
    adaptivePollingEnabled,
    storageStats,
    setThrottle,
    setGatewayUrl,
    setCompression,
    setAdaptivePolling,
    resetDefaults,
    clearCache,
  };
}
