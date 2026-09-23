import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SocketLike, StreamClientDeps } from './MarketStreamClient';
import { NetworkCost } from '../adaptiveCadence';

/** React Native implementations of the stream client's platform dependencies. */
export const nativeStreamDeps: StreamClientDeps = {
  createSocket: (url) => new WebSocket(url) as unknown as SocketLike,

  subscribeNetwork(onChange) {
    // `isConnected` (link-level) rather than `isInternetReachable`, which stays null or false for
    // a local gateway on a network without internet access. `null` means "unknown": treat as online.
    return NetInfo.addEventListener((state) => onChange(state.isConnected !== false));
  },

  subscribeAppState(onChange) {
    onChange(AppState.currentState !== 'background');
    const sub = AppState.addEventListener('change', (next) => {
      // 'inactive' (iOS transient, e.g. control centre) keeps the stream; only 'background' pauses it.
      if (next === 'active') onChange(true);
      else if (next === 'background') onChange(false);
    });
    return () => sub.remove();
  },

  scheduler: {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  },
};

/** Connection cost (type and metered flag) for adaptive cadence. */
export function subscribeNetworkCost(onChange: (cost: NetworkCost) => void): () => void {
  return NetInfo.addEventListener((state) => {
    const details = state.details as { isConnectionExpensive?: boolean } | null;
    onChange({ expensive: details?.isConnectionExpensive ?? false, type: state.type });
  });
}
