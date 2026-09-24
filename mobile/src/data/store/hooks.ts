import { useStore } from 'zustand';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { useStreamRuntime } from '../StreamProvider';
import { MarketState } from './marketStore';

/** Select from the market store. Use narrow selectors: components re-render only when the selected value changes. */
export function useMarket<T>(selector: (s: MarketState) => T): T {
  return useStore(useStreamRuntime().store, selector);
}

export const useTicker = (pair: SupportedPairSymbol) => useMarket((s) => s.tickers[pair]);
export const useBook = (pair: SupportedPairSymbol) => useMarket((s) => s.books[pair]);
export const useActivePair = () => useMarket((s) => s.activePair);
export const useConnectionState = () => useMarket((s) => s.connection.state);
export const useConnection = () => useMarket((s) => s.connection);
export const useUpstream = () => useMarket((s) => s.upstream);
export const useCachedAt = () => useMarket((s) => s.cachedAt);
