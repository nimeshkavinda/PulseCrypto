import { formatAge, formatChange, formatPrice, formatTimeOfDay, formatVolume } from '../src/utils/formatters';

describe('formatters', () => {
  it('formats prices with pair precision', () => {
    expect(formatPrice(64238.17, 2)).toBe('64,238.17');
    expect(formatPrice(0.12345, 5)).toBe('0.12345');
    expect(formatPrice(NaN, 2)).toBe('—');
  });

  it('formats volumes compactly', () => {
    expect(formatVolume(1_500_000_000)).toBe('1.50B');
    expect(formatVolume(42_000_000)).toBe('42.00M');
    expect(formatVolume(895_400)).toBe('895.40K');
    expect(formatVolume(500)).toBe('500.00');
  });

  it('formats 24h change with the brief\'s arrows', () => {
    expect(formatChange(1.8234)).toEqual({ arrow: '▲', text: '1.82%', positive: true });
    expect(formatChange(-0.41)).toEqual({ arrow: '▼', text: '0.41%', positive: false });
    expect(formatChange(0).arrow).toBe('▲');
  });

  it('formats time of day and ages', () => {
    expect(formatTimeOfDay(new Date(2026, 0, 1, 9, 5, 7).getTime())).toBe('09:05:07');
    expect(formatAge(4_200)).toBe('4s');
    expect(formatAge(125_000)).toBe('2m');
    expect(formatAge(3 * 3600_000)).toBe('3h');
    expect(formatAge(50 * 3600_000)).toBe('2d');
  });
});
