import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { PairMetadata, SupportedPairSymbol } from '@pulsecrypto/shared';
import { colors } from '../../theme/tokens';
import { usePairsMetadata } from '../../hooks/usePairsMetadata';
import { useFavorites } from '../../hooks/useFavorites';
import { useConnectionState, useUpstream } from '../../data/store/hooks';
import { useStreamRuntime } from '../../data/StreamProvider';
import { describeStatus } from '../../data/connectionStatus';
import { MarketPairCard } from './MarketPairCard';
import { MarketFilterBar } from './MarketFilterBar';
import { filterAndSortPairs, MarketFilterTab } from './filterUtils';
import { styles } from './WatchlistScreen.styles';

export function WatchlistScreen() {
  const router = useRouter();
  const { data: pairs, refetch, isLoading, isError } = usePairsMetadata();
  const runtime = useStreamRuntime();
  const isLive = describeStatus(useConnectionState(), useUpstream()).tone === 'live';
  const [favorites, toggleFavorite] = useFavorites();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<MarketFilterTab>('ALL');
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refetch]);

  const handleSelectPair = useCallback(
    (symbol: string) => {
      runtime.setActivePair(symbol as SupportedPairSymbol);
      router.navigate({ pathname: '/', params: { symbol } });
    },
    [router, runtime]
  );

  const displayedPairs = useMemo(
    () => filterAndSortPairs(pairs ?? [], searchQuery, activeTab, favorites),
    [pairs, searchQuery, activeTab, favorites]
  );

  const renderItem = useCallback(
    ({ item }: { item: PairMetadata }) => (
      <MarketPairCard
        item={item}
        isFavorite={favorites.includes(item.symbol)}
        isLive={isLive}
        onToggleFavorite={(symbol) => toggleFavorite(symbol as SupportedPairSymbol)}
        onPress={handleSelectPair}
      />
    ),
    [favorites, isLive, toggleFavorite, handleSelectPair]
  );

  const keyExtractor = useCallback((item: PairMetadata) => item.symbol, []);

  const renderEmptyComponent = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.bidGreen} />
          <Text style={[styles.emptyText, { marginTop: 16 }]}>Loading live market pairs...</Text>
        </View>
      );
    }

    if (isError && !pairs) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Markets Unavailable</Text>
          <Text style={styles.emptyText}>Couldn&rsquo;t load the market list from the gateway. Pull down to retry.</Text>
        </View>
      );
    }

    if (activeTab === 'FAVORITES' && favorites.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Favourites Yet</Text>
          <Text style={styles.emptyText}>
            Tap the star icon on any trading pair to add it to your quick-access favourites watchlist.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setActiveTab('ALL')}
            activeOpacity={0.7}
          >
            <Text style={styles.emptyButtonText}>View All Markets</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Matching Pairs</Text>
        <Text style={styles.emptyText}>
          No trading pairs matched your search criteria for &ldquo;{searchQuery}&rdquo;.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Watchlist Section Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Spot Markets</Text>
          <Text style={styles.headerSubtitle}>
            {pairs ? `${displayedPairs.length} pairs` : 'Loading pairs…'}
          </Text>
        </View>
        <View style={styles.syncBadge}>
          <Text style={styles.syncText}>SYNCED</Text>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <MarketFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favoritesCount={favorites.length}
      />

      {/* High-Performance Virtualized Pair List */}
      <FlashList
        data={displayedPairs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.bidGreen}
            colors={[colors.bidGreen]}
          />
        }
      />
    </SafeAreaView>
  );
}
