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

  // Compute cumulative base asset volume for bids and asks, scaled against the max cumulative volume.
  // Perfectly matches Binance's actual web dashboard: bars represent cumulative depth accumulating outward from mid-market.
  const { bidRatios, askRatios } = useMemo(() => {
    let cumBid = 0;
    const bidCums: number[] = [];
    for (const b of top10Bids) {
      cumBid += b[1];
      bidCums.push(cumBid);
    }

    let cumAsk = 0;
    const askCums: number[] = [];
    for (const a of top10Asks) {
      cumAsk += a[1];
      askCums.push(cumAsk);
    }

    const maxCum = Math.max(cumBid, cumAsk, 0.001);

    const bRatios = bidCums.map((c) => Math.min(1, Math.max(0.04, (c / maxCum) * 0.9)));
    const aRatios = askCums.map((c) => Math.min(1, Math.max(0.04, (c / maxCum) * 0.9)));

    return { bidRatios: bRatios, askRatios: aRatios };
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
        const depthRatio = bidRatios[index] ?? 0.04;
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
        const depthRatio = askRatios[index] ?? 0.04;
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
