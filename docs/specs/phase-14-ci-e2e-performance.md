---
title: 'Phase 14: CI, E2E flows and performance evidence'
type: 'chore'
created: '2026-09-23'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '1486f957ace6509b8dfdf4c70abc6e0966d96a21'
context:
  - '{project-root}/docs/performance.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
- Nothing runs the checks automatically.
- The user journeys have no end-to-end coverage.
- The claim that the UI stays smooth under sustained updates has no on-device measurement.

**Approach:**
- GitHub Actions for typecheck, lint, tests, the Docker build and a load-test smoke run, plus a manually triggered Android E2E job.
- Maestro flows covering the brief's journeys.
- Measured frame statistics from an Android *release* build under a sustained synthetic burst, published in `docs/performance.md`.

## Boundaries & Constraints

**Always:**
- Measurements come from a release build (minified, bundled JS, no dev tooling) and state their conditions.
- E2E flows use accessibility labels and visible text, not coordinates.
- Release builds may use cleartext only to loopback hosts (`localhost`, `127.0.0.1`, `10.0.2.2`), for local testing. Everything else requires TLS.
- CI must not depend on geo-restricted Binance hosts. It uses the `data-stream`/`data-api.binance.vision` market-data hosts.

**Never:**
- No product behaviour changes. A performance problem found here becomes its own fix commit.

## I/O & Edge-Case Matrix

| Scenario | Flow / check | Expected |
|---|---|---|
| Watchlist live | launch → Markets | 5 pairs with prices, LIVE badges |
| Search | type "sol" | only SOL / USDT listed |
| Favourite persists | toggle SOL star, relaunch, Favourites tab | SOL absent (it was a default favourite), BTC/ETH present |
| Open details | tap ETH / USDT | terminal header ETH / USDT; pressure, spread, order book, depth chart visible |
| Offline + recovery | airplane mode on, then off (Android) | "You're offline" banner; back to LIVE without user action |
| Burst smoothness | release APK, terminal, 20 Hz synthetic burst, 60 s | `gfxinfo` jank % and frame-time percentiles recorded |
| CI | push / PR | typecheck, lint, tests, Docker build, load-test smoke all green |

</frozen-after-approval>

## Code Map

- **New** `.github/workflows/ci.yml`: `checks`, `docker`, `loadtest-smoke`, and `android-e2e` (`workflow_dispatch`).
- **New** `mobile/.maestro/{watchlist,terminal,offline}.yaml` + `mobile/.maestro/README.md`.
- **New** `mobile/plugins/withLocalCleartext.js`: an Android network security config with loopback-only cleartext.
- `backend/scripts/loadtest/server.ts`: reused as the burst source (the synthetic feed at a configurable tick).
- `docs/performance.md`: an on-device section.

## Tasks & Acceptance

**Execution:**
- [x] CI workflow
- [x] Loopback cleartext plugin; Android release build
- [x] Maestro flows, run on Android (release) and iOS
- [x] Burst frame stats on the Android release build → docs/performance.md

**Acceptance Criteria:**
- Given the Android release APK on the emulator, all Maestro flows pass.
- Given `docs/performance.md`, it reports release-build frame statistics under a sustained burst, with the method stated.

## Implementation Notes

- **CI** (`.github/workflows/ci.yml`):
  - `checks`: typecheck, lint (including React Hooks rules), all tests.
  - `docker`: builds the gateway image and smoke-runs `/health`.
  - `loadtest-smoke`: 500 clients for 10 s; fails below 9 frames/s per healthy client.
  - `android-e2e`: manual (`workflow_dispatch`). Builds the release APK, runs the synthetic gateway, then runs the Maestro flows on an API 34 emulator.
  - Checked locally: the Docker smoke step and the load-test smoke step (490 healthy clients at 10 frames/s). The workflow itself runs for the first time on push.
- **Maestro** (`mobile/.maestro/`):
  - All 3 flows pass on the Android release APK.
  - `watchlist` and `terminal` pass on the iOS dev build. `offline` is Android-only, because Maestro can't toggle airplane mode on iOS.
- **Fixed while writing the flows:**
  - The favourite star was nested inside the row's accessible touchable. iOS merges that into one element, so VoiceOver and Maestro could not reach the star. It is now a sibling of the row's touchable.
  - With the search keyboard open, the first tap on a row or star only dismissed the keyboard. The list now uses `keyboardShouldPersistTaps="handled"` and dismisses the keyboard on drag.
- **Cleartext:** `plugins/withLocalCleartext.js` adds an Android network security config.
  - Release: cleartext only to `localhost`, `127.0.0.1` and `10.0.2.2`, so a release APK can reach a local gateway. Everything else still requires TLS.
  - Debug: its own config in the debug source set allows cleartext. From API 24, a network security config overrides the debug manifest's `usesCleartextTraffic`, so without it a debug build on a physical device couldn't load the bundle from Metro or reach a LAN gateway (found in pre-merge review).
  - Checked by dumping `res/xml/network_security_config.xml` from both APKs with `aapt2`; pinned by `tests/cleartextPlugin.test.ts`.
  - This supersedes the Phase 13 note that release builds need `wss://` even for local testing.
- **Performance evidence:** see `docs/performance.md` → "On device". Summary:
  - Android release at 20 frames/s: terminal 17 / 18 / 19 ms (p50 / p90 / p99), watchlist 17 / 20 / 22 ms, legacy jank ≤ 0.4%.
  - iOS release: JS thread 60 fps.
  - Memory is flat on both release builds.
- **Found during this phase: debug-build memory growth.** The author reported iOS memory at 1.66 GB after a long session.
  - Investigation: `heap` showed 814k dead `ShadowNodeFamily` allocations, pinned by React Native's debug-only Fabric leak checker, which is compiled under `REACT_NATIVE_DEBUG`.
  - An iOS Release build on the same screens stays at 113–130 MB, and an Android release build is flat as well.
  - No app change was needed. The Telemetry memory card now says so in development builds.
- **Tried and rejected:** removing `overflow: 'hidden'` from `PriceFlash`. An A/B with clean controls showed no difference.

## Spec Change Log

## Review Triage Log

Review pass 1, 2026-09-24: blind, edge-case and verification-gap lenses.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | The favourite star is unreachable by VoiceOver and Maestro on iOS | high | patch | Found by the watchlist flow. The star is now a sibling of the row touchable; the watchlist test still covers "press star doesn't open the pair". |
| 2 | The first tap while the keyboard is open is swallowed | medium | patch | `keyboardShouldPersistTaps="handled"`. The flow now passes without `hideKeyboard`. |
| 3 | iOS memory grows to 1.6 GB+ in long sessions | high | reject (debug-only) | Leak checker under `REACT_NATIVE_DEBUG`. Release is flat (heap, footprint). A dev-build note was added to Telemetry. |
| 4 | Emulator frame stats drift as the host heats up | medium | patch (method) | Captures are now bracketed by a native control, and degraded windows are discarded. |
| 5 | The `android-e2e` CI job hasn't run yet | low | defer | Manual trigger. It runs on the first dispatch after push, and the flows themselves are verified locally. |
| 6 | Emulator deadline-jank counts don't match the frame-time percentiles | low | defer | Explained in `docs/performance.md`. Confirming needs a physical device. |
