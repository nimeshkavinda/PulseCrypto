import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { usePriceDirection } from '../src/components/common/PriceFlash';

function Probe({ k, price }: { k: string; price: number | undefined }) {
  const { direction, seq } = usePriceDirection(k, price);
  return <Text testID="probe">{`${direction}:${seq}`}</Text>;
}

describe('usePriceDirection', () => {
  it('does not flash on first value, flags up/down moves, and re-flashes repeated moves', async () => {
    const { rerender } = await render(<Probe k="BTC" price={undefined} />);
    await rerender(<Probe k="BTC" price={100} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('neutral:0');
    await rerender(<Probe k="BTC" price={101} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('up:1');
    await rerender(<Probe k="BTC" price={102} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('up:2');
    await rerender(<Probe k="BTC" price={99} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('down:3');
  });

  it('resets without flashing when the pair changes', async () => {
    const { rerender } = await render(<Probe k="BTC" price={100} />);
    await rerender(<Probe k="BTC" price={101} />);
    await rerender(<Probe k="ETH" price={3000} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('neutral:0');
  });
});
