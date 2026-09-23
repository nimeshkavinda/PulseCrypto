import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SupportedPairSymbolSchema } from '@pulsecrypto/shared';
import { TerminalScreen } from '../../../components/terminal/TerminalScreen';
import { useStreamRuntime } from '../../../data/StreamProvider';

export default function TerminalRoute() {
  const { symbol } = useLocalSearchParams<{ symbol?: string }>();
  const runtime = useStreamRuntime();

  useEffect(() => {
    const parsed = SupportedPairSymbolSchema.safeParse(symbol);
    if (parsed.success) runtime.setActivePair(parsed.data);
  }, [symbol, runtime]);

  return <TerminalScreen />;
}
