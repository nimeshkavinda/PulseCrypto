---
title: 'Phase 11: Mobile connection reliability and render performance'
type: 'refactor'
created: '2026-09-23'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9c0394157898aae72b54aa608746949fb6aef5f1'
context:
  - '{project-root}/docs/protocol.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
- `MarketStreamContext` is a 600-line React component. It owns the socket, reconnection, conflation, telemetry and persistence, and has no unit tests.
- Every flush replaces the whole payload map, so every data consumer re-renders, and the 1 s telemetry counters re-render every tab.
- Reconnection ignores network state (it waits out backoff after connectivity returns), and backgrounding reports the wrong status.
- It speaks the pre-v1 protocol, so it no longer works with the gateway.
- `react-native-mmkv` v4 exports `MMKV` only as a type, so the storage layer silently falls back to memory and **favourites never survive a restart**.
- `EXPO_PUBLIC_GATEWAY_URL` is ignored because a default is written into storage on first run.

**Approach:**
- Replace the context with three pieces:
  - A framework-agnostic `MarketStreamClient`: an explicit connection state machine with injected socket, network, app-state and clock dependencies.
  - A Zustand store with per-pair structural sharing and at most one commit per animation frame.
  - A thin provider with focus-aware, ref-counted channel subscriptions.
- Fix MMKV and the gateway config precedence.
- Port the existing screens onto the new hooks so the app works end to end on protocol v1.
- Move mobile tests to jest-expo + React Native Testing Library.

## Boundaries & Constraints

**Always:**
- Updating one pair's ticker must not re-render components that select another pair.
- The book channel is subscribed only while the terminal is focused, and only for the active pair.
- Reconnect immediately when connectivity or foreground returns, and don't spend backoff attempts while offline.
- Backoff is full-jitter exponential (1 s → 30 s cap).
- An app-level ping every 5 s measures RTT; no inbound message for 12 s closes the socket and reconnects.
- Resubscribe to the desired channels and re-send the cadence after every reconnect.
- The store is hydrated from the MMKV cache marked `origin: 'cache'`. No synthetic prices anywhere.
- Gateway URL precedence: dev-only user override → `EXPO_PUBLIC_GATEWAY_URL` → `expo.extra.gatewayUrl` → platform default.

**Never:**
- No visual redesign. Phase 12 owns the live watchlist rows, the terminal layout and the skeleton/offline UX; this phase only rewires the data.
- No new backend changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Start online | `start()` | `connecting` → `open`; desired channels subscribed; cadence sent if set |
| Start offline | NetInfo offline | `offline`; no socket, no attempts spent |
| Drop | socket closes unexpectedly | `backoff` with delay ≤ cap; attempt count increments; reconnects |
| Network returns | `offline`/`backoff`, then NetInfo online | connect immediately; attempts reset |
| Background | AppState → background | socket closed (1000), `paused`, no reconnect timers |
| Foreground | AppState → active | connect immediately |
| Silent stall | no inbound message for 12 s | socket closed, `backoff` |
| Slow-consumer close | close code 1013 | `backoff` (normal path) |
| Channel diff | desired `{tickers}` → `{tickers, book:ETH}` while open | only `subscribe book:ETH` sent |
| Reconnect | after reopen | a single `subscribe` with the full desired set |
| Frame | `tickers` for BTC only | BTC ticker object replaced; ETH object identity unchanged |
| Burst | 5 frames within one animation frame | one store commit |
| Garbage | non-JSON / wrong `v` / unknown `type` | ignored and counted; no throw |
| Cold start with cache | MMKV snapshot exists | tickers/books hydrated with `origin: 'cache'` and `cachedAt` |
| Favourites | toggle, then new repository instance on the same backend | persisted (MMKV via `createMMKV`) |
| Env URL | `EXPO_PUBLIC_GATEWAY_URL` set, no override | env URL used |

</frozen-after-approval>

## Code Map

- **New** `mobile/src/config/gateway.ts`: URL resolution. It reuses `resolveWsBaseUrl`/`resolveHttpBaseUrl` from `mobile/src/api/urlUtils.ts`.
- **New** `mobile/src/data/stream/MarketStreamClient.ts`: the state machine, heartbeat, subscription diffing and frame parsing. No React imports.
- **New** `mobile/src/data/stream/platform.ts`: RN adapters (WebSocket, `@react-native-community/netinfo`, AppState).
- **New** `mobile/src/data/store/marketStore.ts` + `ingestor.ts` + `persistence.ts` + `hooks.ts`: the vanilla Zustand store and selectors.
- **New** `mobile/src/data/StreamProvider.tsx` + `useChannels.ts`: runtime lifecycle and the channel registry.
- `mobile/src/storage/storageRepository.ts`:
  - Use `createMMKV`, with `remove` for delete.
  - Drop the gateway default write, and use a new override key (`pulse_gateway_url_override`).
  - Replace the payload cache with the market snapshot.
- Port onto the new hooks:
  - `mobile/src/app/_layout.tsx`, `mobile/src/app/(drawer)/(tabs)/_layout.tsx`, `mobile/src/app/(drawer)/(tabs)/index.tsx`
  - `mobile/src/components/navigation/HeaderStatusPill.tsx`
  - `mobile/src/components/terminal/{TerminalScreen,LastPriceHero}.tsx`: the hero takes `ticker` + `priceDecimals`.
  - `mobile/src/components/settings/SettingsScreen.tsx`: the cadence slider drives `setCadence` and shows the acked value; range from `hello`.
  - `mobile/src/components/telemetry/TelemetryScreen.tsx`
  - `mobile/src/components/watchlist/WatchlistScreen.tsx`: active pair.
- **Delete:** `mobile/src/context/MarketStreamContext.tsx`, `mobile/src/hooks/useMarketStream.ts`, `mobile/tests/mocks/react-native.ts` and `vitest.config.ts`. Also the legacy `MarketUpdatePayload`/`ClientCommand` in `shared/src/schemas.ts`, once nothing imports them.
- `mobile/package.json`: add `react-native-nitro-modules` (the MMKV peer) explicitly; the `test` script becomes jest.

## Tasks & Acceptance

**Execution:**
- [x] Test infrastructure: jest-expo config, and port the surviving vitest suites (`filter`, `tokens`, `urlUtils`, `storage`, `watchlist`, `api`, `settings`). Drop the tests of the deleted context.
- [x] `config/gateway.ts` + storage fixes (MMKV, precedence, override key)
- [x] `MarketStreamClient` + platform adapters
- [x] Store, ingestor, persistence, hooks
- [x] `StreamProvider` + `useChannels`
- [x] Port screens and the layout; delete the context and the legacy shared types
- [x] Tests: client state machine (fake socket, NetInfo, AppState, timers), store isolation, ingestor batching, persistence, config precedence, MMKV adapter

**Acceptance Criteria:**
- Given a render-count test, when the BTC ticker updates, then a component selecting ETH does not re-render.
- Given the app on the iOS simulator against the local gateway, then the terminal shows live data and switching pairs changes only the book subscription.
- Given `npm test && npm run typecheck && npm run lint`, then all pass.

## Verification

**Commands:**
- `npm test && npm run typecheck && npm run lint` -- expected: all green
- Build the app for the simulator and run it against `npm --prefix backend run dev` -- expected: live terminal, and the header status reflects the connection

## Implementation Notes

- **MMKV:** v4 exports `MMKV` as a type only, so the previous `typeof MMKV === 'function'` check always failed and storage silently fell back to memory. It now uses `createMMKV`, and `remove()` replaces `delete()`. `react-native-nitro-modules` is declared explicitly as the native peer. Settings shows whether storage is persistent.
- **Dependency hygiene:** the lockfile held two copies of React (19.3.0 at the root, 19.2.3 in the app), plus duplicate `react-native-screens`, `react-native-gesture-handler` (3.3.0 vs 2.32.0) and `react-native-safe-area-context`. In a Metro bundle, a duplicate React breaks hooks, and a duplicate gesture-handler mismatches its native module. Root `overrides` now pin the RN singletons to the SDK-aligned versions, and `npm dedupe` leaves exactly one copy of each. No other package versions changed.
- **Tests:** jest-expo + React Native Testing Library v14 (async `render`). `jest.setup.ts` provides in-memory `createMMKV` and the NetInfo mock. `modulePaths` covers `expo-modules-core`, which npm nests under `expo/`. Tautological suites (helpers defined inside the test) were removed. The replacements run real code: the client state machine, render isolation, and a rendered `MarketPairCard`.
- **Render isolation (measured in a test):** 20 BTC updates cause 20 BTC-row renders and 0 ETH-row renders.
- **Cadence:** the slider range now comes from the gateway's `hello` (`minCadenceMs`, 100 ms by default) up to 1000 ms, and the screen shows the acknowledged cadence. The mockup's 10 ms minimum is not achievable server-side and is not offered.
- **Expo Go as a secondary run option (author request):**
  - Storage picks a persistent engine at startup: MMKV in dev/release builds, the synchronous `expo-sqlite/kv-store` in Expo Go (no Nitro modules), and in-memory only as a last resort. Settings shows the active engine.
  - `react-native-worklets` (0.10.4 → 0.10.1) and `@shopify/flash-list` (2.3.2 → 2.0.2) are aligned to the SDK 57 bundled versions. Expo Go ships those natively, and Reanimated refuses to start when the JS and native worklets versions differ.
  - `expo-system-ui` was added so `userInterfaceStyle: dark` applies on Android.
- **iOS 27 scene life cycle:** the app aborted at launch on the iOS 27 simulator (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`), because the SDK 57 app template doesn't adopt `UIScene`.
  - Fix: the config plugin `mobile/plugins/withSceneLifecycle.js` applies the SDK 58 template's wiring (scene manifest, `SceneDelegate: ExpoAppSceneDelegate`, `AppDelegate: ExpoReactNativeFactoryProvider`).
  - `prebuild` output therefore stays reproducible. The plugin is idempotent: a second prebuild adds no duplicate project entries.
- **Device verification:** dev builds ran on the iOS 27 simulator (iPhone 18 Pro) and the Android emulator (Pixel 10 Pro) against the gateway in Docker.
  - Both show live BTC data and the order book, with the gateway reporting 2 connected clients.
  - Settings reports `MMKV (persistent)` on device.
  - With the gateway stopped, the app showed `RECONNECTING`. After a restart it went back to `LIVE` on its own, without being relaunched.
- **Gateway bug found on device:** shared frame Buffers were sent as binary WebSocket frames, which React Native delivers as `ArrayBuffer`. Only control messages arrived. The gateway now sends text frames, and an integration test asserts it; the fix is also on the Phase 10 branch.
- **Focus-aware subscriptions:** `useIsFocused` comes from `expo-router`, which vendors react-navigation. The earlier direct `@react-navigation/native` hook resolved a different navigation context.

## Spec Change Log

## Review Triage Log

Review pass 1, 2026-09-23: blind, edge-case and verification-gap lenses.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | `useSettings` re-read storage on every write, including the 5 s market snapshot, so Settings re-rendered every 5 s while mounted | medium | patch | `subscribeAll` now passes the key, and the hook ignores `MARKET_SNAPSHOT`. |
| 2 | Cold start showed `PAUSED` while the client was `idle` | low | patch | `idle` now maps to `CONNECTING`; `connectionStatus.test.ts` added. |
| 3 | The runtime passed a live Map iterator to `setChannels` (it worked only because it was consumed synchronously) | low | patch | Found by the ref-count test. It now passes an array snapshot. |
| 4 | `useFavorites` returns a new array each render, so watchlist `renderItem` changes identity | low | defer | The watchlist is re-rendered rarely in this phase. Phase 12 memoises rows while making them live. |
| 5 | Telemetry FPS and memory widgets still animate while unfocused | medium | defer | Scheduled as T13.2 (focus-aware sampling and the native module). |
| 6 | `LastPriceHero` still shows the fabricated market cap | medium | defer | Scheduled as T12.4 (replaced with 24h volume). |
| 7 | `expo prebuild` rewrites the `android`/`ios` npm scripts | low | reject | These are local build side effects. The scripts were restored; the native directories are gitignored. |
