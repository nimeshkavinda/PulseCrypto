import { SUPPORTED_PAIRS, SupportedPairSymbol } from '@pulsecrypto/shared';
import { MetadataService, PairStaticInfo, Ticker24h } from '../../src/metadata.js';

export const PAIRS = Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[];

export function staticInfo(pair: SupportedPairSymbol, overrides: Partial<PairStaticInfo> = {}): PairStaticInfo {
  const c = SUPPORTED_PAIRS[pair];
  return {
    displayName: c.displayName,
    baseAsset: c.baseAsset,
    quoteAsset: c.quoteAsset,
    tradingStatus: 'TRADING',
    priceDecimals: c.priceDecimals,
    qtyDecimals: c.qtyDecimals,
    ...overrides,
  };
}

export function ticker24h(overrides: Partial<Ticker24h> = {}): Ticker24h {
  return { lastPrice: 100, high24h: 110, low24h: 90, volume24h: 1000, changePct: 1.5, eventTs: 1_000, ...overrides };
}

/** A MetadataService that has received exchange info and 24h stats for every pair. */
export function readyMetadata(): MetadataService {
  const m = new MetadataService();
  for (const pair of PAIRS) {
    m.applyExchangeInfo(pair, staticInfo(pair));
    m.applyTicker24h(pair, ticker24h());
  }
  return m;
}
