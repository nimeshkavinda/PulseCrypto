import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PairMetadata } from '@pulsecrypto/shared';
import { fetchPairsMetadata } from '../api/marketApi';
import { currentGatewayConfig } from '../config/gateway';
import { defaultStorage, STORAGE_KEYS } from '../storage/storageRepository';

export interface UsePairsMetadataResult {
  data: PairMetadata[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

/**
 * Pair reference data (display names, decimals, trading status, 24h stats) from GET /pairs/meta.
 * Fetched on demand and on pull-to-refresh; live prices arrive on the WebSocket `tickers` channel.
 */
export function usePairsMetadata(): UsePairsMetadataResult {
  const [httpUrl, setHttpUrl] = useState(() => currentGatewayConfig().httpUrl);
  useEffect(
    () => defaultStorage.subscribe(STORAGE_KEYS.GATEWAY_URL_OVERRIDE, () => setHttpUrl(currentGatewayConfig().httpUrl)),
    []
  );

  const query = useQuery({
    queryKey: ['pairsMetadata', httpUrl],
    queryFn: () => fetchPairsMetadata(httpUrl),
    staleTime: 60_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
