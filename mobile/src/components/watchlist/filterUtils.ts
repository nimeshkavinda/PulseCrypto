import { PairMetadata } from '@pulsecrypto/shared';

export type MarketFilterTab = 'ALL' | 'FAVORITES' | 'GAINERS' | 'LOSERS';

export const FILTER_TABS: { id: MarketFilterTab; label: string }[] = [
  { id: 'ALL', label: 'All Pairs' },
  { id: 'FAVORITES', label: 'Favourites' },
  { id: 'GAINERS', label: 'Gainers' },
  { id: 'LOSERS', label: 'Losers' },
];

/**
 * Filter and sort pairs by real-time search query and active tab filter.
 */
export function filterAndSortPairs(
  pairs: PairMetadata[],
  searchQuery: string,
  filterTab: MarketFilterTab,
  favorites: string[]
): PairMetadata[] {
  const query = searchQuery.trim().toLowerCase();

  // 1. Filter by search query (symbol, display name, or base asset)
  let result = pairs.filter((item) => {
    if (!query) return true;
    return (
      item.symbol.toLowerCase().includes(query) ||
      item.displayName.toLowerCase().includes(query) ||
      item.baseAsset.toLowerCase().includes(query)
    );
  });

  // 2. Filter & Sort by active tab
  switch (filterTab) {
    case 'FAVORITES':
      result = result.filter((item) => favorites.includes(item.symbol));
      break;
    case 'GAINERS':
      result = result
        .filter((item) => item.change24h >= 0)
        .sort((a, b) => b.change24h - a.change24h);
      break;
    case 'LOSERS':
      result = result
        .filter((item) => item.change24h < 0)
        .sort((a, b) => a.change24h - b.change24h);
      break;
    case 'ALL':
    default:
      // Keep natural order
      break;
  }

  return result;
}
