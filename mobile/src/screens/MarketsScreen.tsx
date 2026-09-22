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
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { PairMetadata } from '@pulsecrypto/shared';
import { colors } from '../theme/tokens';
import { usePairsMetadata } from '../hooks/usePairsMetadata';
import { useFavorites } from '../hooks/useFavorites';
import { MarketPairCard } from './watchlist/MarketPairCard';
import { MarketFilterBar } from './watchlist/MarketFilterBar';
import { filterAndSortPairs, MarketFilterTab } from './watchlist/filterUtils';
import { defaultStorage } from '../storage/storageRepository';
import type { BottomTabParamList } from '../navigation/types';
import { styles } from './MarketsScreen.styles';

export function MarketsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<BottomTabParamList, 'Markets'>>();
  const { data: pairs, isRefetching, refetch, isLoading } = usePairsMetadata();
  const [favorites, toggleFavorite] = useFavorites();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<MarketFilterTab>('ALL');

  const handleSelectPair = useCallback(
    (symbol: string) => {
      defaultStorage.setActivePair(symbol);
      navigation.navigate('Terminal', { symbol });
    },
    [navigation]
  );

  const displayedPairs = useMemo(
    () => filterAndSortPairs(pairs, searchQuery, activeTab, favorites),
    [pairs, searchQuery, activeTab, favorites]
  );

  const renderItem = useCallback(
    ({ item }: { item: PairMetadata }) => (
      <MarketPairCard
        item={item}
        isFavorite={favorites.includes(item.symbol)}
        onToggleFavorite={toggleFavorite}
        onPress={handleSelectPair}
      />
    ),
    [favorites, toggleFavorite, handleSelectPair]
  );

  const keyExtractor = useCallback((item: PairMetadata) => item.symbol, []);

  const renderEmptyComponent = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.bidGreen} />
          <Text style={styles.emptyText}>Loading markets...</Text>
        </View>
      );
    }

    if (activeTab === 'FAVORITES' && favorites.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Favourites Yet</Text>
          <Text style={styles.emptyText}>
            Tap the star icon on any pair to add it to your favourites watchlist.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setActiveTab('ALL')}
          >
            <Text style={styles.emptyButtonText}>View All Pairs</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (searchQuery.trim().length > 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Matching Pairs</Text>
          <Text style={styles.emptyText}>
            No results found for &ldquo;{searchQuery}&rdquo;.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.emptyButtonText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No trading pairs available</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Markets Watchlist</Text>
          <Text style={styles.headerSubtitle}>
            {displayedPairs.length} of {pairs.length} pairs
          </Text>
        </View>

        {isRefetching && (
          <View style={styles.syncBadge}>
            <ActivityIndicator size="small" color={colors.bidGreen} />
            <Text style={styles.syncText}>SYNCING</Text>
          </View>
        )}
      </View>

      {/* Search and Filter Tabs */}
      <MarketFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favoritesCount={favorites.length}
      />

      {/* High-Performance Recycling FlashList */}
      <FlashList
        data={displayedPairs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.bidGreen}
            colors={[colors.bidGreen]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListEmptyComponent={renderEmptyComponent}
      />
    </SafeAreaView>
  );
}
