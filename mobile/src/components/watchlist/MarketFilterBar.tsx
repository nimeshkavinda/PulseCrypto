import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import { MarketFilterTab, FILTER_TABS } from './filterUtils';
import { styles } from './MarketFilterBar.styles';

export interface MarketFilterBarProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  activeTab: MarketFilterTab;
  onTabChange: (tab: MarketFilterTab) => void;
  favoritesCount: number;
}

export function MarketFilterBar({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  favoritesCount,
}: MarketFilterBarProps) {
  return (
    <View style={styles.container}>
      {/* Search Input Box */}
      <View style={styles.searchBar}>
        <Ionicons
          name="search-outline"
          size={18}
          color={colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          placeholder="Search coin or symbol (e.g. BTC, Solana)..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={onSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search trading pairs"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => onSearchChange('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs / Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === 'FAVORITES' && favoritesCount > 0;

          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.7}
              onPress={() => onTabChange(tab.id)}
              style={[
                styles.chip,
                isActive ? styles.chipActive : styles.chipInactive,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} filter tab`}
            >
              <Text
                style={[
                  styles.chipText,
                  isActive ? styles.chipTextActive : styles.chipTextInactive,
                ]}
              >
                {tab.label}
              </Text>
              {showBadge && (
                <View
                  style={[
                    styles.chipBadge,
                    isActive ? styles.chipBadgeActive : styles.chipBadgeInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipBadgeText,
                      isActive
                        ? styles.chipBadgeTextActive
                        : styles.chipBadgeTextInactive,
                    ]}
                  >
                    {favoritesCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
