import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { PairMetadata } from '@pulsecrypto/shared';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';
import { usePairsMetadata } from '../hooks/usePairsMetadata';
import { useFavorites } from '../hooks/useFavorites';
import { MarketPairCard } from './watchlist/MarketPairCard';
import { MarketFilterBar } from './watchlist/MarketFilterBar';
import { filterAndSortPairs, MarketFilterTab } from './watchlist/filterUtils';
import { defaultStorage } from '../storage/storageRepository';
import type { BottomTabParamList } from '../navigation/types';

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
    <SafeAreaView style={styles.container}>
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

      {/* Main Pair List */}
      <FlatList
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.title,
    fontWeight: typography.fontWeight.bold,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    marginTop: 2,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bidGreenSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    gap: 6,
  },
  syncText: {
    color: colors.bidGreen,
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.subtitle,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.body,
    textAlign: 'center',
    lineHeight: typography.lineHeight.body,
  },
  emptyButton: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  emptyButtonText: {
    color: colors.bidGreen,
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.semiBold,
  },
});
