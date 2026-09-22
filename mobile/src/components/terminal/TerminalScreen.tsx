import React, { useRef } from 'react';
import { View, ScrollView } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useMarketConnection, useMarketData } from '../../hooks/useMarketStream';
import { SUPPORTED_PAIRS } from '@pulsecrypto/shared';
import { LastPriceHero } from './LastPriceHero';
import { OrderBookTable } from './OrderBookTable';
import { MarketDepthChart } from './MarketDepthChart';
import { styles } from './TerminalScreen.styles';

export function TerminalScreen() {
  const isFocused = useIsFocused();
  const { activePair } = useMarketConnection();
  const { activePayload, priceDirection } = useMarketData();
  const lastRenderedRef = useRef<React.ReactElement | null>(null);

  // When tab is not focused (e.g. user is on Telemetry or Settings), freeze re-renders to save CPU
  if (!isFocused && lastRenderedRef.current) {
    return lastRenderedRef.current;
  }

  if (!activePayload) {
    return <View style={styles.container} />;
  }

  const pairConfig = SUPPORTED_PAIRS[activePair];
  const baseAsset = pairConfig?.baseAsset ?? 'BTC';
  const quoteAsset = pairConfig?.quoteAsset ?? 'USDT';
  const priceDecimals = pairConfig?.priceDecimals ?? 2;
  const qtyDecimals = pairConfig?.qtyDecimals ?? 4;

  const content = (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* T5.1: Hero Section */}
        <LastPriceHero
          payload={activePayload}
          priceDirection={priceDirection}
        />

        {/* T5.2 & T5.3: Live Order Book Table */}
        <OrderBookTable
          bids={activePayload.bids}
          asks={activePayload.asks}
          baseAsset={baseAsset}
          quoteAsset={quoteAsset}
          priceDecimals={priceDecimals}
          qtyDecimals={qtyDecimals}
          spread={activePayload.spread}
          spreadPct={activePayload.spreadPct}
        />

        {/* T5.4: Dual-Mountain SVG Market Depth Chart */}
        <MarketDepthChart
          bids={activePayload.bids}
          asks={activePayload.asks}
          baseAsset={baseAsset}
          spreadPct={activePayload.spreadPct}
          buyPressure={activePayload.buyPressure}
          sellPressure={activePayload.sellPressure}
        />
      </ScrollView>
    </View>
  );

  lastRenderedRef.current = content;
  return content;
}
