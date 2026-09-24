import React from 'react';
import { View, ScrollView } from 'react-native';
import { useIsFocused } from 'expo-router';
import { SUPPORTED_PAIRS } from '@pulsecrypto/shared';
import { useActivePair, useBook, useTicker } from '../../data/store/hooks';
import { usePairsMetadata } from '../../hooks/usePairsMetadata';
import { useChannels } from '../../data/useChannels';
import { MarketStatusBanner } from '../common/MarketStatusBanner';
import { Skeleton } from '../common/Skeleton';
import { LastPriceHero } from './LastPriceHero';
import { PressureSpreadBar } from './PressureSpreadBar';
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
  // Exchange filters from /pairs/meta decide the decimals (e.g. DOGE/XRP); the static table is
  // only the fallback until metadata has loaded.
  const meta = usePairsMetadata().data?.find((p) => p.symbol === pair);
  const { baseAsset, quoteAsset } = SUPPORTED_PAIRS[pair];
  const priceDecimals = meta?.priceDecimals ?? SUPPORTED_PAIRS[pair].priceDecimals;
  const qtyDecimals = meta?.qtyDecimals ?? SUPPORTED_PAIRS[pair].qtyDecimals;

  return (
    <View style={styles.container}>
      <MarketStatusBanner />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {ticker ? (
          <LastPriceHero
            pair={pair}
            ticker={ticker}
            bookUpdatedAt={book?.updatedAt}
            bookReceivedAt={book?.receivedAt}
            priceDecimals={priceDecimals}
            baseAsset={baseAsset}
          />
        ) : (
          <View style={styles.skeletonHero}>
            <Skeleton width={90} height={12} />
            <Skeleton width={220} height={36} style={styles.skeletonGap} />
            <Skeleton width="100%" height={28} style={styles.skeletonGap} />
          </View>
        )}

        {book ? (
          <>
            <PressureSpreadBar
              buyPressure={book.buyPressure}
              sellPressure={book.sellPressure}
              spread={book.spread}
              spreadPct={book.spreadPct}
              priceDecimals={priceDecimals}
              quoteAsset={quoteAsset}
            />
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
              priceDecimals={priceDecimals}
              spreadPct={book.spreadPct}
              buyPressure={book.buyPressure}
              sellPressure={book.sellPressure}
            />
          </>
        ) : (
          <View style={styles.skeletonHero}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} width="100%" height={16} style={styles.skeletonGap} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
