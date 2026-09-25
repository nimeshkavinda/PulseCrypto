---
title: 'Phase 12: Live watchlist and terminal improvements'
type: 'feature'
created: '2026-09-23'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '315c158a6c99eef75259d7ec68ff678347c77316'
context:
  - '{project-root}/docs/protocol.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
- Watchlist rows show REST metadata that refreshes only on pull-to-refresh. They never flash on price changes, and "LIVE" reflects only the socket, not the freshness of the row's data.
- The terminal hides numeric buy/sell pressure and the absolute spread, and has no staleness signal.
- Depth bars animate `width`, which triggers layout on every frame.
- The depth chart's x-axis is level rank rather than price.
- The hero shows a market cap computed from hardcoded supply figures.
- Cold start, reconnecting and offline states have no dedicated UI.

**Approach:**
- Bind every watchlist row to the live `tickers` channel through per-pair selectors. REST supplies only reference data.
- Flash price changes on the UI thread with Reanimated.
- Derive one freshness state per pair from the socket, upstream status, data age and origin.
- Show it consistently in rows, the terminal header and an offline/cached banner.
- Terminal gets a numeric pressure bar, spread and %, and "updated" time; `scaleX` bars; a price/cumulative-quantity depth chart; and 24h volume instead of market cap.

## Boundaries & Constraints

**Always:**
- Each row re-renders only when its own ticker, favourite flag or freshness changes.
- Flash colours: green `#00C57A` for up, red `#FF3B69` for down, fading within ~600 ms. There is no flash on first render or on a pair switch.
- Freshness per pair:
  - `live`: socket open, upstream live, pair not stale, `updatedAt` < 5 s old, origin live.
  - `delayed`: socket open but the pair is stale, or the data is older than 5 s.
  - `cached`: origin is cache.
  - `offline`: the socket isn't open.
- The watchlist works without REST: rows come from `SUPPORTED_PAIRS` plus live tickers; metadata adds status and decimals when available.
- All price and quantity formatting uses the pair's decimals (metadata when loaded, otherwise the shared defaults).
- Screen reader labels carry price, change and freshness.

**Never:**
- No estimated market values.
- No change to the backend or the protocol.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Live tick up | BTC ticker 100 → 101 | the BTC row flashes green and shows 101; other rows don't re-render |
| Tick down | 101 → 99 | red flash |
| First data / pair switch | first ticker for a row; terminal pair change | no flash |
| No REST, live tickers | `/pairs/meta` fails | 5 rows rendered from `SUPPORTED_PAIRS` + tickers |
| No data at all | cold start, no cache, not connected | skeleton rows; the terminal shows skeletons |
| Cached | snapshot loaded, socket not yet open | values shown with a `CACHED` badge and banner "Showing prices from HH:MM" |
| Stale pair | `status.stalePairs` includes ETH | the ETH row shows `DELAYED`; the others stay `LIVE` |
| Offline | socket `offline`/`backoff` | banner "Offline, reconnecting…" (with the retry countdown when in backoff); rows `OFFLINE`; last values kept |
| Terminal metrics | book with buy 58.2 / sell 41.8, spread 0.01 | "58.2% / 41.8%" bar, spread "0.01 (0.0000%)", updated time |
| Depth chart | bids/asks | x = price (min bid → max ask), y = cumulative base quantity, bids stepping down to the left |
| Pull to refresh | pull on the watchlist | metadata refetched; the WS stream is not reconnected |
| 24h change format | change +1.82 / −0.41 | rendered as `▲ 1.82%` (green) / `▼ 0.41%` (red), as in the brief's watchlist example |
| Last updated | ticker and book with different `updatedAt` | the terminal shows the latest of the two as a time of day, plus the age when older than 5 s |

</frozen-after-approval>

## Code Map

- **New** `mobile/src/data/freshness.ts`: `pairFreshness(...)` (pure) + `usePairFreshness(pair)`, which re-evaluates each second only while data is live.
- **New** `mobile/src/components/common/{PriceFlash,FreshnessBadge,MarketStatusBanner,Skeleton}.tsx`.
- `mobile/src/components/watchlist/{WatchlistScreen,MarketPairCard}.tsx`:
  - Rows take `symbol` and read `useTicker`.
  - Memoised; rows built from `SUPPORTED_PAIRS` merged with metadata.
  - `useChannels(['tickers'], isFocused)`.
  - `filterAndSortPairs` operates on the merged row model.
- `mobile/src/components/terminal/{LastPriceHero,OrderBookTable,OrderBookRow,MarketDepthChart}.tsx`:
  - The hero gains the freshness badge, updated time and 24h volume.
  - A new `PressureSpreadBar`.
  - `OrderBookRow` animates `transform: [{ scaleX }]` with a fixed origin.
  - Depth-chart geometry moves to a pure `utils/depthChart.ts`.
- `mobile/src/utils/formatters.ts`: remove `formatMarketCap`; add `formatTimeOfDay` and `formatAge`.
- Tests: freshness matrix, depth geometry, flash direction logic, row re-render isolation, the terminal metrics render, and the watchlist without REST.

## Tasks & Acceptance

**Execution:**
- [x] Freshness module + hook
- [x] Common components (flash, badge, banner, skeleton)
- [x] Watchlist on live tickers with memoised rows
- [x] Terminal: hero, pressure/spread bar, `scaleX` bars, price-based depth chart, volume
- [x] Remove market cap
- [x] Tests for every matrix row

**Acceptance Criteria:**
- Given the app on the Android emulator against the live gateway, watchlist prices tick with green/red flashes. Killing the gateway shows the offline banner while prices stay. Restarting it recovers automatically without user action.
- Given `npm test && npm run typecheck && npm run lint`, then all pass.

## Verification

**Commands:**
- `npm test && npm run typecheck && npm run lint` -- expected: all green
- Android emulator run against `node backend/dist/server.js` -- expected: the acceptance criteria above, captured in screenshots

## Implementation Notes

- **Flash:** `PriceFlash` animates only the opacity of a single-colour overlay; the colour is chosen by React from the move direction. Interpolating one background between green and red would visibly pass through the other colour on a direction change. Direction is derived state (`usePriceDirection`): no flash on the first value or on a pair switch, and consecutive moves the same way re-flash (sequence counter).
- **Watchlist:**
  - The list subscribes to an ordering key: a string of symbols from `applyTab` over live changes. It re-renders only when membership or order changes (e.g. Gainers/Losers), while rows re-render on their own ticker.
  - `useFavorites` now returns a memoised array, so `renderItem` is stable.
  - A `Profiler` test shows 10 BTC ticks cause 0 ETH-row renders.
- **Freshness:** only pairs listed in `stalePairs` are `DELAYED`. An exchange-feed outage (`down`/`connecting`) delays every pair. A row stays `LIVE` without per-second ticking: one timer fires when its data would pass the 5 s threshold.
- **Banner:** the time shown is that of the newest price on screen (live or cached), computed only while disconnected, so the banner doesn't re-render per tick while live. There is a 1 s countdown tick only in `backoff`.
- **Order book:** bars use `transform: scaleX` with `transformOrigin: 'right'`, animated on the UI thread with no layout.
- **Depth chart:** geometry is a pure function (`utils/depthChart.ts`). Step paths, price on x (deepest bid → deepest ask), cumulative quantity on y, min/mid/max price labels.
- **Removed:** market cap (it came from hardcoded supply figures), replaced by 24h volume in the base asset. The unused spline utility is deleted.
- **Tests:** Reanimated 4 and Worklets use their shipped Jest mocks.
- **Verified on the iOS 27 simulator against the gateway in Docker:**
  - Terminal: pressure 52.1/47.9, spread 0.01 USDT, "Updated HH:MM:SS", 24H VOL.
  - Watchlist: every row LIVE, ▲/▼ format, favourites persisted.
  - Gateway stopped → banner "Connection lost. Reconnecting in 6s" with every row OFFLINE and prices kept. Gateway started → back to LIVE on its own; one capture shows a live red flash on XRP.

## Spec Change Log

## Review Triage Log

Review pass 1, 2026-09-23: blind, edge-case and verification-gap lenses.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | Freshness marked every pair delayed whenever upstream was `stale`, contradicting the matrix row "Stale pair" | high | patch | Caught while writing the freshness test. Now scoped to `stalePairs`, with a test for another pair staying live. |
| 2 | The banner used `cachedAt` (the previous session's snapshot time) as "showing prices from" after a live session dropped | medium | patch | It now uses the newest on-screen price time (`latestDataAt`), with a unit test. |
| 3 | `useFavorites` returned a new array each render, which invalidated `renderItem` and re-rendered every row | medium | patch | Memoised on the serialized value. |
| 4 | `PressureSpreadBar` uses flex sizes (a layout pass per book update, ≤10 Hz) rather than transforms | low | reject | A single view at the book cadence has no measurable cost next to the order book. The per-row bars, where it matters, use transforms. |
| 5 | Two banners are mounted at once (watchlist and terminal tabs both stay mounted) | low | reject | Each is visible only on its own tab and selects the same store slices, so the cost is negligible. |
