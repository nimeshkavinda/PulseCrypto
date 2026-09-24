import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { flashKeyFor, PriceFlash, usePriceDirection } from '../src/components/common/PriceFlash';

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

  it('resets without flashing when the value source changes (REST or cache -> first live tick)', async () => {
    const { rerender } = await render(<Probe k={flashKeyFor('ETH', 'rest')} price={2742} />);
    await rerender(<Probe k={flashKeyFor('ETH', 'live')} price={2800} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('neutral:0');
    await rerender(<Probe k={flashKeyFor('ETH', 'live')} price={2801} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('up:1');
  });

  it('resets without flashing when the pair changes', async () => {
    const { rerender } = await render(<Probe k="BTC" price={100} />);
    await rerender(<Probe k="BTC" price={101} />);
    await rerender(<Probe k="ETH" price={3000} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('neutral:0');
  });
});

describe('PriceFlash', () => {
  it('cancels a running flash when the source changes', async () => {
    const reanimated = jest.requireMock('react-native-reanimated') as {
      withSequence: (...a: unknown[]) => unknown;
      cancelAnimation: (...a: unknown[]) => unknown;
    };
    const flash = jest.spyOn(reanimated, 'withSequence');
    const cancel = jest.spyOn(reanimated, 'cancelAnimation');
    const ui = (source: string, price: number) => (
      <PriceFlash flashKey="BTC" source={source} price={price}>
        <Text>price</Text>
      </PriceFlash>
    );
    const { rerender } = await render(ui('live', 100));
    await rerender(ui('live', 101));
    expect(flash).toHaveBeenCalledTimes(1);
    const cancelsBefore = cancel.mock.calls.length;

    await rerender(ui('cache', 101));
    expect(cancel.mock.calls.length).toBe(cancelsBefore + 1);
    expect(flash).toHaveBeenCalledTimes(1);
    flash.mockRestore();
    cancel.mockRestore();
  });
});
