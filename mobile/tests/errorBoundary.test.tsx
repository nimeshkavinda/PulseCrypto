import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { ScreenErrorBoundary } from '../src/components/common/ScreenErrorBoundary';

// Only the route modules' exports are under test; stub the screens and the router.
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}) }));
jest.mock('../src/components/terminal/TerminalScreen', () => ({ TerminalScreen: () => null }));
jest.mock('../src/components/watchlist/WatchlistScreen', () => ({ WatchlistScreen: () => null }));
jest.mock('../src/components/telemetry/TelemetryScreen', () => ({ TelemetryScreen: () => null }));
jest.mock('../src/components/settings/SettingsScreen', () => ({ SettingsScreen: () => null }));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()), preventAutoHideAsync: jest.fn(() => Promise.resolve()) }));

describe('ScreenErrorBoundary', () => {
  it('hides the splash screen, logs the error and retries on press', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const retry = jest.fn(() => Promise.resolve());
    const error = new Error('boom');
    await render(<ScreenErrorBoundary error={error} retry={retry} />);
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.any(String), error);
    fireEvent.press(screen.getByText('Try Again'));
    expect(retry).toHaveBeenCalled();
    log.mockRestore();
  });

  // expo-router renders a route's exported ErrorBoundary in place of that route only, so a screen
  // error leaves the tab bar (rendered by the tabs layout) in place.
  it.each(['index', 'markets', 'telemetry', 'settings'])('the %s tab screen exports an ErrorBoundary', (route) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(`../src/app/(drawer)/(tabs)/${route}`);
    expect(mod.ErrorBoundary).toBe(ScreenErrorBoundary);
  });
});
