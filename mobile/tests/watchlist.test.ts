import { describe, it, expect } from 'vitest';
import { formatPrice, formatVolume } from '../src/utils/formatters';

describe('MarketPairCard Formatters (Task T4.1)', () => {
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
});
