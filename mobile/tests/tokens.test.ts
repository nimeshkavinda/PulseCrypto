import { formatMarketCap } from '../src/utils/formatters';
import { colors, typography, spacing, borderRadius } from '../src/theme/tokens';

describe('Design System Tokens (Task T3.2)', () => {
  it('should match Mockup 1 canonical brand colors', () => {
    expect(colors.primary).toBe('#0B0E14');
    expect(colors.bidGreen).toBe('#00C57A');
    expect(colors.askRed).toBe('#FF3B69');
    expect(colors.surface).toBe('#1E2633');
    expect(colors.border).toBe('#2A3649');
  });

  it('should define consistent typography scales and weights', () => {
    expect(typography.fontSize.caption).toBeLessThan(typography.fontSize.small);
    expect(typography.fontSize.small).toBeLessThan(typography.fontSize.body);
    expect(typography.fontSize.body).toBeLessThan(typography.fontSize.subtitle);
    expect(typography.fontSize.subtitle).toBeLessThan(typography.fontSize.title);
    expect(typography.fontSize.title).toBeLessThan(typography.fontSize.hero);

    expect(typography.fontWeight.bold).toBe('700');
    expect(typography.fontFamily.mono).toBeDefined();
  });

  it('should follow 4px spacing baseline grid', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(12);
    expect(spacing.lg).toBe(16);
    expect(spacing.xl).toBe(20);
    expect(spacing.xxl).toBe(24);
  });

  it('should have standard border radius including pill', () => {
    expect(borderRadius.xs).toBe(4);
    expect(borderRadius.sm).toBe(6);
    expect(borderRadius.md).toBe(8);
    expect(borderRadius.lg).toBe(12);
    expect(borderRadius.pill).toBe(9999);
  });
});

describe('Financial Formatters', () => {
  it('should format realistic market caps matching Mockup 3', () => {
    expect(formatMarketCap('BTCUSDT', 64238.17)).toBe('1.3T');
    expect(formatMarketCap('BTCUSDT', 86525.22)).toBe('1.7T');
    expect(formatMarketCap('ETHUSDT', 3500)).toBe('421.4B');
    expect(formatMarketCap('SOLUSDT', 150)).toBe('70.2B');
    expect(formatMarketCap('DOGEUSDT', 0.15)).toBe('21.9B');
    expect(formatMarketCap('XRPUSDT', 0.55)).toBe('30.8B');
    expect(formatMarketCap('BTCUSDT', 0)).toBe('0.00');
    expect(formatMarketCap('BTCUSDT', NaN)).toBe('0.00');
  });
});

