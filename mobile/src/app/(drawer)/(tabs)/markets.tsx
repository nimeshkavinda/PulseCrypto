import { WatchlistScreen } from '../../../components/watchlist/WatchlistScreen';

// A render error in this screen is caught here, so the tab bar and header stay usable.
export { ScreenErrorBoundary as ErrorBoundary } from '../../../components/common/ScreenErrorBoundary';

export default function MarketsRoute() {
  return <WatchlistScreen />;
}
