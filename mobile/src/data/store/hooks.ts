import { useStoreWithEqualityFn } from 'zustand/traditional';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { useStreamRuntime } from '../StreamProvider';
import { useScreenActive } from '../screenActivity';
import { MarketState } from './marketStore';

/** While a screen is hidden every update compares equal, so nothing re-renders until it is shown. */
const pausedEquality = () => true;

/**
 * Select from the market store. Use narrow selectors: components re-render only when the selected
 * value changes, and not at all while their screen is hidden (see ScreenActivity).
 */
export function useMarket<T>(selector: (s: MarketState) => T): T {
  const active = useScreenActive();
  return useStoreWithEqualityFn(useStreamRuntime().store, selector, active ? Object.is : pausedEquality);
}

export const useTicker = (pair: SupportedPairSymbol) => useMarket((s) => s.tickers[pair]);
export const useBook = (pair: SupportedPairSymbol) => useMarket((s) => s.books[pair]);
export const useActivePair = () => useMarket((s) => s.activePair);
export const useConnectionState = () => useMarket((s) => s.connection.state);
export const useConnection = () => useMarket((s) => s.connection);
export const useUpstream = () => useMarket((s) => s.upstream);
export const useCachedAt = () => useMarket((s) => s.cachedAt);
export const useAdaptiveActive = () => useMarket((s) => s.adaptiveActive);
