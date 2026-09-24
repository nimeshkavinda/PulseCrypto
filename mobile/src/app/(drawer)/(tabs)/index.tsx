import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SupportedPairSymbolSchema } from '@pulsecrypto/shared';
import { TerminalScreen } from '../../../components/terminal/TerminalScreen';
import { useStreamRuntime } from '../../../data/StreamProvider';

// A render error in this screen is caught here, so the tab bar and header stay usable.
export { ScreenErrorBoundary as ErrorBoundary } from '../../../components/common/ScreenErrorBoundary';

export default function TerminalRoute() {
  const { symbol } = useLocalSearchParams<{ symbol?: string }>();
  const runtime = useStreamRuntime();

  useEffect(() => {
    const parsed = SupportedPairSymbolSchema.safeParse(symbol);
    if (parsed.success) runtime.setActivePair(parsed.data);
  }, [symbol, runtime]);

  return <TerminalScreen />;
}
