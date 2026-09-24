import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PairMetadata } from '@pulsecrypto/shared';
import { fetchPairsMetadata, MetadataUnavailableError } from '../api/marketApi';
import { currentGatewayConfig } from '../config/gateway';
import { defaultStorage, STORAGE_KEYS } from '../storage/storageRepository';

export interface UsePairsMetadataResult {
  data: PairMetadata[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** When metadata was last fetched successfully (epoch ms), 0 if never. */
  updatedAt: number;
  refetch: () => Promise<unknown>;
}

/**
 * A 503 during gateway warm-up is expected and temporary: keep retrying. Anything else (network,
 * HTTP, parse) gets 3 retries.
 */
export function shouldRetryMetadata(failures: number, error: unknown): boolean {
  return error instanceof MetadataUnavailableError || failures < 3;
}

/**
 * Retry pacing: the gateway's Retry-After when it sent one, otherwise exponential; kept within
 * 1–10 s (warm-up retries are unlimited, so `Retry-After: 0` must not become a tight loop).
 */
export function metadataRetryDelay(attempt: number, error: unknown): number {
  if (error instanceof MetadataUnavailableError && error.retryAfterS !== null) {
    return Math.min(Math.max(error.retryAfterS * 1000, 1000), 10_000);
  }
  return Math.min(1000 * 2 ** attempt, 10_000);
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
    retry: shouldRetryMetadata,
    retryDelay: metadataRetryDelay,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    updatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
  };
}
