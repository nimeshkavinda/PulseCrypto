import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { DepthTuple } from '@pulsecrypto/shared';
import { OrderBookRow } from './OrderBookRow';
import { styles } from './OrderBookTable.styles';

interface OrderBookTableProps {
  bids: DepthTuple[];
  asks: DepthTuple[];
  baseAsset: string;
  quoteAsset: string;
  priceDecimals: number;
  qtyDecimals: number;
  spread?: number;
  spreadPct?: number;
}

export const OrderBookTable = React.memo(function OrderBookTable({
  bids,
  asks,
  baseAsset,
  quoteAsset,
  priceDecimals,
  qtyDecimals,
  spread: _spread = 0,
  spreadPct: _spreadPct = 0,
}: OrderBookTableProps) {
  const top10Bids = useMemo(() => bids.slice(0, 10), [bids]);
  const top10Asks = useMemo(() => asks.slice(0, 10), [asks]);

  // Compute max single level order volume across visible book for percentage bar scaling.
  // Directly aligns with Binance dashboard and Mockup 3: major volume walls produce long bars,
  // while small orders render subtle minimal indicators instead of solid full-width cumulative blocks.
  const maxVolume = useMemo(() => {
    let max = 0.001;
    for (const b of top10Bids) {
      if (b[1] > max) max = b[1];
    }
    for (const a of top10Asks) {
      if (a[1] > max) max = a[1];
    }
    return max;
  }, [top10Bids, top10Asks]);

  return (
    <View style={styles.container}>
      {/* Bids Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.headerColPrice}>PRICE ({quoteAsset})</Text>
        <Text style={styles.headerColAmount}>AMOUNT ({baseAsset})</Text>
        <Text style={styles.headerColTotal}>TOTAL</Text>
      </View>

      {/* Top 10 Bids */}
      {top10Bids.map(([price, amount, total], index) => {
        const depthRatio = Math.min(1, Math.max(0.04, amount / maxVolume));
        return (
          <OrderBookRow
            key={`bid-${index}`}
            price={price}
            amount={amount}
            total={total}
            priceDecimals={priceDecimals}
            qtyDecimals={qtyDecimals}
            type="bid"
            depthRatio={depthRatio}
          />
        );
      })}
      {/* Asks Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.headerColPrice}>PRICE ({quoteAsset})</Text>
        <Text style={styles.headerColAmount}>AMOUNT ({baseAsset})</Text>
        <Text style={styles.headerColTotal}>TOTAL</Text>
      </View>

      {/* Top 10 Asks */}
      {top10Asks.map(([price, amount, total], index) => {
        const depthRatio = Math.min(1, Math.max(0.04, amount / maxVolume));
        return (
          <OrderBookRow
            key={`ask-${index}`}
            price={price}
            amount={amount}
            total={total}
            priceDecimals={priceDecimals}
            qtyDecimals={qtyDecimals}
            type="ask"
            depthRatio={depthRatio}
          />
        );
      })}
    </View>
  );
});
