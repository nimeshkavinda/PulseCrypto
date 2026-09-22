import React from 'react';
import { View, Text } from 'react-native';
import { DepthTuple } from '@pulsecrypto/shared';
import { OrderBookRow } from './OrderBookRow';
import { formatPrice } from '../../utils/formatters';
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

export function OrderBookTable({
  bids,
  asks,
  baseAsset,
  quoteAsset,
  priceDecimals,
  qtyDecimals,
  spread = 0,
  spreadPct = 0,
}: OrderBookTableProps) {
  const top10Bids = bids.slice(0, 10);
  const top10Asks = asks.slice(0, 10);

  // Compute max cumulative volume across top 10 for percentage bar scaling
  const maxBidTotal = top10Bids[top10Bids.length - 1]?.[2] ?? 1;
  const maxAskTotal = top10Asks[top10Asks.length - 1]?.[2] ?? 1;
  const maxCumulative = Math.max(maxBidTotal, maxAskTotal, 1);

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
        const depthRatio = total / maxCumulative;
        return (
          <OrderBookRow
            key={`bid-${price}-${index}`}
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

      {/* Spread Divider */}
      <View style={styles.spreadDivider}>
        <Text style={styles.spreadLabel}>SPREAD</Text>
        <Text style={styles.spreadValue}>
          {formatPrice(spread, priceDecimals)} ({spreadPct.toFixed(3)}%)
        </Text>
      </View>

      {/* Asks Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.headerColPrice}>PRICE ({quoteAsset})</Text>
        <Text style={styles.headerColAmount}>AMOUNT ({baseAsset})</Text>
        <Text style={styles.headerColTotal}>TOTAL</Text>
      </View>

      {/* Top 10 Asks */}
      {top10Asks.map(([price, amount, total], index) => {
        const depthRatio = total / maxCumulative;
        return (
          <OrderBookRow
            key={`ask-${price}-${index}`}
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
}
