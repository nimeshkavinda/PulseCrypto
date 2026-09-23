import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PairMetadata } from '@pulsecrypto/shared';
import { MarketPairCard } from '../src/components/watchlist/MarketPairCard';
import { formatPrice, formatVolume } from '../src/utils/formatters';

const item: PairMetadata = {
  symbol: 'BTCUSDT', displayName: 'BTC / USDT', baseAsset: 'BTC', quoteAsset: 'USDT', tradingStatus: 'TRADING',
  priceDecimals: 2, qtyDecimals: 5, high24h: 65000, low24h: 63000, volume24h: 20000, lastPrice: 64238.17, change24h: 1.82,
};

describe('formatters', () => {
  it('formats prices with the pair precision and volumes compactly', () => {
    expect(formatPrice(64238.17, 2)).toBe('64,238.17');
    expect(formatPrice(0.12345, 5)).toBe('0.12345');
    expect(formatVolume(1_500_000_000)).toBe('1.50B');
    expect(formatVolume(895_400)).toBe('895.40K');
  });
});

describe('MarketPairCard', () => {
  it('opens the pair when the row is pressed', async () => {
    const onPress = jest.fn();
    const onToggleFavorite = jest.fn();
    await render(<MarketPairCard item={item} isFavorite={false} onPress={onPress} onToggleFavorite={onToggleFavorite} />);
    await fireEvent.press(screen.getByRole('button', { name: /BTC \/ USDT/ }));
    expect(onPress).toHaveBeenCalledWith('BTCUSDT');
    expect(onToggleFavorite).not.toHaveBeenCalled();
  });

  it('toggles the favourite without opening the pair', async () => {
    const onPress = jest.fn();
    const onToggleFavorite = jest.fn();
    await render(<MarketPairCard item={item} isFavorite onPress={onPress} onToggleFavorite={onToggleFavorite} />);
    const star = screen.getByLabelText('Toggle favourite for BTCUSDT');
    expect(star).toBeChecked();
    await fireEvent.press(star, { stopPropagation: jest.fn() });
    expect(onToggleFavorite).toHaveBeenCalledWith('BTCUSDT');
    expect(onPress).not.toHaveBeenCalled();
  });
});
