import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { Slot } from 'expo-router';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

import { StreamProvider } from '../data/StreamProvider';
import { PerfOverlay } from '../components/common/PerfOverlay';
export { ScreenErrorBoundary as ErrorBoundary } from '../components/common/ScreenErrorBoundary';

// Development tooling only: constant-folded out of release bundles.
if (__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../devtools/reactotron');
  // Testing offline with airplane mode also cuts a dev build off from Metro, and Expo's hot-reload
  // client then warns that it cannot reach the dev server. That is expected while testing the app's
  // offline handling, so keep it out of the on-screen LogBox (it still prints to the console).
  LogBox.ignoreLogs(['Cannot connect to Expo CLI']);
}

// Keep the splash screen visible while fonts load
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            staleTime: 5000,
          },
        },
      })
  );

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StreamProvider>
            <StatusBar style="light" />
            <Slot />
            <PerfOverlay />
          </StreamProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
