import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PerfMonitor } from '../modules/perf-monitor';
import { CircularFpsGauge } from '../src/components/telemetry/CircularFpsGauge';
import { MemorySparkline } from '../src/components/telemetry/MemorySparkline';
import { ScreenErrorBoundary } from '../src/components/common/ScreenErrorBoundary';

describe('perf-monitor native module', () => {
  it('is optional: null where it is not compiled in (tests, Expo Go)', () => {
    expect(PerfMonitor).toBeNull();
  });
});

describe('telemetry widgets', () => {
  it('shows the UI-thread rate unclamped when native data exists', async () => {
    await render(<CircularFpsGauge uiFps={120} jsFps={58} nativeAvailable />);
    expect(screen.getByText('120')).toBeTruthy();
    expect(screen.getByText('UI Thread Frame Rate')).toBeTruthy();
    expect(screen.getByText('JS thread 58 fps')).toBeTruthy();
  });

  it('falls back to the JS-thread rate and says why when the native module is missing', async () => {
    await render(<CircularFpsGauge uiFps={null} jsFps={57} nativeAvailable={false} />);
    expect(screen.getByText('57')).toBeTruthy();
    expect(screen.getByText(/unavailable in Expo Go/)).toBeTruthy();
  });

  it('never simulates memory: states unavailability instead', async () => {
    await render(<MemorySparkline samplesMb={[]} nativeAvailable={false} />);
    expect(screen.getByText(/Unavailable in Expo Go/)).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText(/SIMULATED/)).toBeNull();
  });

  it('shows the latest real memory sample', async () => {
    await render(<MemorySparkline samplesMb={[141.2, 142.8]} nativeAvailable />);
    expect(screen.getByText('142.8 MB')).toBeTruthy();
  });

  it('warns in development builds that the footprint includes debug-only retention', async () => {
    await render(<MemorySparkline samplesMb={[141.2]} nativeAvailable />);
    expect(screen.getByText(/Judge memory on a release build/)).toBeTruthy();
  });
});

describe('ScreenErrorBoundary', () => {
  it('renders a recoverable error state with retry', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined); // the boundary logs the error
    const retry = jest.fn(async () => undefined);
    await render(<ScreenErrorBoundary error={new Error('boom')} retry={retry} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy(); // dev builds show the message
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
    log.mockRestore();
  });
});

