import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { PairMetadata } from '@pulsecrypto/shared';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';
import { usePairsMetadata } from '../hooks/usePairsMetadata';
import { MarketPairCard } from './watchlist/MarketPairCard';
import { defaultStorage } from '../storage/storageRepository';
import type { BottomTabParamList } from '../navigation/types';

export function MarketsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<BottomTabParamList, 'Markets'>>();
  const { data: pairs, isRefetching, refetch, isLoading } = usePairsMetadata();
  const [favorites, setFavorites] = useState<string[]>(() => defaultStorage.getFavorites());

  // Synchronize favorites from storage on mount
  useEffect(() => {
    setFavorites(defaultStorage.getFavorites());
  }, []);

  const handleToggleFavorite = useCallback((symbol: string) => {
    defaultStorage.toggleFavorite(symbol);
    setFavorites(defaultStorage.getFavorites());
  }, []);

  const handleSelectPair = useCallback(
    (symbol: string) => {
      defaultStorage.setActivePair(symbol);
      navigation.navigate('Terminal', { symbol });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: PairMetadata }) => (
      <MarketPairCard
        item={item}
        isFavorite={favorites.includes(item.symbol)}
        onToggleFavorite={handleToggleFavorite}
        onPress={handleSelectPair}
      />
    ),
    [favorites, handleToggleFavorite, handleSelectPair]
  );

  const keyExtractor = useCallback((item: PairMetadata) => item.symbol, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Markets Watchlist</Text>
          <Text style={styles.headerSubtitle}>
            {pairs.length} supported pairs streaming live
          </Text>
        </View>

        {isRefetching && (
          <View style={styles.syncBadge}>
            <ActivityIndicator size="small" color={colors.bidGreen} />
            <Text style={styles.syncText}>SYNCING</Text>
          </View>
        )}
      </View>

      {/* Main Pair List */}
      <FlatList
        data={pairs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.bidGreen}
            colors={[colors.bidGreen]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.bidGreen} />
              <Text style={styles.emptyText}>Loading markets...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No trading pairs available</Text>
            </View>
          )
        }
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
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.body,
    marginTop: spacing.md,
  },
});
