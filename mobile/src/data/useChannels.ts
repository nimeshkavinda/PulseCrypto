import { useEffect } from 'react';
import { useStreamRuntime } from './StreamProvider';

/**
 * Keeps `channels` subscribed while the calling component is mounted and `enabled` is true.
 * Screens pass `enabled = isFocused` so, e.g., the order book streams only while the terminal is visible.
 */
export function useChannels(channels: string[], enabled = true): void {
  const runtime = useStreamRuntime();
  const key = channels.join('|');
  useEffect(() => {
    if (!enabled || key.length === 0) return;
    return runtime.acquire(key.split('|'));
  }, [runtime, key, enabled]);
}
