---
title: 'Fixes from review and testing: gateway robustness, stream client resilience, Settings and terminal'
type: 'bugfix'
created: '2026-09-24'
status: 'done'
route: 'dispatch'
baseline_commit: '3b1d42ca81b3005b26c848c7978a8f433a37384d'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Code review and device testing found medium-severity and user-visible defects. In testing, the Settings storage card did not reflect changes made elsewhere, and its buttons were misaligned.

**Approach:** Fix the medium and user-visible set in one change, as two commits (gateway + CI, then mobile), each with tests for the medium items. Low-impact items are tracked separately.

## Boundaries & Constraints

**Always:**
- No protocol changes.
- Keep the existing comment density.
- Tests use jest-expo + RNTL (async render) on mobile and vitest on the backend.

**Never:**
- `ALLOWED_ORIGINS` keeps its `*` default (public, unauthenticated market data; native apps send no Origin).
- No compression toggle.
- No new native dependencies.

**Decisions:**
- **Spread %:** 2 significant figures (e.g. `0.000012%`) in both the pressure bar and the depth badge. The accessibility label formats the spread amount with the pair's decimals.
- **Settings storage card:** lists favourites (count and symbols), active pair, cadence, and cached prices (exact UTF-8 byte size of the stored JSON). It refreshes on any storage change, with snapshot writes throttled to 1 s.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Upstream frame `null` | JSON literal null | counted invalid; no throw |
| Upstream accepts then closes repeatedly | open → close with no messages | backoff keeps growing |
| Readiness | 4 upstream states × metadata loaded or not | 503 for connecting/down/no metadata; 200 for live/stale |
| Two clients, one with pending status | shared-frame tick | each frame carries its own pending status |
| Last client leaves while lagging | 0 sessions | laggingClients gauge 0 |
| Toggle favourite | Settings open | favourites row updates |
| Clear Cached Prices | cache-origin entries shown | removed from memory and storage; live entries kept |
| Reset Preferences on SOL | terminal shows SOL | terminal switches to BTC now |
| First live tick after REST/cache value | price differs | no flash |
| DOGE terminal | metadata priceDecimals 5 | terminal uses 5 |
| Device clock 10 s ahead | healthy stream | rows LIVE |
| Backoff after live data | nextRetryAt set | "Reconnecting in Ns · showing prices from HH:MM:SS" |
| Offline, no data | nothing received | no "showing prices" claim |
| REST values, socket not open | no ticker | row OFFLINE |
| Gateway warming up | open, upstream connecting | CONNECTING, not NO FEED |
| Socket stuck connecting | no open for 10 s | closed → backoff |
| Gateway accept-then-close loop | open, close, no frames | backoff grows |
| /pairs/meta 503, no Retry-After | warm-up | retryAfterS null; keeps retrying |
| Snapshot save | cache + live entries | only live persisted |
| Pair switch on the terminal | BTC → ETH | only book channels change |
| Tab screen throws | render error | tab bar stays |
| Slider drag cancelled | scroll takes over | no cadence commit |

</frozen-after-approval>

## Code Map

**Backend**
- `src/binance.ts`: null/non-object envelope guard; handler dispatch wrapped (`invalid{reason="handler"}`); `handshakeTimeout`; backoff reset moved from `open` to the first valid stream message.
- `src/http/health.routes.ts`: `upstreamReadiness(metadata, statusFn)`, used by `server.ts`.
- `src/hub/ChannelHub.ts`: laggingClients gauge set to 0 with no sessions.
- `src/config.ts` (`FLUSH_INTERVAL_MS` ≤ 10 000), `src/orderbook.ts` (`spreadPct` to 8 decimals), `src/app.ts` (default hub gets `heartbeatMs`).
- `scripts/loadtest/`: healthy closes count only opened sockets; the run fails fast if the gateway or a worker exits.
- `.github/workflows/ci.yml`: `permissions: contents: read`; the load-test gate requires finite numbers and ≥ 95% of the non-slow clients (`expectedHealthy`) connected.

**Mobile**
- `data/stream/MarketStreamClient.ts`: 10 s connect timeout; attempts reset on the first market data message (`tickers`/`book`); ticker elements validated; dropped messages counted.
- `data/StreamRuntime.ts`: `clearCachedPrices()`, `resetPreferences()`, channel sync coalesced in a microtask, commit before the final save.
- `data/store/persistence.ts` (live entries only), `data/store/ingestor.ts` (`receivedAt`), `data/freshness.ts` (`receivedAt ?? updatedAt`; REST rows).
- `components/settings/SettingsScreen.tsx`, `hooks/useSettings.ts`, `storage/storageRepository.ts`: the storage card, exact sizes, throttled refresh, aligned buttons, the slider gesture and a11y actions.
- `components/common/PriceFlash.tsx`: value source in the flash key; a reset cancels a running flash.
- `components/terminal/*`: `/pairs/meta` decimals, ticker-only hero badge, `formatPercentSig`.
- `components/common/MarketStatusBanner.tsx`, `data/connectionStatus.ts`: offline/backoff texts; upstream `connecting` → CONNECTING.
- `api/marketApi.ts`, `hooks/usePairsMetadata.ts`: missing Retry-After → null; warm-up retried indefinitely (capped at 10 s).
- `app/(drawer)/(tabs)/*.tsx`: export `ErrorBoundary`; `ScreenErrorBoundary` hides the splash and logs.
- `components/telemetry/usePerfSamples.ts`, `modules/perf-monitor/android/…/PerfMonitorModule.kt`: per-visit reset, guarded native calls, no start-frame count.

## Tasks & Acceptance

**Execution:**
- [x] Backend fixes + tests + CI (commit 1)
- [x] Mobile stream/data fixes + tests
- [x] Mobile UI fixes (Settings, terminal, banner, flash, boundaries) + tests (commit 2)
- [x] Device check: iOS and Android dev builds (Settings card, spread, reset, clear)

**Acceptance Criteria:**
- Given the matrix rows, their tests pass, and `npm run typecheck && npm run lint && npm test` pass.
- Given the Settings screen, when a favourite is toggled on the Markets tab, then the storage card shows the new favourites on return.

## Implementation Notes

- Backoff resets only on proof of real data: on the gateway, the first upstream message that passes envelope and symbol validation; in the app, the first `tickers` or `book` message. `hello` and `status` arrive on every connect, so they don't count, and neither do invalid frames. A gateway that accepts, greets and closes keeps backing off.
- The slider also takes a tap on the track (`Gesture.Exclusive(pan, tap)`: the drag wins, and the tap fires only when no drag started).
- The slider activates only after 8 px of horizontal movement, and the preview starts on activation rather than on touch-down, so a vertical drag that starts on the track scrolls the page.
- Clearing the snapshot refreshes the storage card at once. The next periodic save then writes the live entries again, as the matrix requires ("live entries kept").
- The banner's accessibility label leaves out the per-second countdown.

## Verification

- `npm run typecheck && npm run lint && npm test`: all green.
- `npm --prefix backend run loadtest -- --clients 500 --duration 10 --workers 2`: 490 healthy of 500, 9.9 frames/s.
- iOS simulator (dev build) and Android emulator (dev build, perf-monitor rebuilt): Settings card and button layout, favourites follow a Markets toggle, Clear Cached Prices, Reset Preferences from SOL → BTC, spread `0.000012%`, and 59 UI FPS on a 60 Hz display.
