import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { useIsFocused } from 'expo-router';
import { SUPPORTED_PAIRS } from '@pulsecrypto/shared';
import { useActivePair, useBook, useTicker } from '../../data/store/hooks';
import { useChannels } from '../../data/useChannels';
import { LastPriceHero } from './LastPriceHero';
import { OrderBookTable } from './OrderBookTable';
import { MarketDepthChart } from './MarketDepthChart';
import { styles } from './TerminalScreen.styles';

export function TerminalScreen() {
  const pair = useActivePair();
  const isFocused = useIsFocused();
  // The order book streams only while this screen is visible, and only for the active pair.
  useChannels(['tickers', `book:${pair}`], isFocused);

  const ticker = useTicker(pair);
  const book = useBook(pair);
  const { baseAsset, quoteAsset, priceDecimals, qtyDecimals } = SUPPORTED_PAIRS[pair];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {ticker ? (
          <LastPriceHero ticker={ticker} priceDecimals={priceDecimals} />
        ) : (
          <Text style={styles.placeholder}>Waiting for market data…</Text>
        )}

        {book ? (
          <>
            <OrderBookTable
              bids={book.bids}
              asks={book.asks}
              baseAsset={baseAsset}
              quoteAsset={quoteAsset}
              priceDecimals={priceDecimals}
              qtyDecimals={qtyDecimals}
            />
            <MarketDepthChart
              bids={book.bids}
              asks={book.asks}
              baseAsset={baseAsset}
              spreadPct={book.spreadPct}
              buyPressure={book.buyPressure}
              sellPressure={book.sellPressure}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
