import { useCallback, useSyncExternalStore } from 'react';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { defaultStorage, StorageRepository, STORAGE_KEYS } from '../storage/storageRepository';

/** Favourites persisted in MMKV, shared live across every screen that uses them. */
export function useFavorites(
  storage: StorageRepository = defaultStorage
): [SupportedPairSymbol[], (symbol: SupportedPairSymbol) => boolean] {
  const subscribe = useCallback((cb: () => void) => storage.subscribe(STORAGE_KEYS.FAVORITES, cb), [storage]);
  // Snapshot is the serialized list (a primitive), so unchanged favourites never re-render.
  const read = useCallback(() => storage.getFavorites().join(','), [storage]);
  const serialized = useSyncExternalStore(subscribe, read);
  const favorites = serialized ? (serialized.split(',') as SupportedPairSymbol[]) : [];
  const toggle = useCallback((symbol: SupportedPairSymbol) => storage.toggleFavorite(symbol), [storage]);
  return [favorites, toggle];
}
