import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useIsFocused, useRouter } from 'expo-router';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { colors } from '../../theme/tokens';
import { usePairsMetadata } from '../../hooks/usePairsMetadata';
import { useFavorites } from '../../hooks/useFavorites';
import { useMarket } from '../../data/store/hooks';
import { useStreamRuntime } from '../../data/StreamProvider';
import { useChannels } from '../../data/useChannels';
import { ScreenActivity } from '../../data/screenActivity';
import { MarketStatusBanner } from '../common/MarketStatusBanner';
import { formatTimeOfDay } from '../../utils/formatters';
import { MarketPairCard } from './MarketPairCard';
import { MarketFilterBar } from './MarketFilterBar';
import { applyTab, buildRows, matchesQuery, MarketFilterTab, WatchRow } from './filterUtils';
import { styles } from './WatchlistScreen.styles';

/**
 * Tabs stay mounted: while this screen is hidden its market data is read paused (no re-renders on
 * updates), and it catches up with the latest values as soon as it is shown again.
 */
export function WatchlistScreen() {
  return (
    <ScreenActivity value={useIsFocused()}>
      <WatchlistScreenContent />
    </ScreenActivity>
  );
}

function WatchlistScreenContent() {
  const router = useRouter();
  const runtime = useStreamRuntime();
  const isFocused = useIsFocused();
  useChannels(['tickers'], isFocused);

  const { data: metadata, refetch, isError, updatedAt } = usePairsMetadata();
  const [favorites, toggleFavorite] = useFavorites();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<MarketFilterTab>('ALL');
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const rows = useMemo(() => buildRows(metadata), [metadata]);
  const rowBySymbol = useMemo(() => new Map(rows.map((r) => [r.symbol, r])), [rows]);
  const queried = useMemo(() => rows.filter((r) => matchesQuery(r, searchQuery)).map((r) => r.symbol), [rows, searchQuery]);

  // The list re-renders only when membership or order changes (e.g. a pair crossing 0% on the
  // Gainers tab), never on every price tick: the selector returns a primitive key.
  const orderKey = useMarket((s) =>
    applyTab(queried, activeTab, favorites, (sym) => s.tickers[sym]?.change24h ?? rowBySymbol.get(sym)?.snapshot?.change24h).join(',')
  );
  const displayed = useMemo(
    () => (orderKey ? orderKey.split(',').map((sym) => rowBySymbol.get(sym as SupportedPairSymbol)!) : []),
    [orderKey, rowBySymbol]
  );

  // Pull-to-refresh reloads reference data only; the WebSocket stream is untouched.
  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetch]);

  const handleSelectPair = useCallback(
    (symbol: SupportedPairSymbol) => {
      runtime.setActivePair(symbol);
      router.navigate({ pathname: '/', params: { symbol } });
    },
    [router, runtime]
  );

  const handleToggleFavorite = useCallback((symbol: SupportedPairSymbol) => void toggleFavorite(symbol), [toggleFavorite]);

  const renderItem = useCallback(
    ({ item }: { item: WatchRow }) => (
      <MarketPairCard
        row={item}
        isFavorite={favorites.includes(item.symbol)}
        onToggleFavorite={handleToggleFavorite}
        onPress={handleSelectPair}
      />
    ),
    [favorites, handleToggleFavorite, handleSelectPair]
  );

  const renderEmpty = () => {
    if (activeTab === 'FAVORITES' && favorites.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Favourites Yet</Text>
          <Text style={styles.emptyText}>Tap the star on any pair to add it to your favourites.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => setActiveTab('ALL')} activeOpacity={0.7}>
            <Text style={styles.emptyButtonText}>View All Markets</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Matching Pairs</Text>
        <Text style={styles.emptyText}>
          {searchQuery ? `No pairs match “${searchQuery}”.` : 'No pairs in this view right now.'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <MarketStatusBanner />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Spot Markets</Text>
          <Text style={styles.headerSubtitle}>
            {rows.length} pairs
            {updatedAt ? ` · details updated ${formatTimeOfDay(updatedAt)}` : isError ? ' · details unavailable, pull to retry' : ''}
          </Text>
        </View>
      </View>

      <MarketFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favoritesCount={favorites.length}
      />

      <FlashList
        data={displayed}
        renderItem={renderItem}
        keyExtractor={(item) => item.symbol}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        // Rows and stars respond on the first tap while searching; scrolling dismisses the keyboard.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={isManualRefreshing} onRefresh={handleRefresh} tintColor={colors.bidGreen} colors={[colors.bidGreen]} />
        }
      />
    </SafeAreaView>
  );
}
