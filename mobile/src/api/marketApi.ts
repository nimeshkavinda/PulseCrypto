import {
  SUPPORTED_PAIRS,
  PairMetadata,
  PairMetadataSchema,
} from '@pulsecrypto/shared';
import { z } from 'zod';
import { defaultStorage } from '../storage/storageRepository';

/**
 * Baseline pair metadata seed matching the shared schema.
 * Provides resilient offline / initial fallback values for all 5 pairs.
 */
export const BASELINE_PAIRS_METADATA: PairMetadata[] = [
  {
    symbol: 'BTCUSDT',
    displayName: SUPPORTED_PAIRS.BTCUSDT.displayName,
    baseAsset: SUPPORTED_PAIRS.BTCUSDT.baseAsset,
    quoteAsset: SUPPORTED_PAIRS.BTCUSDT.quoteAsset,
    tradingStatus: 'TRADING',
    priceDecimals: SUPPORTED_PAIRS.BTCUSDT.priceDecimals,
    qtyDecimals: SUPPORTED_PAIRS.BTCUSDT.qtyDecimals,
    high24h: 65200.0,
    low24h: 62800.0,
    volume24h: 28410.5,
    lastPrice: 64238.17,
    change24h: 2.45,
  },
  {
    symbol: 'ETHUSDT',
    displayName: SUPPORTED_PAIRS.ETHUSDT.displayName,
    baseAsset: SUPPORTED_PAIRS.ETHUSDT.baseAsset,
    quoteAsset: SUPPORTED_PAIRS.ETHUSDT.quoteAsset,
    tradingStatus: 'TRADING',
    priceDecimals: SUPPORTED_PAIRS.ETHUSDT.priceDecimals,
    qtyDecimals: SUPPORTED_PAIRS.ETHUSDT.qtyDecimals,
    high24h: 3550.0,
    low24h: 3380.0,
    volume24h: 154200.0,
    lastPrice: 3485.5,
    change24h: -1.2,
  },
  {
    symbol: 'SOLUSDT',
    displayName: SUPPORTED_PAIRS.SOLUSDT.displayName,
    baseAsset: SUPPORTED_PAIRS.SOLUSDT.baseAsset,
    quoteAsset: SUPPORTED_PAIRS.SOLUSDT.quoteAsset,
    tradingStatus: 'TRADING',
    priceDecimals: SUPPORTED_PAIRS.SOLUSDT.priceDecimals,
    qtyDecimals: SUPPORTED_PAIRS.SOLUSDT.qtyDecimals,
    high24h: 158.0,
    low24h: 142.5,
    volume24h: 895400.0,
    lastPrice: 152.3,
    change24h: 5.8,
  },
  {
    symbol: 'DOGEUSDT',
    displayName: SUPPORTED_PAIRS.DOGEUSDT.displayName,
    baseAsset: SUPPORTED_PAIRS.DOGEUSDT.baseAsset,
    quoteAsset: SUPPORTED_PAIRS.DOGEUSDT.quoteAsset,
    tradingStatus: 'TRADING',
    priceDecimals: SUPPORTED_PAIRS.DOGEUSDT.priceDecimals,
    qtyDecimals: SUPPORTED_PAIRS.DOGEUSDT.qtyDecimals,
    high24h: 0.135,
    low24h: 0.118,
    volume24h: 42000000.0,
    lastPrice: 0.1245,
    change24h: 3.1,
  },
  {
    symbol: 'XRPUSDT',
    displayName: SUPPORTED_PAIRS.XRPUSDT.displayName,
    baseAsset: SUPPORTED_PAIRS.XRPUSDT.baseAsset,
    quoteAsset: SUPPORTED_PAIRS.XRPUSDT.quoteAsset,
    tradingStatus: 'TRADING',
    priceDecimals: SUPPORTED_PAIRS.XRPUSDT.priceDecimals,
    qtyDecimals: SUPPORTED_PAIRS.XRPUSDT.qtyDecimals,
    high24h: 0.62,
    low24h: 0.56,
    volume24h: 19800000.0,
    lastPrice: 0.584,
    change24h: -0.8,
  },
];

const PairsMetadataArraySchema = z.array(PairMetadataSchema);

import { resolveHttpBaseUrl as coreResolveHttpBaseUrl } from './urlUtils';

export function resolveHttpBaseUrl(url?: string): string {
  const target = url || defaultStorage.getHttpGatewayUrl();
  return coreResolveHttpBaseUrl(target);
}

/**
 * Fetch trading pairs metadata from GET /pairs/meta.
 * Fallbacks safely to baseline metadata if gateway is unreachable.
 */
export async function fetchPairsMetadata(customBaseUrl?: string): Promise<PairMetadata[]> {
  const baseUrl = resolveHttpBaseUrl(customBaseUrl);
  const endpoint = `${baseUrl}/pairs/meta`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return PairsMetadataArraySchema.parse(json);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[marketApi] Failed to fetch /pairs/meta from ${endpoint}. Using baseline fallback.`, err);
    return BASELINE_PAIRS_METADATA;
  }
}
