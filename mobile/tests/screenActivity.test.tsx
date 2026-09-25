import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { ScreenActivity } from '../src/data/screenActivity';
import { useTicker } from '../src/data/store/hooks';
import { createTestRuntime } from './runtimeHarness';
import { ticker } from './fixtures';

let renders = 0;
function Probe() {
  renders++;
  const t = useTicker('BTCUSDT');
  return <Text>{t ? `price ${t.price}` : 'none'}</Text>;
}

describe('ScreenActivity', () => {
  beforeEach(() => {
    renders = 0;
  });

  it('pauses market re-renders while the screen is hidden and catches up when shown', async () => {
    const t = createTestRuntime();
    const ui = (active: boolean) => t.wrap(<ScreenActivity value={active}><Probe /></ScreenActivity>);
    await render(ui(true));
    await act(async () => {
      t.runtime.ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', 100)] }]);
      t.flush();
    });
    expect(screen.getByText('price 100')).toBeTruthy();

    await screen.rerender(ui(false));
    const hiddenRenders = renders;
    for (const price of [101, 102, 103]) {
      await act(async () => {
        t.runtime.ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', price)] }]);
        t.flush();
      });
    }
    expect(renders).toBe(hiddenRenders);
    expect(screen.getByText('price 100')).toBeTruthy();

    await screen.rerender(ui(true));
    expect(screen.getByText('price 103')).toBeTruthy();
  });

  it('is active by default outside any screen', async () => {
    const t = createTestRuntime();
    await render(t.wrap(<Probe />));
    await act(async () => {
      t.runtime.ingestor.ingest([{ type: 'tickers', data: [ticker('BTCUSDT', 7)] }]);
      t.flush();
    });
    expect(screen.getByText('price 7')).toBeTruthy();
  });
});
