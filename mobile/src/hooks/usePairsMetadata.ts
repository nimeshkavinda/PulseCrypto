import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const unsubscribe = defaultStorage.subscribeGatewayUrl(() => {
      setGatewayUrl(defaultStorage.getHttpGatewayUrl());
    });
    return unsubscribe;
  }, []);

  const query = useQuery({
    queryKey: ['pairsMetadata', gatewayUrl],
    queryFn: () => fetchPairsMetadata(gatewayUrl),
    staleTime: 5000,
    refetchInterval: 10000, // Background poll every 10s for 24h stats
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
