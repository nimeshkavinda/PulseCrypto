import { useState, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchPairsMetadata, BASELINE_PAIRS_METADATA } from '../api/marketApi';
import { PairMetadata } from '@pulsecrypto/shared';
import { defaultStorage } from '../storage/storageRepository';

export interface UsePairsMetadataResult {
  data: PairMetadata[];
  isLoading: boolean;
  isRefetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

export function usePairsMetadata(): UsePairsMetadataResult {
  const [gatewayUrl, setGatewayUrl] = useState<string>(() => defaultStorage.getHttpGatewayUrl());
  const [isAppActive, setIsAppActive] = useState<boolean>(() => {
    try {
      return AppState.currentState === 'active';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const unsubscribe = defaultStorage.subscribeGatewayUrl(() => {
      setGatewayUrl(defaultStorage.getHttpGatewayUrl());
    });

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      setIsAppActive(status === 'active');
    });

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);

  const query = useQuery({
    queryKey: ['pairsMetadata', gatewayUrl],
    queryFn: () => fetchPairsMetadata(gatewayUrl),
    staleTime: 5000,
    // When the app is in the background, pause 10s REST polling to prevent radio wakeups
    refetchInterval: isAppActive ? 10000 : false,
    refetchOnWindowFocus: false,
    initialData: BASELINE_PAIRS_METADATA,
  });

  return {
    data: query.data ?? BASELINE_PAIRS_METADATA,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
