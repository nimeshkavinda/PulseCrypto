import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { screen } from '@testing-library/react-native';
import { ScreenErrorBoundary } from '../src/components/common/ScreenErrorBoundary';

jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()), preventAutoHideAsync: jest.fn(() => Promise.resolve()) }));

function Boom(): React.ReactElement {
  throw new Error('boom');
}

describe('screen error boundaries in the router', () => {
  it('replaces only the failing tab screen, so the tab bar stays usable', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await renderRouter(
      {
        '(tabs)/_layout': () => (
          <Tabs>
            <Tabs.Screen name="index" options={{ title: 'Terminal' }} />
            <Tabs.Screen name="markets" options={{ title: 'Markets' }} />
          </Tabs>
        ),
        '(tabs)/index': () => <Text>terminal</Text>,
        // Same export shape as the app's tab routes.
        '(tabs)/markets': { default: Boom, ErrorBoundary: ScreenErrorBoundary },
      },
      { initialUrl: '/markets' }
    );
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    // The tabs layout (and its tab bar) is still rendered around the error view.
    expect(screen.getByText('Terminal')).toBeTruthy();
    expect(screen.getAllByText('Markets').length).toBeGreaterThan(0);
    log.mockRestore();
  });
});
