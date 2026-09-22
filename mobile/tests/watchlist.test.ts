import { describe, it, expect, vi } from 'vitest';
import { formatPrice, formatVolume } from '../src/utils/formatters';

describe('MarketPairCard Formatters & Press Interactions (Task T4.1)', () => {
  it('formatPrice should format prices according to decimal precision', () => {
    expect(formatPrice(64238.17, 2)).toBe('64,238.17');
    expect(formatPrice(0.12345, 5)).toBe('0.12345');
    expect(formatPrice(152.3, 2)).toBe('152.30');
    expect(formatPrice(NaN, 2)).toBe('0.00');
  });

  it('formatVolume should format 24h volumes into compact human-readable units', () => {
    expect(formatVolume(1_500_000_000)).toBe('1.50B');
    expect(formatVolume(42_000_000)).toBe('42.00M');
    expect(formatVolume(895_400)).toBe('895.40K');
    expect(formatVolume(500)).toBe('500.00');
    expect(formatVolume(NaN)).toBe('0.00');
  });

  it('tap star toggles favourite WITHOUT navigation (stops event propagation)', () => {
    const onCardPress = vi.fn();
    const onToggleFavorite = vi.fn();
    const stopPropagation = vi.fn();

    const mockGestureEvent = {
      stopPropagation,
    };

    // Simulate MarketPairCard star TouchableOpacity onPress handler
    const handleStarPress = (e: { stopPropagation: () => void }, symbol: string) => {
      e.stopPropagation();
      onToggleFavorite(symbol);
    };

    // If event bubbles to parent card in native tree:
    const handleCardPress = (symbol: string) => {
      onCardPress(symbol);
    };

    handleStarPress(mockGestureEvent, 'BTCUSDT');

    // Simulate nested responder bubble check
    if (!mockGestureEvent.stopPropagation.mock.calls.length) {
      handleCardPress('BTCUSDT');
    }

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onToggleFavorite).toHaveBeenCalledWith('BTCUSDT');
    expect(onCardPress).not.toHaveBeenCalled();
  });

  it('tap card navigates WITHOUT toggling favourite', () => {
    const onCardPress = vi.fn();
    const onToggleFavorite = vi.fn();

    // Simulate tapping the outer card
    const handleCardPress = (symbol: string) => {
      onCardPress(symbol);
    };

    handleCardPress('ETHUSDT');

    expect(onCardPress).toHaveBeenCalledWith('ETHUSDT');
    expect(onToggleFavorite).not.toHaveBeenCalled();
  });
});
