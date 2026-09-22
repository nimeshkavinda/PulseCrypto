import { useState, useEffect, useCallback } from 'react';
import { defaultStorage } from '../storage/storageRepository';

/**
 * Reactive React hook for MMKV-persisted favourites.
 * Subscribes to storage updates across tabs and drawer components.
 */
export function useFavorites(): [string[], (symbol: string) => boolean] {
  const [favorites, setFavorites] = useState<string[]>(() => defaultStorage.getFavorites());

  useEffect(() => {
    setFavorites(defaultStorage.getFavorites());
    return defaultStorage.subscribeFavorites((updated) => {
      setFavorites(updated);
    });
  }, []);

  const toggleFavorite = useCallback((symbol: string) => {
    return defaultStorage.toggleFavorite(symbol);
  }, []);

  return [favorites, toggleFavorite];
}
