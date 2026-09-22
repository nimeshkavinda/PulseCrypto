import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { TerminalScreen } from '../../../components/terminal/TerminalScreen';
import { useMarketStream } from '../../../hooks/useMarketStream';
import { SupportedPairSymbol, SupportedPairSymbolSchema } from '@pulsecrypto/shared';

export default function TerminalRoute() {
  const { symbol } = useLocalSearchParams<{ symbol?: string }>();
  const { setActivePair } = useMarketStream();

  useEffect(() => {
    if (symbol) {
      const parsed = SupportedPairSymbolSchema.safeParse(symbol);
      if (parsed.success) {
        setActivePair(parsed.data as SupportedPairSymbol);
      }
    }
  }, [symbol, setActivePair]);

  return <TerminalScreen />;
}
